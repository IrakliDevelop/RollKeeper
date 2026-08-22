-- Slice 11B: register only calendars/events in the durable DM framework.

alter table public.campaign_documents drop constraint campaign_documents_family_check;
alter table public.campaign_documents add constraint campaign_documents_family_check check (family in ('campaign_settings','calendar'));
alter table private.campaign_document_versions drop constraint campaign_document_versions_family_check;
alter table private.campaign_document_versions add constraint campaign_document_versions_family_check check (family in ('campaign_settings','calendar'));
alter table private.campaign_document_recovery_receipts drop constraint campaign_document_recovery_receipts_family_check;
alter table private.campaign_document_recovery_receipts add constraint campaign_document_recovery_receipts_family_check check (family in ('campaign_settings','calendar'));
alter table private.campaign_document_manifests drop constraint campaign_document_manifests_family_check;
alter table private.campaign_document_manifests add constraint campaign_document_manifests_family_check check (family in ('campaign_settings','calendar'));
alter table private.campaign_document_staging_runs drop constraint campaign_document_staging_runs_family_check;
alter table private.campaign_document_staging_runs add constraint campaign_document_staging_runs_family_check check (family in ('campaign_settings','calendar'));
alter table private.campaign_family_cutover_generations drop constraint campaign_family_cutover_generations_family_check;
alter table private.campaign_family_cutover_generations add constraint campaign_family_cutover_generations_family_check check (family in ('campaign_settings','calendar'));
alter table private.campaign_family_device_enrollments drop constraint campaign_family_device_enrollments_family_check;
alter table private.campaign_family_device_enrollments add constraint campaign_family_device_enrollments_family_check check (family in ('campaign_settings','calendar'));
alter table private.campaign_document_projection_outbox drop constraint campaign_document_projection_outbox_family_check;
alter table private.campaign_document_projection_outbox add constraint campaign_document_projection_outbox_family_check check (family in ('campaign_settings','calendar'));
alter table private.campaign_document_projection_outbox drop constraint campaign_document_projection_outbox_projection_kind_check;
alter table private.campaign_document_projection_outbox add constraint campaign_document_projection_outbox_projection_kind_check check (projection_kind in ('campaign_settings_v1','calendar_v1'));
alter table private.campaign_document_projection_incidents drop constraint campaign_document_projection_incidents_family_check;
alter table private.campaign_document_projection_incidents add constraint campaign_document_projection_incidents_family_check check (family in ('campaign_settings','calendar'));

