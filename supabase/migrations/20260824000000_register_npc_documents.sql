-- Slice 11D: register only the campaign NPC roster in the durable DM framework.
-- NPCs are DM-private, so this family deliberately registers no projection kind:
-- the projection outbox and incident family checks stay narrow and reject 'npc'
-- rows structurally. NPC documents keep the legacy store's persistence version 4
-- as their schema version, so staging and CAS accept schema version 4 only.

alter table public.campaign_documents drop constraint campaign_documents_family_check;
alter table public.campaign_documents add constraint campaign_documents_family_check check (family in ('campaign_settings','calendar','magic_item','npc'));
alter table private.campaign_document_versions drop constraint campaign_document_versions_family_check;
alter table private.campaign_document_versions add constraint campaign_document_versions_family_check check (family in ('campaign_settings','calendar','magic_item','npc'));
alter table private.campaign_document_recovery_receipts drop constraint campaign_document_recovery_receipts_family_check;
alter table private.campaign_document_recovery_receipts add constraint campaign_document_recovery_receipts_family_check check (family in ('campaign_settings','calendar','magic_item','npc'));
alter table private.campaign_document_manifests drop constraint campaign_document_manifests_family_check;
alter table private.campaign_document_manifests add constraint campaign_document_manifests_family_check check (family in ('campaign_settings','calendar','magic_item','npc'));
alter table private.campaign_document_staging_runs drop constraint campaign_document_staging_runs_family_check;
alter table private.campaign_document_staging_runs add constraint campaign_document_staging_runs_family_check check (family in ('campaign_settings','calendar','magic_item','npc'));
alter table private.campaign_family_cutover_generations drop constraint campaign_family_cutover_generations_family_check;
alter table private.campaign_family_cutover_generations add constraint campaign_family_cutover_generations_family_check check (family in ('campaign_settings','calendar','magic_item','npc'));
alter table private.campaign_family_device_enrollments drop constraint campaign_family_device_enrollments_family_check;
alter table private.campaign_family_device_enrollments add constraint campaign_family_device_enrollments_family_check check (family in ('campaign_settings','calendar','magic_item','npc'));

create function private.require_npc_owner(p_campaign_id uuid,p_expected_epoch bigint,p_required_authority text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_authority public.campaign_authority_records%rowtype;
begin
  if v_actor is null then raise exception using errcode='42501',message='authentication is required'; end if;
  if not exists(select 1 from public.campaigns c where c.id=p_campaign_id and c.owner_id=v_actor and c.ownership_state='owner_verified' and c.deleted_at is null)
  then raise exception using errcode='42501',message='campaign owner authorization is required'; end if;
  select * into v_authority from public.campaign_authority_records a
  where a.campaign_id=p_campaign_id and a.axis='durable_family' and a.family='npc' for update;
  if not found then raise exception using errcode='55000',message='npc authority is missing'; end if;
  if v_authority.epoch<>p_expected_epoch then raise exception using errcode='40001',message='stale npc epoch'; end if;
  if v_authority.authority<>p_required_authority then raise exception using errcode='55000',message='npc authority is not '||p_required_authority; end if;
  return v_actor;
end; $$;

-- Mirrors validateNpcPayload in src/lib/durableDm/npcFamily.ts exactly: the same
-- 34-key allowlist, the same required/optional split (absent or explicit null is
-- accepted for every optional field), and the same stable-child-id contract.
create function private.valid_npc_payload(p_payload jsonb) returns boolean
language plpgsql immutable security definer set search_path = '' as $$
declare v_entry jsonb; v_key text;
begin
  if pg_catalog.jsonb_typeof(p_payload) is distinct from 'object' then return false; end if;
  if p_payload - array['name','description','armorClass','maxHp','currentHp','tempHp','tempAc','speed','monsterStatBlock','bestiarySourceId','loreHtml','xp','avatarUrl','group','tags','hitDice','deathSaves','initiativeModifier','proficiencyBonus','inventory','currency','spellcasting','resources','abilityUsage','collapsedSpellSections','lastDetailTab','passivePerception','passiveInsight','passiveInvestigation','abilityScores','traits','actions','createdAt','updatedAt'] <> '{}'::jsonb
  then return false; end if;
  if pg_catalog.jsonb_typeof(p_payload->'name') is distinct from 'string' or length(p_payload->>'name') not between 1 and 1000
    or pg_catalog.jsonb_typeof(p_payload->'maxHp') is distinct from 'number'
    or pg_catalog.jsonb_typeof(p_payload->'speed') is distinct from 'string' or length(p_payload->>'speed')>100
    or pg_catalog.jsonb_typeof(p_payload->'createdAt') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_payload->'updatedAt') is distinct from 'string'
  then return false; end if;
  if not ((pg_catalog.jsonb_typeof(p_payload->'armorClass')='string' and length(p_payload->>'armorClass')<=100)
    or pg_catalog.jsonb_typeof(p_payload->'armorClass')='number')
  then return false; end if;
  if (p_payload ? 'description' and pg_catalog.jsonb_typeof(p_payload->'description') not in ('string','null'))
    or (p_payload ? 'bestiarySourceId' and pg_catalog.jsonb_typeof(p_payload->'bestiarySourceId') not in ('string','null'))
    or (p_payload ? 'loreHtml' and pg_catalog.jsonb_typeof(p_payload->'loreHtml') not in ('string','null'))
    or (p_payload ? 'avatarUrl' and pg_catalog.jsonb_typeof(p_payload->'avatarUrl') not in ('string','null'))
    or (p_payload ? 'group' and pg_catalog.jsonb_typeof(p_payload->'group') not in ('string','null'))
  then return false; end if;
  if p_payload ? 'lastDetailTab' and pg_catalog.jsonb_typeof(p_payload->'lastDetailTab')<>'null' then
    if pg_catalog.jsonb_typeof(p_payload->'lastDetailTab')<>'string' or length(p_payload->>'lastDetailTab')>100 then return false; end if;
  end if;
  if p_payload ? 'tempAc' and pg_catalog.jsonb_typeof(p_payload->'tempAc')<>'null' then
    if not ((pg_catalog.jsonb_typeof(p_payload->'tempAc')='string' and length(p_payload->>'tempAc')<=100)
      or pg_catalog.jsonb_typeof(p_payload->'tempAc')='number') then return false; end if;
  end if;
  foreach v_key in array array['currentHp','tempHp','xp','initiativeModifier','proficiencyBonus','passivePerception','passiveInsight','passiveInvestigation'] loop
    if p_payload ? v_key and pg_catalog.jsonb_typeof(p_payload->v_key) not in ('number','null') then return false; end if;
  end loop;
  foreach v_key in array array['hitDice','deathSaves','currency','abilityScores','abilityUsage'] loop
    if p_payload ? v_key and pg_catalog.jsonb_typeof(p_payload->v_key) not in ('object','null') then return false; end if;
  end loop;
  foreach v_key in array array['tags','collapsedSpellSections','traits','actions'] loop
    if p_payload ? v_key and pg_catalog.jsonb_typeof(p_payload->v_key)<>'null' then
      if pg_catalog.jsonb_typeof(p_payload->v_key)<>'array' then return false; end if;
      if exists(select 1 from pg_catalog.jsonb_array_elements(p_payload->v_key) e where pg_catalog.jsonb_typeof(e.value)<>'string') then return false; end if;
    end if;
  end loop;
  if p_payload ? 'monsterStatBlock' and pg_catalog.jsonb_typeof(p_payload->'monsterStatBlock')<>'null' then
    if pg_catalog.jsonb_typeof(p_payload->'monsterStatBlock')<>'object' then return false; end if;
    foreach v_key in array array['traits','actions','reactions','bonusActions','lairActions'] loop
      if (p_payload->'monsterStatBlock') ? v_key and pg_catalog.jsonb_typeof(p_payload->'monsterStatBlock'->v_key)<>'null' then
        if pg_catalog.jsonb_typeof(p_payload->'monsterStatBlock'->v_key)<>'array' then return false; end if;
        if exists(select 1 from pg_catalog.jsonb_array_elements(p_payload->'monsterStatBlock'->v_key) e where pg_catalog.jsonb_typeof(e.value)<>'object') then return false; end if;
      end if;
    end loop;
  end if;
  foreach v_key in array array['inventory','resources'] loop
    if p_payload ? v_key and pg_catalog.jsonb_typeof(p_payload->v_key)<>'null' then
      if pg_catalog.jsonb_typeof(p_payload->v_key)<>'array' then return false; end if;
      for v_entry in select value from pg_catalog.jsonb_array_elements(p_payload->v_key) loop
        if pg_catalog.jsonb_typeof(v_entry) is distinct from 'object' or pg_catalog.jsonb_typeof(v_entry->'id') is distinct from 'string' or length(v_entry->>'id') not between 1 and 255 then return false; end if;
      end loop;
      if exists(select 1 from pg_catalog.jsonb_array_elements(p_payload->v_key) e group by e.value->>'id' having count(*)>1) then return false; end if;
    end if;
  end loop;
  if p_payload ? 'spellcasting' and pg_catalog.jsonb_typeof(p_payload->'spellcasting')<>'null' then
    if pg_catalog.jsonb_typeof(p_payload->'spellcasting')<>'object' or pg_catalog.jsonb_typeof(p_payload->'spellcasting'->'spells') is distinct from 'array' then return false; end if;
    for v_entry in select value from pg_catalog.jsonb_array_elements(p_payload->'spellcasting'->'spells') loop
      if pg_catalog.jsonb_typeof(v_entry) is distinct from 'object' or pg_catalog.jsonb_typeof(v_entry->'id') is distinct from 'string' or length(v_entry->>'id') not between 1 and 255 then return false; end if;
    end loop;
    if exists(select 1 from pg_catalog.jsonb_array_elements(p_payload->'spellcasting'->'spells') e group by e.value->>'id' having count(*)>1) then return false; end if;
  end if;
  return true;