create function private.require_calendar_owner(p_campaign_id uuid,p_expected_epoch bigint,p_required_authority text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_authority public.campaign_authority_records%rowtype;
begin
  if v_actor is null then raise exception using errcode='42501',message='authentication is required'; end if;
  if not exists(select 1 from public.campaigns c where c.id=p_campaign_id and c.owner_id=v_actor and c.ownership_state='owner_verified' and c.deleted_at is null)
  then raise exception using errcode='42501',message='campaign owner authorization is required'; end if;
  select * into v_authority from public.campaign_authority_records a
  where a.campaign_id=p_campaign_id and a.axis='durable_family' and a.family='calendar' for update;
  if not found then raise exception using errcode='55000',message='calendar authority is missing'; end if;
  if v_authority.epoch<>p_expected_epoch then raise exception using errcode='40001',message='stale calendar epoch'; end if;
  if v_authority.authority<>p_required_authority then raise exception using errcode='55000',message='calendar authority is not '||p_required_authority; end if;
  return v_actor;
end; $$;

create function private.valid_calendar_payload(p_payload jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare v_event jsonb; v_reference jsonb;
begin
  if pg_catalog.jsonb_typeof(p_payload)<>'object'
    or p_payload - array['config','currentTime','startTime','events','weather'] <> '{}'::jsonb
    or pg_catalog.jsonb_typeof(p_payload->'config')<>'object'
    or pg_catalog.jsonb_typeof(p_payload->'currentTime')<>'number'
    or pg_catalog.jsonb_typeof(p_payload->'startTime')<>'number'
    or pg_catalog.jsonb_typeof(p_payload->'events')<>'array'
    or pg_catalog.jsonb_array_length(p_payload->'events')>1000
  then return false; end if;
  for v_event in select value from pg_catalog.jsonb_array_elements(p_payload->'events') loop
    if pg_catalog.jsonb_typeof(v_event)<>'object' or length(v_event->>'id') not between 1 and 255 then return false; end if;
    if v_event ? 'references' then
      if pg_catalog.jsonb_typeof(v_event->'references')<>'array' then return false; end if;
      for v_reference in select value from pg_catalog.jsonb_array_elements(v_event->'references') loop
        if v_reference->>'family' not in ('location','encounter_definition') or length(v_reference->>'legacyId') not between 1 and 255 then return false; end if;
      end loop;
    end if;
  end loop;
  if exists(select 1 from pg_catalog.jsonb_array_elements(p_payload->'events') e group by e->>'id' having count(*)>1) then return false; end if;
  return true;
end; $$;

create function private.append_calendar_projection_event(p_version private.campaign_document_versions)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into private.campaign_document_projection_outbox(
    campaign_id,campaign_document_version_id,family,legacy_id,server_version,
    cutover_epoch,projection_kind,source_fingerprint
  ) values(
    p_version.campaign_id,p_version.id,'calendar',p_version.legacy_id,
    p_version.server_version,p_version.cutover_epoch,'calendar_v1',p_version.payload_fingerprint
  );
end; $$;

create function public.begin_calendar_staging(
  p_mutation_id uuid,p_campaign_id uuid,p_device_id uuid,p_expected_epoch bigint,
  p_manifest_fingerprint text,p_recovery_manifest_hash text,p_recovery_receipt_hash text,
  p_record_count integer,p_total_bytes bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_manifest_id uuid; v_run_id uuid; v_result jsonb;
begin
  if p_mutation_id is null or p_device_id is null or p_manifest_fingerprint !~ '^[a-f0-9]{64}$'
    or p_recovery_manifest_hash !~ '^[a-f0-9]{64}$' or p_recovery_receipt_hash<>p_recovery_manifest_hash
    or p_record_count<>1 or p_total_bytes not between 1 and 5242880
  then raise exception using errcode='22023',message='invalid calendar staging request'; end if;
  v_actor:=private.require_calendar_owner(p_campaign_id,p_expected_epoch,'legacy');
  v_hash:=private.campaign_document_request_hash(pg_catalog.jsonb_build_object('family','calendar','campaignId',p_campaign_id,'deviceId',p_device_id,'epoch',p_expected_epoch,'manifest',p_manifest_fingerprint,'recovery',p_recovery_manifest_hash,'count',p_record_count,'bytes',p_total_bytes));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'begin_staging' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID reuse mismatch'; end if; return v_existing.result; end if;
  insert into private.campaign_document_recovery_receipts(actor_id,campaign_id,family,device_id,recovery_manifest_hash,receipt_hash)
  values(v_actor,p_campaign_id,'calendar',p_device_id,p_recovery_manifest_hash,p_recovery_receipt_hash) on conflict do nothing;
  insert into private.campaign_document_manifests(campaign_id,family,device_id,cutover_epoch,fingerprint,record_count,total_bytes,manifest,blocker_count,created_by)
  values(p_campaign_id,'calendar',p_device_id,p_expected_epoch,p_manifest_fingerprint,p_record_count,p_total_bytes,pg_catalog.jsonb_build_object('fingerprint',p_manifest_fingerprint,'recordCount',p_record_count,'totalBytes',p_total_bytes),0,v_actor)
  on conflict(campaign_id,family,fingerprint) do update set fingerprint=excluded.fingerprint returning id into v_manifest_id;
  v_run_id:=extensions.gen_random_uuid();
  insert into private.campaign_document_staging_runs(id,campaign_id,family,device_id,expected_epoch,manifest_id,recovery_manifest_hash,state,created_by)
  values(v_run_id,p_campaign_id,'calendar',p_device_id,p_expected_epoch,v_manifest_id,p_recovery_manifest_hash,'staging',v_actor);
  v_result:=pg_catalog.jsonb_build_object('runId',v_run_id,'state','staging','manifestFingerprint',p_manifest_fingerprint);
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'begin_staging',v_hash,v_result);
  return v_result;
end; $$;

create function public.stage_calendar_items(p_mutation_id uuid,p_run_id uuid,p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_run private.campaign_document_staging_runs%rowtype; v_manifest private.campaign_document_manifests%rowtype; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_item jsonb; v_count integer; v_bytes bigint; v_result jsonb; v_canonical jsonb;
begin
  if v_actor is null or p_mutation_id is null or pg_catalog.jsonb_typeof(p_items)<>'array' or pg_catalog.jsonb_array_length(p_items)<>1 then raise exception using errcode='22023',message='invalid calendar staging items'; end if;
  v_hash:=private.campaign_document_request_hash(pg_catalog.jsonb_build_object('family','calendar','runId',p_run_id,'items',p_items));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'stage_items' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID reuse mismatch'; end if; return v_existing.result; end if;
  select * into v_run from private.campaign_document_staging_runs where id=p_run_id and family='calendar' and created_by=v_actor and state in ('staging','validated') for update;
  if not found then raise exception using errcode='42501',message='calendar staging run is unavailable'; end if;
  perform private.require_calendar_owner(v_run.campaign_id,v_run.expected_epoch,'legacy');
  delete from private.campaign_document_staging_items where run_id=p_run_id;
  v_item:=p_items->0;
  v_canonical:=case when coalesce((v_item->>'tombstoned')::boolean,false) then pg_catalog.jsonb_build_object('legacyId',v_item->>'legacyId','tombstoned',true) else v_item->'payload' end;
  if length(v_item->>'legacyId') not between 1 and 255 or (v_item->>'schemaVersion')::integer<>1
    or (v_item->>'payloadFingerprint') !~ '^[a-f0-9]{64}$'
    or (not coalesce((v_item->>'tombstoned')::boolean,false) and not private.valid_calendar_payload(v_item->'payload'))
    or pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(v_canonical),'UTF8'))>262144
    or (v_item->>'payloadFingerprint')<>private.campaign_document_hash(v_canonical)
  then raise exception using errcode='22023',message='invalid or oversized calendar document'; end if;
  insert into private.campaign_document_staging_items(run_id,legacy_id,schema_version,payload,payload_fingerprint,tombstoned,byte_count)
  values(p_run_id,v_item->>'legacyId',1,v_item->'payload',v_item->>'payloadFingerprint',coalesce((v_item->>'tombstoned')::boolean,false),greatest(1,pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(v_canonical),'UTF8'))));
  select count(*),coalesce(sum(byte_count),0) into v_count,v_bytes from private.campaign_document_staging_items where run_id=p_run_id;
  select * into v_manifest from private.campaign_document_manifests where id=v_run.manifest_id;
  if v_count<>v_manifest.record_count or v_bytes<>v_manifest.total_bytes then raise exception using errcode='22023',message='staged calendar does not match manifest'; end if;
  update private.campaign_document_staging_runs set state='validated' where id=p_run_id;
  v_result:=pg_catalog.jsonb_build_object('runId',p_run_id,'state','validated','itemCount',v_count,'totalBytes',v_bytes);
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'stage_items',v_hash,v_result);
  return v_result;