end; $$;

create function private.npc_generation(p_campaign_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'legacyId',d.legacy_id,'serverVersion',d.server_version,'schemaVersion',d.schema_version,
    'payloadFingerprint',d.payload_fingerprint,'tombstoned',d.tombstoned
  ) order by d.legacy_id),'[]'::jsonb) into v_result
  from public.campaign_documents d where d.campaign_id=p_campaign_id and d.family='npc';
  return v_result;
end; $$;

create function private.npc_preview_fingerprint(p_campaign_id uuid,p_epoch bigint) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  return private.campaign_document_hash(pg_catalog.jsonb_build_object(
    'campaignId',p_campaign_id,'family','npc','epoch',p_epoch,
    'documents',private.npc_generation(p_campaign_id)
  ));
end; $$;

create function public.begin_npc_staging(
  p_mutation_id uuid,p_campaign_id uuid,p_device_id uuid,p_expected_epoch bigint,
  p_manifest_fingerprint text,p_recovery_manifest_hash text,p_recovery_receipt_hash text,
  p_record_count integer,p_total_bytes bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_manifest_id uuid; v_run_id uuid; v_result jsonb;
begin
  if p_mutation_id is null or p_device_id is null or p_manifest_fingerprint !~ '^[a-f0-9]{64}$'
    or p_recovery_manifest_hash !~ '^[a-f0-9]{64}$' or p_recovery_receipt_hash<>p_recovery_manifest_hash
    or p_record_count not between 0 and 2000 or p_total_bytes not between 0 and 5242880
  then raise exception using errcode='22023',message='invalid npc staging request'; end if;
  v_actor:=private.require_npc_owner(p_campaign_id,p_expected_epoch,'legacy');
  v_hash:=private.campaign_document_request_hash(pg_catalog.jsonb_build_object('family','npc','campaignId',p_campaign_id,'deviceId',p_device_id,'epoch',p_expected_epoch,'manifest',p_manifest_fingerprint,'recovery',p_recovery_manifest_hash,'count',p_record_count,'bytes',p_total_bytes));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'begin_staging' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID reuse mismatch'; end if; return v_existing.result; end if;
  insert into private.campaign_document_recovery_receipts(actor_id,campaign_id,family,device_id,recovery_manifest_hash,receipt_hash)
  values(v_actor,p_campaign_id,'npc',p_device_id,p_recovery_manifest_hash,p_recovery_receipt_hash) on conflict do nothing;
  insert into private.campaign_document_manifests(campaign_id,family,device_id,cutover_epoch,fingerprint,record_count,total_bytes,manifest,blocker_count,created_by)
  values(p_campaign_id,'npc',p_device_id,p_expected_epoch,p_manifest_fingerprint,p_record_count,p_total_bytes,pg_catalog.jsonb_build_object('fingerprint',p_manifest_fingerprint,'recordCount',p_record_count,'totalBytes',p_total_bytes),0,v_actor)
  on conflict(campaign_id,family,fingerprint) do update set fingerprint=excluded.fingerprint returning id into v_manifest_id;
  v_run_id:=extensions.gen_random_uuid();
  insert into private.campaign_document_staging_runs(id,campaign_id,family,device_id,expected_epoch,manifest_id,recovery_manifest_hash,state,created_by)
  values(v_run_id,p_campaign_id,'npc',p_device_id,p_expected_epoch,v_manifest_id,p_recovery_manifest_hash,'staging',v_actor);
  v_result:=pg_catalog.jsonb_build_object('runId',v_run_id,'state','staging','manifestFingerprint',p_manifest_fingerprint);
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'begin_staging',v_hash,v_result);
  return v_result;
end; $$;

create function public.stage_npc_items(p_mutation_id uuid,p_run_id uuid,p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_run private.campaign_document_staging_runs%rowtype; v_manifest private.campaign_document_manifests%rowtype; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_item jsonb; v_count integer; v_bytes bigint; v_result jsonb; v_canonical jsonb;
begin
  if v_actor is null or p_mutation_id is null or pg_catalog.jsonb_typeof(p_items)<>'array' or pg_catalog.jsonb_array_length(p_items) not between 0 and 2000 then raise exception using errcode='22023',message='invalid npc staging items'; end if;
  if exists(select 1 from pg_catalog.jsonb_array_elements(p_items) e group by e.value->>'legacyId' having count(*)>1) then raise exception using errcode='22023',message='duplicate npc legacy id'; end if;
  v_hash:=private.campaign_document_request_hash(pg_catalog.jsonb_build_object('family','npc','runId',p_run_id,'items',p_items));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'stage_items' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID reuse mismatch'; end if; return v_existing.result; end if;
  select * into v_run from private.campaign_document_staging_runs where id=p_run_id and family='npc' and created_by=v_actor and state in ('staging','validated') for update;
  if not found then raise exception using errcode='42501',message='npc staging run is unavailable'; end if;
  perform private.require_npc_owner(v_run.campaign_id,v_run.expected_epoch,'legacy');
  delete from private.campaign_document_staging_items where run_id=p_run_id;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_items) loop
    v_canonical:=case when coalesce((v_item->>'tombstoned')::boolean,false) then pg_catalog.jsonb_build_object('legacyId',v_item->>'legacyId','tombstoned',true) else v_item->'payload' end;
    if pg_catalog.jsonb_typeof(v_item)<>'object' or length(v_item->>'legacyId') not between 1 and 255 or (v_item->>'schemaVersion')::integer<>4
      or (v_item->>'payloadFingerprint') !~ '^[a-f0-9]{64}$'
      or (not coalesce((v_item->>'tombstoned')::boolean,false) and not private.valid_npc_payload(v_item->'payload'))
      or pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(v_canonical),'UTF8'))>262144
      or (v_item->>'payloadFingerprint')<>private.campaign_document_hash(v_canonical)
    then raise exception using errcode='22023',message='invalid or oversized npc document'; end if;
    insert into private.campaign_document_staging_items(run_id,legacy_id,schema_version,payload,payload_fingerprint,tombstoned,byte_count)
    values(p_run_id,v_item->>'legacyId',4,case when coalesce((v_item->>'tombstoned')::boolean,false) then null else v_item->'payload' end,v_item->>'payloadFingerprint',coalesce((v_item->>'tombstoned')::boolean,false),greatest(1,pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(v_canonical),'UTF8'))));
  end loop;
  select count(*),coalesce(sum(byte_count),0) into v_count,v_bytes from private.campaign_document_staging_items where run_id=p_run_id;
  select * into v_manifest from private.campaign_document_manifests where id=v_run.manifest_id;
  if v_count<>v_manifest.record_count or v_bytes<>v_manifest.total_bytes then raise exception using errcode='22023',message='staged npcs do not match manifest'; end if;
  update private.campaign_document_staging_runs set state='validated' where id=p_run_id;
  v_result:=pg_catalog.jsonb_build_object('runId',p_run_id,'state','validated','itemCount',v_count,'totalBytes',v_bytes);
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'stage_items',v_hash,v_result);
  return v_result;
end; $$;