end; $$;

create function public.confirm_calendar_cutover(p_mutation_id uuid,p_run_id uuid,p_manifest_fingerprint text,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_run private.campaign_document_staging_runs%rowtype; v_manifest private.campaign_document_manifests%rowtype; v_item private.campaign_document_staging_items%rowtype; v_doc public.campaign_documents%rowtype; v_version private.campaign_document_versions%rowtype; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_result jsonb; v_preview text;
begin
  if v_actor is null then raise exception using errcode='42501',message='authentication required'; end if;
  v_hash:=private.campaign_document_request_hash(pg_catalog.jsonb_build_object('family','calendar','runId',p_run_id,'manifest',p_manifest_fingerprint,'epoch',p_expected_epoch));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'confirm_cutover' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID reuse mismatch'; end if; return v_existing.result; end if;
  select * into v_run from private.campaign_document_staging_runs where id=p_run_id and family='calendar' and created_by=v_actor and state='validated' for update;
  if not found then raise exception using errcode='55000',message='validated calendar staging run required'; end if;
  perform private.require_calendar_owner(v_run.campaign_id,p_expected_epoch,'legacy');
  select * into v_manifest from private.campaign_document_manifests where id=v_run.manifest_id;
  if v_manifest.fingerprint<>p_manifest_fingerprint or v_manifest.blocker_count<>0 then raise exception using errcode='40001',message='exact calendar manifest confirmation required'; end if;
  select * into v_item from private.campaign_document_staging_items where run_id=p_run_id;
  if not found then raise exception using errcode='55000',message='complete calendar generation required'; end if;
  insert into public.campaign_documents(campaign_id,family,legacy_id,payload,schema_version,server_version,payload_fingerprint,tombstoned,last_mutation_id)
  values(v_run.campaign_id,'calendar',v_item.legacy_id,case when v_item.tombstoned then null else v_item.payload end,1,1,v_item.payload_fingerprint,v_item.tombstoned,p_mutation_id) returning * into v_doc;
  insert into private.campaign_document_versions(campaign_document_id,campaign_id,family,legacy_id,server_version,cutover_epoch,schema_version,payload,payload_fingerprint,tombstoned,actor_id,mutation_id,base_server_version)
  values(v_doc.id,v_doc.campaign_id,'calendar',v_doc.legacy_id,1,p_expected_epoch+1,1,v_doc.payload,v_doc.payload_fingerprint,v_doc.tombstoned,v_actor,p_mutation_id,0) returning * into v_version;
  perform private.append_calendar_projection_event(v_version);
  update public.campaign_authority_records set authority='postgres',epoch=p_expected_epoch+1,updated_at=statement_timestamp()
  where campaign_id=v_run.campaign_id and axis='durable_family' and family='calendar' and authority='legacy' and epoch=p_expected_epoch;
  if not found then raise exception using errcode='40001',message='calendar authority changed during cutover'; end if;
  v_preview:=private.campaign_document_hash(pg_catalog.jsonb_build_object('campaignId',v_run.campaign_id,'family','calendar','epoch',p_expected_epoch+1,'legacyId',v_doc.legacy_id,'serverVersion',1,'schemaVersion',1,'payloadFingerprint',v_doc.payload_fingerprint,'tombstoned',v_doc.tombstoned));
  insert into private.campaign_family_device_enrollments(campaign_id,family,device_id,owner_id,cutover_epoch,preview_fingerprint,state)
  values(v_run.campaign_id,'calendar',v_run.device_id,v_actor,p_expected_epoch+1,v_preview,'enrolled');
  insert into private.campaign_family_cutover_generations(campaign_id,family,epoch,authority,manifest_fingerprint,current_generation,projection_journal_reconciled,verified_complete,created_by)
  values(v_run.campaign_id,'calendar',p_expected_epoch+1,'postgres',p_manifest_fingerprint,pg_catalog.jsonb_build_object('runId',p_run_id,'recordCount',1),true,true,v_actor);
  update private.campaign_document_staging_runs set state='finalized',finalized_at=statement_timestamp() where id=p_run_id;
  v_result:=pg_catalog.jsonb_build_object('campaignId',v_run.campaign_id,'family','calendar','authority','postgres','epoch',p_expected_epoch+1,'recordCount',1,'manifestFingerprint',p_manifest_fingerprint,'previewFingerprint',v_preview);
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'confirm_cutover',v_hash,v_result);
  return v_result;