create function public.confirm_npc_cutover(p_mutation_id uuid,p_run_id uuid,p_manifest_fingerprint text,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_run private.campaign_document_staging_runs%rowtype; v_manifest private.campaign_document_manifests%rowtype; v_item private.campaign_document_staging_items%rowtype; v_doc public.campaign_documents%rowtype; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_count integer; v_result jsonb; v_preview text;
begin
  if v_actor is null then raise exception using errcode='42501',message='authentication required'; end if;
  v_hash:=private.campaign_document_request_hash(pg_catalog.jsonb_build_object('family','npc','runId',p_run_id,'manifest',p_manifest_fingerprint,'epoch',p_expected_epoch));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'confirm_cutover' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID reuse mismatch'; end if; return v_existing.result; end if;
  select * into v_run from private.campaign_document_staging_runs where id=p_run_id and family='npc' and created_by=v_actor and state='validated' for update;
  if not found then raise exception using errcode='55000',message='validated npc staging run required'; end if;
  perform private.require_npc_owner(v_run.campaign_id,p_expected_epoch,'legacy');
  select * into v_manifest from private.campaign_document_manifests where id=v_run.manifest_id;
  if v_manifest.fingerprint<>p_manifest_fingerprint or v_manifest.blocker_count<>0 then raise exception using errcode='40001',message='exact npc manifest confirmation required'; end if;
  select count(*) into v_count from private.campaign_document_staging_items where run_id=p_run_id;
  if v_count<>v_manifest.record_count then raise exception using errcode='55000',message='complete npc generation required'; end if;
  for v_item in select * from private.campaign_document_staging_items where run_id=p_run_id order by legacy_id loop
    insert into public.campaign_documents(campaign_id,family,legacy_id,payload,schema_version,server_version,payload_fingerprint,tombstoned,last_mutation_id)
    values(v_run.campaign_id,'npc',v_item.legacy_id,case when v_item.tombstoned then null else v_item.payload end,4,1,v_item.payload_fingerprint,v_item.tombstoned,p_mutation_id) returning * into v_doc;
    insert into private.campaign_document_versions(campaign_document_id,campaign_id,family,legacy_id,server_version,cutover_epoch,schema_version,payload,payload_fingerprint,tombstoned,actor_id,mutation_id,base_server_version)
    values(v_doc.id,v_doc.campaign_id,'npc',v_doc.legacy_id,1,p_expected_epoch+1,4,v_doc.payload,v_doc.payload_fingerprint,v_doc.tombstoned,v_actor,p_mutation_id,0);
  end loop;
  update public.campaign_authority_records set authority='postgres',epoch=p_expected_epoch+1,updated_at=statement_timestamp()
  where campaign_id=v_run.campaign_id and axis='durable_family' and family='npc' and authority='legacy' and epoch=p_expected_epoch;
  if not found then raise exception using errcode='40001',message='npc authority changed during cutover'; end if;
  v_preview:=private.npc_preview_fingerprint(v_run.campaign_id,p_expected_epoch+1);
  insert into private.campaign_family_device_enrollments(campaign_id,family,device_id,owner_id,cutover_epoch,preview_fingerprint,state)
  values(v_run.campaign_id,'npc',v_run.device_id,v_actor,p_expected_epoch+1,v_preview,'enrolled');
  insert into private.campaign_family_cutover_generations(campaign_id,family,epoch,authority,manifest_fingerprint,current_generation,projection_journal_reconciled,verified_complete,created_by)
  values(v_run.campaign_id,'npc',p_expected_epoch+1,'postgres',p_manifest_fingerprint,pg_catalog.jsonb_build_object('runId',p_run_id,'recordCount',v_count),true,true,v_actor);
  update private.campaign_document_staging_runs set state='finalized',finalized_at=statement_timestamp() where id=p_run_id;
  v_result:=pg_catalog.jsonb_build_object('campaignId',v_run.campaign_id,'family','npc','authority','postgres','epoch',p_expected_epoch+1,'recordCount',v_count,'manifestFingerprint',p_manifest_fingerprint,'previewFingerprint',v_preview);
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'confirm_cutover',v_hash,v_result);
  return v_result;
end; $$;

create function public.put_npc_document(
  p_mutation_id uuid,p_campaign_id uuid,p_expected_epoch bigint,p_legacy_id text,p_operation text,
  p_expected_server_version bigint,p_schema_version integer,p_payload jsonb,p_payload_fingerprint text,
  p_restore_source_version bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_doc public.campaign_documents%rowtype; v_next bigint; v_tombstone boolean; v_result jsonb;
begin
  if p_operation not in ('create','replace','delete') or length(p_legacy_id) not between 1 and 255 or p_schema_version<>4 or p_payload_fingerprint !~ '^[a-f0-9]{64}$'
    or (p_operation<>'delete' and (not private.valid_npc_payload(p_payload) or pg_column_size(p_payload)>262144))
  then raise exception using errcode='22023',message='invalid npc mutation'; end if;
  if p_payload_fingerprint<>private.campaign_document_hash(case when p_operation='delete' then pg_catalog.jsonb_build_object('legacyId',p_legacy_id,'tombstoned',true) else p_payload end)
  then raise exception using errcode='22023',message='npc fingerprint mismatch'; end if;
  v_actor:=private.require_npc_owner(p_campaign_id,p_expected_epoch,'postgres');
  v_hash:=private.campaign_document_request_hash(pg_catalog.jsonb_build_object('family','npc','campaignId',p_campaign_id,'epoch',p_expected_epoch,'legacyId',p_legacy_id,'operation',p_operation,'base',p_expected_server_version,'schema',p_schema_version,'payload',p_payload,'fingerprint',p_payload_fingerprint,'restoreSourceVersion',p_restore_source_version));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'put_document' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID reuse mismatch'; end if; return v_existing.result; end if;
  select * into v_doc from public.campaign_documents where campaign_id=p_campaign_id and family='npc' and legacy_id=p_legacy_id for update;
  if not found then
    if p_operation<>'create' or p_expected_server_version<>0 then raise exception using errcode='40001',message='npc server version conflict'; end if;
    v_next:=1; v_tombstone:=false;
    insert into public.campaign_documents(campaign_id,family,legacy_id,payload,schema_version,server_version,payload_fingerprint,tombstoned,last_mutation_id)
    values(p_campaign_id,'npc',p_legacy_id,p_payload,4,v_next,p_payload_fingerprint,false,p_mutation_id) returning * into v_doc;
  else
    if v_doc.server_version<>p_expected_server_version then raise exception using errcode='40001',message='npc server version conflict'; end if;
    if v_doc.tombstoned and p_operation<>'delete' and p_restore_source_version is null then raise exception using errcode='55000',message='npc tombstone cannot be resurrected without explicit history restore'; end if;
    v_next:=v_doc.server_version+1; v_tombstone:=p_operation='delete';
    update public.campaign_documents set payload=case when v_tombstone then null else p_payload end,server_version=v_next,payload_fingerprint=p_payload_fingerprint,tombstoned=v_tombstone,last_mutation_id=p_mutation_id,updated_at=statement_timestamp() where id=v_doc.id returning * into v_doc;
  end if;
  insert into private.campaign_document_versions(campaign_document_id,campaign_id,family,legacy_id,server_version,cutover_epoch,schema_version,payload,payload_fingerprint,tombstoned,actor_id,mutation_id,base_server_version)
  values(v_doc.id,p_campaign_id,'npc',p_legacy_id,v_next,p_expected_epoch,4,v_doc.payload,p_payload_fingerprint,v_doc.tombstoned,v_actor,p_mutation_id,p_expected_server_version);
  v_result:=pg_catalog.jsonb_build_object('documentId',v_doc.id,'campaignId',p_campaign_id,'family','npc','legacyId',p_legacy_id,'serverVersion',v_next,'cutoverEpoch',p_expected_epoch,'payloadFingerprint',p_payload_fingerprint,'tombstoned',v_doc.tombstoned,'cloudSaved',true,'playerView','not-applicable');
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'put_document',v_hash,v_result);
  return v_result;
end; $$;

create function public.list_npc_document_versions(p_campaign_id uuid,p_legacy_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_result jsonb;
begin
  if not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and deleted_at is null) then raise exception using errcode='42501',message='campaign owner authorization required'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('versionId',v.id,'serverVersion',v.server_version,'cutoverEpoch',v.cutover_epoch,'schemaVersion',v.schema_version,'payloadFingerprint',v.payload_fingerprint,'tombstoned',v.tombstoned,'mutationId',v.mutation_id,'acceptedAt',v.accepted_at) order by v.server_version desc),'[]'::jsonb) into v_result
  from private.campaign_document_versions v where v.campaign_id=p_campaign_id and v.family='npc' and v.legacy_id=p_legacy_id;
  return pg_catalog.jsonb_build_object('campaignId',p_campaign_id,'family','npc','legacyId',p_legacy_id,'versions',v_result);
end; $$;

create function public.export_npc_document_version(p_campaign_id uuid,p_legacy_id text,p_server_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v private.campaign_document_versions%rowtype;
begin
  if not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and deleted_at is null) then raise exception using errcode='42501',message='campaign owner authorization required'; end if;
  select * into v from private.campaign_document_versions where campaign_id=p_campaign_id and family='npc' and legacy_id=p_legacy_id and server_version=p_server_version;
  if not found then raise exception using errcode='P0002',message='npc version not found'; end if;
  return pg_catalog.jsonb_build_object('serverVersion',v.server_version,'schemaVersion',v.schema_version,'payloadFingerprint',v.payload_fingerprint,'tombstoned',v.tombstoned,'payload',v.payload);
end; $$;

create function public.restore_npc_document_version(p_mutation_id uuid,p_campaign_id uuid,p_expected_epoch bigint,p_legacy_id text,p_source_version bigint,p_expected_server_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_source private.campaign_document_versions%rowtype;
begin
  perform private.require_npc_owner(p_campaign_id,p_expected_epoch,'postgres');
  select * into v_source from private.campaign_document_versions where campaign_id=p_campaign_id and family='npc' and legacy_id=p_legacy_id and server_version=p_source_version;
  if not found or v_source.tombstoned then raise exception using errcode='55000',message='restorable npc version required'; end if;
  return public.put_npc_document(p_mutation_id,p_campaign_id,p_expected_epoch,p_legacy_id,'replace',p_expected_server_version,4,v_source.payload,v_source.payload_fingerprint,p_source_version);
end; $$;

create function public.compare_npc_document_versions(p_campaign_id uuid,p_legacy_id text,p_left bigint,p_right bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_left jsonb; v_right jsonb;
begin
  v_left:=public.export_npc_document_version(p_campaign_id,p_legacy_id,p_left);
  v_right:=public.export_npc_document_version(p_campaign_id,p_legacy_id,p_right);
  return pg_catalog.jsonb_build_object('left',v_left-'payload','right',v_right-'payload','identical',(v_left->>'payloadFingerprint')=(v_right->>'payloadFingerprint') and (v_left->>'tombstoned')=(v_right->>'tombstoned'));
end; $$;

create function public.preview_npc_device_enrollment(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_epoch bigint; v_count integer; v_documents jsonb;
begin
  if not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and deleted_at is null) then raise exception using errcode='42501',message='campaign owner authorization required'; end if;
  select epoch into v_epoch from public.campaign_authority_records where campaign_id=p_campaign_id and axis='durable_family' and family='npc' and authority='postgres';
  if not found then return pg_catalog.jsonb_build_object('authority','legacy'); end if;
  select count(*),coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'legacyId',d.legacy_id,'serverVersion',d.server_version,'schemaVersion',d.schema_version,
    'payloadFingerprint',d.payload_fingerprint,'tombstoned',d.tombstoned,'payload',d.payload
  ) order by d.legacy_id),'[]'::jsonb) into v_count,v_documents
  from public.campaign_documents d where d.campaign_id=p_campaign_id and d.family='npc';
  return pg_catalog.jsonb_build_object(
    'authority','postgres','epoch',v_epoch,
    'previewFingerprint',private.npc_preview_fingerprint(p_campaign_id,v_epoch),
    'recordCount',v_count,'documents',v_documents
  );