end; $$;

create function public.put_calendar_document(
  p_mutation_id uuid,p_campaign_id uuid,p_expected_epoch bigint,p_legacy_id text,p_operation text,
  p_expected_server_version bigint,p_schema_version integer,p_payload jsonb,p_payload_fingerprint text,
  p_restore_source_version bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_doc public.campaign_documents%rowtype; v_version private.campaign_document_versions%rowtype; v_next bigint; v_tombstone boolean; v_result jsonb;
begin
  if p_operation not in ('create','replace','delete') or length(p_legacy_id) not between 1 and 255 or p_schema_version<>1 or p_payload_fingerprint !~ '^[a-f0-9]{64}$'
    or (p_operation<>'delete' and (not private.valid_calendar_payload(p_payload) or pg_column_size(p_payload)>262144))
  then raise exception using errcode='22023',message='invalid calendar mutation'; end if;
  if p_payload_fingerprint<>private.campaign_document_hash(case when p_operation='delete' then pg_catalog.jsonb_build_object('legacyId',p_legacy_id,'tombstoned',true) else p_payload end)
  then raise exception using errcode='22023',message='calendar fingerprint mismatch'; end if;
  v_actor:=private.require_calendar_owner(p_campaign_id,p_expected_epoch,'postgres');
  v_hash:=private.campaign_document_request_hash(pg_catalog.jsonb_build_object('family','calendar','campaignId',p_campaign_id,'epoch',p_expected_epoch,'legacyId',p_legacy_id,'operation',p_operation,'base',p_expected_server_version,'schema',p_schema_version,'payload',p_payload,'fingerprint',p_payload_fingerprint,'restoreSourceVersion',p_restore_source_version));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'put_document' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID reuse mismatch'; end if; return v_existing.result; end if;
  select * into v_doc from public.campaign_documents where campaign_id=p_campaign_id and family='calendar' and legacy_id=p_legacy_id for update;
  if not found then
    if p_operation<>'create' or p_expected_server_version<>0 then raise exception using errcode='40001',message='calendar server version conflict'; end if;
    v_next:=1; v_tombstone:=false;
    insert into public.campaign_documents(campaign_id,family,legacy_id,payload,schema_version,server_version,payload_fingerprint,tombstoned,last_mutation_id)
    values(p_campaign_id,'calendar',p_legacy_id,p_payload,1,v_next,p_payload_fingerprint,false,p_mutation_id) returning * into v_doc;
  else
    if v_doc.server_version<>p_expected_server_version then raise exception using errcode='40001',message='calendar server version conflict'; end if;
    if v_doc.tombstoned and p_operation<>'delete' and p_restore_source_version is null then raise exception using errcode='55000',message='calendar tombstone cannot be resurrected without explicit history restore'; end if;
    v_next:=v_doc.server_version+1; v_tombstone:=p_operation='delete';
    update public.campaign_documents set payload=case when v_tombstone then null else p_payload end,server_version=v_next,payload_fingerprint=p_payload_fingerprint,tombstoned=v_tombstone,last_mutation_id=p_mutation_id,updated_at=statement_timestamp() where id=v_doc.id returning * into v_doc;
  end if;
  insert into private.campaign_document_versions(campaign_document_id,campaign_id,family,legacy_id,server_version,cutover_epoch,schema_version,payload,payload_fingerprint,tombstoned,actor_id,mutation_id,base_server_version)
  values(v_doc.id,p_campaign_id,'calendar',p_legacy_id,v_next,p_expected_epoch,1,v_doc.payload,p_payload_fingerprint,v_doc.tombstoned,v_actor,p_mutation_id,p_expected_server_version) returning * into v_version;
  perform private.append_calendar_projection_event(v_version);
  v_result:=pg_catalog.jsonb_build_object('documentId',v_doc.id,'campaignId',p_campaign_id,'family','calendar','legacyId',p_legacy_id,'serverVersion',v_next,'cutoverEpoch',p_expected_epoch,'payloadFingerprint',p_payload_fingerprint,'tombstoned',v_doc.tombstoned,'cloudSaved',true,'playerView','pending');
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'put_document',v_hash,v_result);
  return v_result;
end; $$;

create function public.list_calendar_document_versions(p_campaign_id uuid,p_legacy_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_result jsonb;
begin
  if not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and deleted_at is null) then raise exception using errcode='42501',message='campaign owner authorization required'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('versionId',v.id,'serverVersion',v.server_version,'cutoverEpoch',v.cutover_epoch,'schemaVersion',v.schema_version,'payloadFingerprint',v.payload_fingerprint,'tombstoned',v.tombstoned,'mutationId',v.mutation_id,'acceptedAt',v.accepted_at) order by v.server_version desc),'[]'::jsonb) into v_result
  from private.campaign_document_versions v where v.campaign_id=p_campaign_id and v.family='calendar' and v.legacy_id=p_legacy_id;
  return pg_catalog.jsonb_build_object('campaignId',p_campaign_id,'family','calendar','legacyId',p_legacy_id,'versions',v_result);
end; $$;

create function public.export_calendar_document_version(p_campaign_id uuid,p_legacy_id text,p_server_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v private.campaign_document_versions%rowtype;
begin
  if not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and deleted_at is null) then raise exception using errcode='42501',message='campaign owner authorization required'; end if;
  select * into v from private.campaign_document_versions where campaign_id=p_campaign_id and family='calendar' and legacy_id=p_legacy_id and server_version=p_server_version;
  if not found then raise exception using errcode='P0002',message='calendar version not found'; end if;
  return pg_catalog.jsonb_build_object('serverVersion',v.server_version,'schemaVersion',v.schema_version,'payloadFingerprint',v.payload_fingerprint,'tombstoned',v.tombstoned,'payload',v.payload);
end; $$;