end; $$;

create function public.enroll_npc_device(p_mutation_id uuid,p_campaign_id uuid,p_device_id uuid,p_expected_epoch bigint,p_preview_fingerprint text,p_legacy_candidate_fingerprint text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_preview jsonb; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_result jsonb;
begin
  if p_device_id is null or p_preview_fingerprint !~ '^[a-f0-9]{64}$' or (p_legacy_candidate_fingerprint is not null and p_legacy_candidate_fingerprint !~ '^[a-f0-9]{64}$') then raise exception using errcode='22023',message='invalid npc enrollment'; end if;
  v_actor:=private.require_npc_owner(p_campaign_id,p_expected_epoch,'postgres');
  v_hash:=private.campaign_document_request_hash(pg_catalog.jsonb_build_object('family','npc','campaignId',p_campaign_id,'deviceId',p_device_id,'epoch',p_expected_epoch,'preview',p_preview_fingerprint,'legacy',p_legacy_candidate_fingerprint));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'enroll_device' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID reuse mismatch'; end if; return v_existing.result; end if;
  v_preview:=public.preview_npc_device_enrollment(p_campaign_id);
  if v_preview->>'previewFingerprint'<>p_preview_fingerprint then raise exception using errcode='40001',message='npc enrollment preview changed'; end if;
  insert into private.campaign_family_device_enrollments(campaign_id,family,device_id,owner_id,cutover_epoch,preview_fingerprint,legacy_candidate_fingerprint,state)
  values(p_campaign_id,'npc',p_device_id,v_actor,p_expected_epoch,p_preview_fingerprint,p_legacy_candidate_fingerprint,'enrolled')
  on conflict(campaign_id,family,device_id,owner_id) do update set cutover_epoch=excluded.cutover_epoch,preview_fingerprint=excluded.preview_fingerprint,legacy_candidate_fingerprint=excluded.legacy_candidate_fingerprint,state='enrolled',removed_at=null;
  v_result:=pg_catalog.jsonb_build_object('campaignId',p_campaign_id,'family','npc','deviceId',p_device_id,'epoch',p_expected_epoch,'state','enrolled');
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'enroll_device',v_hash,v_result);
  return v_result;
end; $$;

create function public.remove_npc_device(p_mutation_id uuid,p_campaign_id uuid,p_device_id uuid,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_result jsonb;
begin
  v_actor:=private.require_npc_owner(p_campaign_id,p_expected_epoch,'postgres');
  v_hash:=private.campaign_document_request_hash(pg_catalog.jsonb_build_object('family','npc','campaignId',p_campaign_id,'deviceId',p_device_id,'epoch',p_expected_epoch));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'remove_device' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID reuse mismatch'; end if; return v_existing.result; end if;
  update private.campaign_family_device_enrollments set state='removed',removed_at=statement_timestamp() where campaign_id=p_campaign_id and family='npc' and device_id=p_device_id and owner_id=v_actor;
  if not found then raise exception using errcode='55000',message='exact enrolled npc device required'; end if;
  v_result:=pg_catalog.jsonb_build_object('campaignId',p_campaign_id,'family','npc','deviceId',p_device_id,'epoch',p_expected_epoch,'state','removed');
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'remove_device',v_hash,v_result);
  return v_result;
end; $$;