create function public.restore_calendar_document_version(p_mutation_id uuid,p_campaign_id uuid,p_expected_epoch bigint,p_legacy_id text,p_source_version bigint,p_expected_server_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_source private.campaign_document_versions%rowtype;
begin
  perform private.require_calendar_owner(p_campaign_id,p_expected_epoch,'postgres');
  select * into v_source from private.campaign_document_versions where campaign_id=p_campaign_id and family='calendar' and legacy_id=p_legacy_id and server_version=p_source_version;
  if not found or v_source.tombstoned then raise exception using errcode='55000',message='restorable calendar version required'; end if;
  return public.put_calendar_document(p_mutation_id,p_campaign_id,p_expected_epoch,p_legacy_id,'replace',p_expected_server_version,1,v_source.payload,v_source.payload_fingerprint,p_source_version);
end; $$;

create function public.compare_calendar_document_versions(p_campaign_id uuid,p_legacy_id text,p_left bigint,p_right bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_left jsonb; v_right jsonb;
begin
  v_left:=public.export_calendar_document_version(p_campaign_id,p_legacy_id,p_left);
  v_right:=public.export_calendar_document_version(p_campaign_id,p_legacy_id,p_right);
  return pg_catalog.jsonb_build_object('left',v_left-'payload','right',v_right-'payload','identical',(v_left->>'payloadFingerprint')=(v_right->>'payloadFingerprint') and (v_left->>'tombstoned')=(v_right->>'tombstoned'));
end; $$;

create function public.preview_calendar_device_enrollment(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_epoch bigint; v_doc public.campaign_documents%rowtype; v_preview text;
begin
  if not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and deleted_at is null) then raise exception using errcode='42501',message='campaign owner authorization required'; end if;
  select epoch into v_epoch from public.campaign_authority_records where campaign_id=p_campaign_id and axis='durable_family' and family='calendar' and authority='postgres';
  if not found then return pg_catalog.jsonb_build_object('authority','legacy'); end if;
  select * into v_doc from public.campaign_documents where campaign_id=p_campaign_id and family='calendar';
  if not found then raise exception using errcode='55000',message='current calendar requires history recovery'; end if;
  v_preview:=private.campaign_document_hash(pg_catalog.jsonb_build_object('campaignId',p_campaign_id,'family','calendar','epoch',v_epoch,'legacyId',v_doc.legacy_id,'serverVersion',v_doc.server_version,'schemaVersion',v_doc.schema_version,'payloadFingerprint',v_doc.payload_fingerprint,'tombstoned',v_doc.tombstoned));
  return pg_catalog.jsonb_build_object('authority','postgres','epoch',v_epoch,'previewFingerprint',v_preview,'legacyId',v_doc.legacy_id,'serverVersion',v_doc.server_version,'schemaVersion',v_doc.schema_version,'payloadFingerprint',v_doc.payload_fingerprint,'tombstoned',v_doc.tombstoned,'payload',v_doc.payload);
end; $$;

create function public.enroll_calendar_device(p_mutation_id uuid,p_campaign_id uuid,p_device_id uuid,p_expected_epoch bigint,p_preview_fingerprint text,p_legacy_candidate_fingerprint text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_preview jsonb; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_result jsonb;
begin
  if p_device_id is null or p_preview_fingerprint !~ '^[a-f0-9]{64}$' or (p_legacy_candidate_fingerprint is not null and p_legacy_candidate_fingerprint !~ '^[a-f0-9]{64}$') then raise exception using errcode='22023',message='invalid calendar enrollment'; end if;
  v_actor:=private.require_calendar_owner(p_campaign_id,p_expected_epoch,'postgres');
  v_hash:=private.campaign_document_request_hash(pg_catalog.jsonb_build_object('family','calendar','campaignId',p_campaign_id,'deviceId',p_device_id,'epoch',p_expected_epoch,'preview',p_preview_fingerprint,'legacy',p_legacy_candidate_fingerprint));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'enroll_device' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID reuse mismatch'; end if; return v_existing.result; end if;
  v_preview:=public.preview_calendar_device_enrollment(p_campaign_id);
  if v_preview->>'previewFingerprint'<>p_preview_fingerprint then raise exception using errcode='40001',message='calendar enrollment preview changed'; end if;
  insert into private.campaign_family_device_enrollments(campaign_id,family,device_id,owner_id,cutover_epoch,preview_fingerprint,legacy_candidate_fingerprint,state)
  values(p_campaign_id,'calendar',p_device_id,v_actor,p_expected_epoch,p_preview_fingerprint,p_legacy_candidate_fingerprint,'enrolled')
  on conflict(campaign_id,family,device_id,owner_id) do update set cutover_epoch=excluded.cutover_epoch,preview_fingerprint=excluded.preview_fingerprint,legacy_candidate_fingerprint=excluded.legacy_candidate_fingerprint,state='enrolled',removed_at=null;
  v_result:=pg_catalog.jsonb_build_object('campaignId',p_campaign_id,'family','calendar','deviceId',p_device_id,'epoch',p_expected_epoch,'state','enrolled');
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'enroll_device',v_hash,v_result);
  return v_result;
end; $$;

create function public.remove_calendar_device(p_mutation_id uuid,p_campaign_id uuid,p_device_id uuid,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_result jsonb;
begin
  v_actor:=private.require_calendar_owner(p_campaign_id,p_expected_epoch,'postgres');
  v_hash:=private.campaign_document_request_hash(pg_catalog.jsonb_build_object('family','calendar','campaignId',p_campaign_id,'deviceId',p_device_id,'epoch',p_expected_epoch));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'remove_device' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID reuse mismatch'; end if; return v_existing.result; end if;
  update private.campaign_family_device_enrollments set state='removed',removed_at=statement_timestamp() where campaign_id=p_campaign_id and family='calendar' and device_id=p_device_id and owner_id=v_actor;
  if not found then raise exception using errcode='55000',message='exact enrolled calendar device required'; end if;
  v_result:=pg_catalog.jsonb_build_object('campaignId',p_campaign_id,'family','calendar','deviceId',p_device_id,'epoch',p_expected_epoch,'state','removed');
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'remove_device',v_hash,v_result);
  return v_result;
end; $$;

create function public.claim_calendar_projection_events(p_worker_id uuid,p_limit integer,p_lease_seconds integer)
returns table(event_id uuid,campaign_id uuid,campaign_code text,legacy_id text,server_version bigint,cutover_epoch bigint,source_fingerprint text,payload jsonb,tombstoned boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('request.jwt.claim.role',true)<>'service_role' or p_limit not between 1 and 100 or p_lease_seconds not between 5 and 300 then raise exception using errcode='42501',message='calendar worker authorization required'; end if;
  return query with candidates as (
    select o.id from private.campaign_document_projection_outbox o where o.family='calendar' and ((o.state in ('queued','retry') and o.available_at<=statement_timestamp()) or (o.state='leased' and o.lease_expires_at<=statement_timestamp())) order by o.available_at,o.created_at limit p_limit for update skip locked
  ), claimed as (
    update private.campaign_document_projection_outbox o set state='leased',lease_owner=p_worker_id,lease_expires_at=statement_timestamp()+pg_catalog.make_interval(secs=>p_lease_seconds),attempt_count=o.attempt_count+1 from candidates c where o.id=c.id returning o.*
  ) select c.id,c.campaign_id,c.legacy_id,c.legacy_id,c.server_version,c.cutover_epoch,c.source_fingerprint,v.payload,v.tombstoned from claimed c join private.campaign_document_versions v on v.id=c.campaign_document_version_id order by c.available_at,c.created_at;
end; $$;

create function public.calendar_projection_status(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_pending integer; v_failed integer; v_oldest timestamptz;
begin
  if not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and deleted_at is null) then raise exception using errcode='42501',message='campaign owner authorization required'; end if;
  select count(*) filter(where state not in ('acknowledged','dead')),count(*) filter(where state='dead'),min(created_at) filter(where state<>'acknowledged') into v_pending,v_failed,v_oldest from private.campaign_document_projection_outbox where campaign_id=p_campaign_id and family='calendar';
  return pg_catalog.jsonb_build_object('pendingCount',v_pending,'failedCount',v_failed,'oldestPendingAt',v_oldest,'freshnessSloSeconds',60,'status',case when v_failed>0 then 'failed' when v_pending>0 then 'pending' else 'current' end);
end; $$;

create function public.fail_calendar_projection_event(p_event_id uuid,p_worker_id uuid,p_error_code text,p_incident_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_event private.campaign_document_projection_outbox%rowtype; v_dead boolean;
begin
  if current_setting('request.jwt.claim.role',true)<>'service_role' or length(p_error_code) not between 1 and 100 then raise exception using errcode='42501',message='calendar worker authorization required'; end if;
  select * into v_event from private.campaign_document_projection_outbox where id=p_event_id and family='calendar' and state='leased' and lease_owner=p_worker_id for update;
  if not found then raise exception using errcode='40001',message='calendar projection lease is stale'; end if;
  v_dead:=v_event.attempt_count>=8 or p_incident_kind in ('equal_version_divergence','poison_event','stale_epoch');
  update private.campaign_document_projection_outbox set state=case when v_dead then 'dead' else 'retry' end,available_at=statement_timestamp()+least(interval '5 minutes',interval '2 seconds'*power(2,greatest(0,attempt_count-1))),lease_owner=null,lease_expires_at=null,last_error_code=p_error_code where id=p_event_id;
  if v_dead then insert into private.campaign_document_projection_incidents(event_id,campaign_id,family,incident_kind,metadata) values(p_event_id,v_event.campaign_id,'calendar',coalesce(p_incident_kind,'retry_exhausted'),pg_catalog.jsonb_build_object('errorCode',p_error_code,'attemptCount',v_event.attempt_count)); end if;
end; $$;

create function public.list_calendar_projection_incidents(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_result jsonb;
begin
  if not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and deleted_at is null) then raise exception using errcode='42501',message='campaign owner authorization required'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('incidentId',id,'eventId',event_id,'kind',incident_kind,'createdAt',created_at,'resolvedAt',resolved_at) order by created_at),'[]'::jsonb) into v_result from private.campaign_document_projection_incidents where campaign_id=p_campaign_id and family='calendar' and resolved_at is null;
  return pg_catalog.jsonb_build_object('campaignId',p_campaign_id,'family','calendar','incidents',v_result);
end; $$;

create function public.replay_calendar_projection_event(p_mutation_id uuid,p_campaign_id uuid,p_expected_epoch bigint,p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_event private.campaign_document_projection_outbox%rowtype; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_result jsonb;
begin
  v_actor:=private.require_calendar_owner(p_campaign_id,p_expected_epoch,'postgres');
  v_hash:=private.campaign_document_request_hash(pg_catalog.jsonb_build_object('family','calendar','campaignId',p_campaign_id,'epoch',p_expected_epoch,'eventId',p_event_id));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'replay_projection' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID reuse mismatch'; end if; return v_existing.result; end if;
  select * into v_event from private.campaign_document_projection_outbox where id=p_event_id and campaign_id=p_campaign_id and family='calendar' for update;
  if not found or v_event.state<>'dead' then raise exception using errcode='55000',message='dead calendar projection event required'; end if;
  update private.campaign_document_projection_outbox set state='queued',attempt_count=0,available_at=statement_timestamp(),lease_owner=null,lease_expires_at=null,last_error_code=null where id=p_event_id;
  update private.campaign_document_projection_incidents set resolved_at=statement_timestamp() where event_id=p_event_id and resolved_at is null;
  v_result:=pg_catalog.jsonb_build_object('campaignId',p_campaign_id,'family','calendar','eventId',p_event_id,'state','queued');
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'replay_projection',v_hash,v_result);
  return v_result;
end; $$;

create function public.resolve_calendar_projection_authority(p_campaign_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_authority public.campaign_authority_records%rowtype;
begin
  if current_setting('request.jwt.claim.role',true)<>'service_role' then raise exception using errcode='42501',message='application authority lookup required'; end if;
  select a.* into v_authority
  from public.campaigns c
  join public.campaign_authority_records a on a.campaign_id=c.id
  where c.deleted_at is null and a.axis='durable_family' and a.family='calendar'
    and (c.display_code=p_campaign_code or exists(
      select 1 from public.campaign_documents d
      where d.campaign_id=c.id and d.family='calendar' and d.legacy_id=p_campaign_code
    ));
  if not found then return pg_catalog.jsonb_build_object('authority','unselected'); end if;
  return pg_catalog.jsonb_build_object('authority',v_authority.authority,'epoch',v_authority.epoch);
end; $$;

create function public.rollback_calendar_family(p_mutation_id uuid,p_campaign_id uuid,p_expected_epoch bigint,p_manifest_fingerprint text,p_current_generation jsonb,p_projection_journal_reconciled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_preview jsonb; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_result jsonb;
begin
  if not p_projection_journal_reconciled or p_manifest_fingerprint !~ '^[a-f0-9]{64}$' or pg_catalog.jsonb_typeof(p_current_generation)<>'object' then raise exception using errcode='55000',message='verified current calendar generation required'; end if;
  v_actor:=private.require_calendar_owner(p_campaign_id,p_expected_epoch,'postgres');
  v_hash:=private.campaign_document_request_hash(pg_catalog.jsonb_build_object('family','calendar','campaignId',p_campaign_id,'epoch',p_expected_epoch,'manifest',p_manifest_fingerprint,'generation',p_current_generation));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'rollback_family' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID reuse mismatch'; end if; return v_existing.result; end if;
  if exists(select 1 from private.campaign_document_projection_outbox where campaign_id=p_campaign_id and family='calendar' and state in ('queued','leased','retry')) then raise exception using errcode='55000',message='calendar projection journal incomplete'; end if;
  v_preview:=public.preview_calendar_device_enrollment(p_campaign_id);
  if v_preview->>'previewFingerprint'<>p_manifest_fingerprint or v_preview->>'legacyId'<>p_current_generation->>'legacyId' or (v_preview->>'serverVersion')::bigint<>(p_current_generation->>'serverVersion')::bigint or v_preview->>'payloadFingerprint'<>p_current_generation->>'fingerprint' then raise exception using errcode='40001',message='verified calendar generation changed'; end if;
  update public.campaign_authority_records set authority='legacy',epoch=p_expected_epoch+1,updated_at=statement_timestamp() where campaign_id=p_campaign_id and axis='durable_family' and family='calendar' and authority='postgres' and epoch=p_expected_epoch;
  insert into private.campaign_family_cutover_generations(campaign_id,family,epoch,authority,manifest_fingerprint,current_generation,projection_journal_reconciled,verified_complete,created_by)
  values(p_campaign_id,'calendar',p_expected_epoch+1,'legacy_restored',p_manifest_fingerprint,p_current_generation,true,true,v_actor);
  v_result:=pg_catalog.jsonb_build_object('campaignId',p_campaign_id,'family','calendar','authority','legacy','epoch',p_expected_epoch+1,'currentGeneration',v_preview);
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'rollback_family',v_hash,v_result);
  return v_result;
end; $$;

revoke all on function private.require_calendar_owner(uuid,bigint,text) from public,anon,authenticated;
revoke all on function private.valid_calendar_payload(jsonb) from public,anon,authenticated;
revoke all on function private.append_calendar_projection_event(private.campaign_document_versions) from public,anon,authenticated;

revoke all on function public.begin_calendar_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint) from public,anon,authenticated;
revoke all on function public.stage_calendar_items(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.confirm_calendar_cutover(uuid,uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.put_calendar_document(uuid,uuid,bigint,text,text,bigint,integer,jsonb,text,bigint) from public,anon,authenticated;
revoke all on function public.list_calendar_document_versions(uuid,text) from public,anon,authenticated;
revoke all on function public.export_calendar_document_version(uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.restore_calendar_document_version(uuid,uuid,bigint,text,bigint,bigint) from public,anon,authenticated;
revoke all on function public.compare_calendar_document_versions(uuid,text,bigint,bigint) from public,anon,authenticated;
revoke all on function public.preview_calendar_device_enrollment(uuid) from public,anon,authenticated;
revoke all on function public.enroll_calendar_device(uuid,uuid,uuid,bigint,text,text) from public,anon,authenticated;
revoke all on function public.remove_calendar_device(uuid,uuid,uuid,bigint) from public,anon,authenticated;
revoke all on function public.calendar_projection_status(uuid) from public,anon,authenticated;
revoke all on function public.fail_calendar_projection_event(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.list_calendar_projection_incidents(uuid) from public,anon,authenticated;
revoke all on function public.replay_calendar_projection_event(uuid,uuid,bigint,uuid) from public,anon,authenticated;
revoke all on function public.resolve_calendar_projection_authority(text) from public,anon,authenticated;
revoke all on function public.rollback_calendar_family(uuid,uuid,bigint,text,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.claim_calendar_projection_events(uuid,integer,integer) from public,anon,authenticated;

grant execute on function public.begin_calendar_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint) to authenticated;
grant execute on function public.stage_calendar_items(uuid,uuid,jsonb) to authenticated;
grant execute on function public.confirm_calendar_cutover(uuid,uuid,text,bigint) to authenticated;
grant execute on function public.put_calendar_document(uuid,uuid,bigint,text,text,bigint,integer,jsonb,text,bigint) to authenticated;
grant execute on function public.list_calendar_document_versions(uuid,text) to authenticated;
grant execute on function public.export_calendar_document_version(uuid,text,bigint) to authenticated;
grant execute on function public.restore_calendar_document_version(uuid,uuid,bigint,text,bigint,bigint) to authenticated;
grant execute on function public.compare_calendar_document_versions(uuid,text,bigint,bigint) to authenticated;
grant execute on function public.preview_calendar_device_enrollment(uuid) to authenticated;
grant execute on function public.enroll_calendar_device(uuid,uuid,uuid,bigint,text,text) to authenticated;
grant execute on function public.remove_calendar_device(uuid,uuid,uuid,bigint) to authenticated;
grant execute on function public.calendar_projection_status(uuid) to authenticated;
grant execute on function public.list_calendar_projection_incidents(uuid) to authenticated;
grant execute on function public.replay_calendar_projection_event(uuid,uuid,bigint,uuid) to authenticated;
grant execute on function public.rollback_calendar_family(uuid,uuid,bigint,text,jsonb,boolean) to authenticated;
grant execute on function public.claim_calendar_projection_events(uuid,integer,integer) to service_role;
grant execute on function public.fail_calendar_projection_event(uuid,uuid,text,text) to service_role;
grant execute on function public.resolve_calendar_projection_authority(text) to service_role;