create function public.rollback_npc_family(p_mutation_id uuid,p_campaign_id uuid,p_expected_epoch bigint,p_preview_fingerprint text,p_current_generation jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_preview jsonb; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_result jsonb;
begin
  if p_preview_fingerprint !~ '^[a-f0-9]{64}$' or pg_catalog.jsonb_typeof(p_current_generation)<>'object' then raise exception using errcode='55000',message='verified current npc generation required'; end if;
  v_actor:=private.require_npc_owner(p_campaign_id,p_expected_epoch,'postgres');
  v_hash:=private.campaign_document_request_hash(pg_catalog.jsonb_build_object('family','npc','campaignId',p_campaign_id,'epoch',p_expected_epoch,'preview',p_preview_fingerprint,'generation',p_current_generation));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'rollback_family' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID reuse mismatch'; end if; return v_existing.result; end if;
  v_preview:=public.preview_npc_device_enrollment(p_campaign_id);
  if v_preview->>'previewFingerprint'<>p_preview_fingerprint
    or p_current_generation->'documents' is distinct from private.npc_generation(p_campaign_id)
    or (p_current_generation->>'recordCount')::integer<>(v_preview->>'recordCount')::integer
  then raise exception using errcode='40001',message='verified npc generation changed'; end if;
  if exists(select 1 from private.campaign_document_projection_outbox where campaign_id=p_campaign_id and family='npc' and state in ('queued','leased','retry')) then raise exception using errcode='55000',message='npc projection journal incomplete'; end if;
  update public.campaign_authority_records set authority='legacy',epoch=p_expected_epoch+1,updated_at=statement_timestamp() where campaign_id=p_campaign_id and axis='durable_family' and family='npc' and authority='postgres' and epoch=p_expected_epoch;
  insert into private.campaign_family_cutover_generations(campaign_id,family,epoch,authority,manifest_fingerprint,current_generation,projection_journal_reconciled,verified_complete,created_by)
  values(p_campaign_id,'npc',p_expected_epoch+1,'legacy_restored',p_preview_fingerprint,p_current_generation,true,true,v_actor);
  v_result:=pg_catalog.jsonb_build_object('campaignId',p_campaign_id,'family','npc','authority','legacy','epoch',p_expected_epoch+1,'currentGeneration',v_preview);
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'rollback_family',v_hash,v_result);
  return v_result;
end; $$;

revoke all on function private.require_npc_owner(uuid,bigint,text) from public,anon,authenticated;
revoke all on function private.valid_npc_payload(jsonb) from public,anon,authenticated;
revoke all on function private.npc_generation(uuid) from public,anon,authenticated;
revoke all on function private.npc_preview_fingerprint(uuid,bigint) from public,anon,authenticated;

revoke all on function public.begin_npc_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint) from public,anon,authenticated;
revoke all on function public.stage_npc_items(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.confirm_npc_cutover(uuid,uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.put_npc_document(uuid,uuid,bigint,text,text,bigint,integer,jsonb,text,bigint) from public,anon,authenticated;
revoke all on function public.list_npc_document_versions(uuid,text) from public,anon,authenticated;
revoke all on function public.export_npc_document_version(uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.restore_npc_document_version(uuid,uuid,bigint,text,bigint,bigint) from public,anon,authenticated;
revoke all on function public.compare_npc_document_versions(uuid,text,bigint,bigint) from public,anon,authenticated;
revoke all on function public.preview_npc_device_enrollment(uuid) from public,anon,authenticated;
revoke all on function public.enroll_npc_device(uuid,uuid,uuid,bigint,text,text) from public,anon,authenticated;
revoke all on function public.remove_npc_device(uuid,uuid,uuid,bigint) from public,anon,authenticated;
revoke all on function public.rollback_npc_family(uuid,uuid,bigint,text,jsonb) from public,anon,authenticated;

grant execute on function public.begin_npc_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint) to authenticated;
grant execute on function public.stage_npc_items(uuid,uuid,jsonb) to authenticated;
grant execute on function public.confirm_npc_cutover(uuid,uuid,text,bigint) to authenticated;
grant execute on function public.put_npc_document(uuid,uuid,bigint,text,text,bigint,integer,jsonb,text,bigint) to authenticated;
grant execute on function public.list_npc_document_versions(uuid,text) to authenticated;
grant execute on function public.export_npc_document_version(uuid,text,bigint) to authenticated;
grant execute on function public.restore_npc_document_version(uuid,uuid,bigint,text,bigint,bigint) to authenticated;
grant execute on function public.compare_npc_document_versions(uuid,text,bigint,bigint) to authenticated;
grant execute on function public.preview_npc_device_enrollment(uuid) to authenticated;
grant execute on function public.enroll_npc_device(uuid,uuid,uuid,bigint,text,text) to authenticated;
grant execute on function public.remove_npc_device(uuid,uuid,uuid,bigint) to authenticated;
grant execute on function public.rollback_npc_family(uuid,uuid,bigint,text,jsonb) to authenticated;
