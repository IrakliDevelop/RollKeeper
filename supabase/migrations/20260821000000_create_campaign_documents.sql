create table public.campaign_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  family text not null check (family = 'campaign_settings'),
  legacy_id text not null check (length(legacy_id) between 1 and 255),
  payload jsonb,
  schema_version integer not null check (schema_version between 1 and 1000),
  server_version bigint not null check (server_version >= 1),
  payload_fingerprint text not null check (payload_fingerprint ~ '^[a-f0-9]{64}$'),
  tombstoned boolean not null default false,
  last_mutation_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(campaign_id, family, legacy_id),
  check ((tombstoned and payload is null) or (not tombstoned and payload is not null))
);

create table private.campaign_document_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_document_id uuid not null references public.campaign_documents(id) on delete restrict,
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  family text not null check (family = 'campaign_settings'),
  legacy_id text not null check (length(legacy_id) between 1 and 255),
  server_version bigint not null check (server_version >= 1),
  cutover_epoch bigint not null check (cutover_epoch >= 1),
  schema_version integer not null check (schema_version between 1 and 1000),
  payload jsonb,
  payload_fingerprint text not null check (payload_fingerprint ~ '^[a-f0-9]{64}$'),
  tombstoned boolean not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  mutation_id uuid not null,
  base_server_version bigint not null check (base_server_version >= 0),
  accepted_at timestamptz not null default statement_timestamp(),
  unique(campaign_document_id, server_version),
  unique(actor_id, mutation_id),
  check ((tombstoned and payload is null) or (not tombstoned and payload is not null))
);

create table private.campaign_document_recovery_receipts (
  actor_id uuid not null references auth.users(id) on delete restrict,
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  family text not null check (family = 'campaign_settings'),
  device_id uuid not null,
  recovery_manifest_hash text not null check (recovery_manifest_hash ~ '^[a-f0-9]{64}$'),
  receipt_hash text not null check (receipt_hash ~ '^[a-f0-9]{64}$'),
  initiated_at timestamptz not null default statement_timestamp(),
  primary key(actor_id, campaign_id, family, device_id, recovery_manifest_hash)
);

create table private.campaign_document_manifests (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  family text not null check (family = 'campaign_settings'),
  device_id uuid not null,
  cutover_epoch bigint not null check (cutover_epoch >= 0),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  record_count integer not null check (record_count between 1 and 1000),
  total_bytes bigint not null check (total_bytes between 1 and 5242880),
  manifest jsonb not null,
  blocker_count integer not null default 0 check (blocker_count >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique(campaign_id, family, fingerprint)
);

create table private.campaign_document_staging_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  family text not null check (family = 'campaign_settings'),
  device_id uuid not null,
  expected_epoch bigint not null check (expected_epoch >= 0),
  manifest_id uuid not null references private.campaign_document_manifests(id) on delete restrict,
  recovery_manifest_hash text not null check (recovery_manifest_hash ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('staging','validated','finalized','cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  finalized_at timestamptz
);

create table private.campaign_document_staging_items (
  run_id uuid not null references private.campaign_document_staging_runs(id) on delete restrict,
  legacy_id text not null check (length(legacy_id) between 1 and 255),
  schema_version integer not null check (schema_version between 1 and 1000),
  payload jsonb,
  payload_fingerprint text not null check (payload_fingerprint ~ '^[a-f0-9]{64}$'),
  tombstoned boolean not null,
  byte_count integer not null check (byte_count between 1 and 262144),
  staged_at timestamptz not null default statement_timestamp(),
  primary key(run_id, legacy_id),
  check ((tombstoned and payload is null) or (not tombstoned and payload is not null))
);

create table private.campaign_document_mutation_receipts (
  actor_id uuid not null references auth.users(id) on delete restrict,
  mutation_id uuid not null,
  operation text not null check (operation in (
    'begin_staging','stage_items','confirm_cutover','put_document',
    'restore_document','enroll_device','remove_device','rollback_family',
    'repair_current','replay_projection'
  )),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key(actor_id, mutation_id)
);

create table private.campaign_family_cutover_generations (
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  family text not null check (family = 'campaign_settings'),
  epoch bigint not null check (epoch >= 1),
  authority text not null check (authority in ('postgres','legacy_restored')),
  manifest_fingerprint text not null check (manifest_fingerprint ~ '^[a-f0-9]{64}$'),
  current_generation jsonb not null,
  projection_journal_reconciled boolean not null,
  verified_complete boolean not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  primary key(campaign_id, family, epoch)
);

create table private.campaign_family_device_enrollments (
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  family text not null check (family = 'campaign_settings'),
  device_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete restrict,
  cutover_epoch bigint not null check (cutover_epoch >= 1),
  preview_fingerprint text not null check (preview_fingerprint ~ '^[a-f0-9]{64}$'),
  legacy_candidate_fingerprint text check (legacy_candidate_fingerprint is null or legacy_candidate_fingerprint ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('enrolled','removed')),
  enrolled_at timestamptz not null default statement_timestamp(),
  removed_at timestamptz,
  primary key(campaign_id, family, device_id, owner_id)
);

create table private.campaign_document_projection_outbox (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  campaign_document_version_id uuid not null references private.campaign_document_versions(id) on delete restrict,
  family text not null check (family = 'campaign_settings'),
  legacy_id text not null,
  server_version bigint not null check (server_version >= 1),
  cutover_epoch bigint not null check (cutover_epoch >= 1),
  projection_kind text not null check (projection_kind = 'campaign_settings_v1'),
  source_fingerprint text not null check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  state text not null default 'queued' check (state in ('queued','leased','retry','acknowledged','dead')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default statement_timestamp(),
  lease_owner uuid,
  lease_expires_at timestamptz,
  acknowledged_at timestamptz,
  projection_fingerprint text check (projection_fingerprint is null or projection_fingerprint ~ '^[a-f0-9]{64}$'),
  last_error_code text,
  created_at timestamptz not null default statement_timestamp(),
  unique(campaign_document_version_id, projection_kind)
);

create table private.campaign_document_projection_incidents (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references private.campaign_document_projection_outbox(id) on delete restrict,
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  family text not null check (family = 'campaign_settings'),
  incident_kind text not null check (incident_kind in ('equal_version_divergence','poison_event','retry_exhausted','stale_epoch')),
  metadata jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);

create index campaign_documents_owner_lookup_idx on public.campaign_documents(campaign_id, family, legacy_id);
create index campaign_document_versions_history_idx on private.campaign_document_versions(campaign_id, family, legacy_id, server_version desc);
create index campaign_projection_claim_idx on private.campaign_document_projection_outbox(state, available_at, created_at);

alter table public.campaign_documents enable row level security;
alter table private.campaign_document_versions enable row level security;
alter table private.campaign_document_recovery_receipts enable row level security;
alter table private.campaign_document_manifests enable row level security;
alter table private.campaign_document_staging_runs enable row level security;
alter table private.campaign_document_staging_items enable row level security;
alter table private.campaign_document_mutation_receipts enable row level security;
alter table private.campaign_family_cutover_generations enable row level security;
alter table private.campaign_family_device_enrollments enable row level security;
alter table private.campaign_document_projection_outbox enable row level security;
alter table private.campaign_document_projection_incidents enable row level security;

revoke all on table public.campaign_documents from public, anon, authenticated;
revoke all on table private.campaign_document_versions from public, anon, authenticated;
revoke all on table private.campaign_document_recovery_receipts from public, anon, authenticated;
revoke all on table private.campaign_document_manifests from public, anon, authenticated;
revoke all on table private.campaign_document_staging_runs from public, anon, authenticated;
revoke all on table private.campaign_document_staging_items from public, anon, authenticated;
revoke all on table private.campaign_document_mutation_receipts from public, anon, authenticated;
revoke all on table private.campaign_family_cutover_generations from public, anon, authenticated;
revoke all on table private.campaign_family_device_enrollments from public, anon, authenticated;
revoke all on table private.campaign_document_projection_outbox from public, anon, authenticated;
revoke all on table private.campaign_document_projection_incidents from public, anon, authenticated;

grant select on table public.campaign_documents to authenticated;
create policy campaign_documents_select_owner on public.campaign_documents for select to authenticated
using (exists(select 1 from public.campaigns c where c.id=campaign_documents.campaign_id and c.owner_id=(select auth.uid()) and c.ownership_state='owner_verified' and c.deleted_at is null));

create function private.canonical_campaign_document_json(p_value jsonb) returns text
language plpgsql stable strict set search_path = '' as $$
declare v_result text;
begin
  case jsonb_typeof(p_value)
    when 'object' then
      select '{'||coalesce(string_agg(pg_catalog.to_jsonb(e.key)::text||':'||private.canonical_campaign_document_json(e.value),',' order by e.key),'')||'}'
      into v_result from pg_catalog.jsonb_each(p_value) e;
    when 'array' then
      select '['||coalesce(string_agg(private.canonical_campaign_document_json(e.value),',' order by e.ordinality),'')||']'
      into v_result from pg_catalog.jsonb_array_elements(p_value) with ordinality e(value,ordinality);
    else v_result:=p_value::text;
  end case;
  return v_result;
end; $$;

create function private.campaign_document_hash(p_value jsonb) returns text
language sql stable strict set search_path = ''
return encode(extensions.digest(convert_to(private.canonical_campaign_document_json(p_value),'UTF8'),'sha256'),'hex');

create function private.require_campaign_settings_owner(p_campaign_id uuid, p_expected_epoch bigint, p_required_authority text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_authority public.campaign_authority_records%rowtype;
begin
  if v_actor is null then raise exception using errcode='42501',message='authentication is required'; end if;
  if not exists(select 1 from public.campaigns c where c.id=p_campaign_id and c.owner_id=v_actor and c.ownership_state='owner_verified' and c.deleted_at is null)
  then raise exception using errcode='42501',message='campaign owner authorization is required'; end if;
  select * into v_authority from public.campaign_authority_records a
  where a.campaign_id=p_campaign_id and a.axis='durable_family' and a.family='campaign_settings' for update;
  if not found then raise exception using errcode='55000',message='campaign settings authority is missing'; end if;
  if v_authority.epoch<>p_expected_epoch then raise exception using errcode='40001',message='stale campaign family epoch'; end if;
  if v_authority.authority<>p_required_authority then raise exception using errcode='55000',message='campaign family authority is not '||p_required_authority; end if;
  return v_actor;
end; $$;

create function private.campaign_document_request_hash(p_value jsonb) returns text
language sql immutable set search_path = ''
return encode(extensions.digest(convert_to(p_value::text,'UTF8'),'sha256'),'hex');

create function private.campaign_settings_has_projection(p_payload jsonb) returns boolean
language sql immutable set search_path = ''
return p_payload is not null and (p_payload ? 'stackableInspiration' or p_payload ? 'customCounterLabel' or p_payload ? 'playerCounters');

create function private.campaign_settings_projection_payload(p_payload jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare v_counters jsonb := '{}'::jsonb; v_result jsonb;
begin
  if p_payload is null then return null; end if;
  if pg_catalog.jsonb_typeof(p_payload->'playerCounters')='object' then
    select coalesce(pg_catalog.jsonb_object_agg(entry.key,entry.value order by entry.key),'{}'::jsonb)
    into v_counters
    from pg_catalog.jsonb_each(p_payload->'playerCounters') entry
    where pg_catalog.jsonb_typeof(entry.value)='number';
  end if;
  v_result:=pg_catalog.jsonb_build_object(
    'codecVersion',1,
    'settings',pg_catalog.jsonb_build_object('stackableInspiration',coalesce(p_payload->'stackableInspiration'='true'::jsonb,false)),
    'counters',pg_catalog.jsonb_build_object('counters',v_counters)
  );
  if pg_catalog.jsonb_typeof(p_payload->'customCounterLabel')='string' then
    v_result:=pg_catalog.jsonb_set(v_result,'{counters,label}',p_payload->'customCounterLabel',true);
  end if;
  return v_result;
end; $$;

create function private.reject_campaign_document_history_change() returns trigger
language plpgsql set search_path = '' as $$ begin raise exception using errcode='55000',message='campaign document history is immutable'; end; $$;
create trigger campaign_document_versions_immutable before update or delete on private.campaign_document_versions
for each row execute function private.reject_campaign_document_history_change();

create function public.begin_campaign_settings_staging(
  p_mutation_id uuid,p_campaign_id uuid,p_device_id uuid,p_expected_epoch bigint,
  p_manifest_fingerprint text,p_recovery_manifest_hash text,p_recovery_receipt_hash text,
  p_record_count integer,p_total_bytes bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_manifest_id uuid; v_run_id uuid; v_result jsonb;
begin
  if p_mutation_id is null or p_device_id is null or p_manifest_fingerprint !~ '^[a-f0-9]{64}$' or p_recovery_manifest_hash !~ '^[a-f0-9]{64}$'
    or p_recovery_receipt_hash<>p_recovery_manifest_hash or p_record_count<>1 or p_total_bytes not between 1 and 5242880
  then raise exception using errcode='22023',message='invalid campaign settings staging request'; end if;
  v_actor:=private.require_campaign_settings_owner(p_campaign_id,p_expected_epoch,'legacy');
  v_hash:=private.campaign_document_request_hash(jsonb_build_object('campaignId',p_campaign_id,'deviceId',p_device_id,'epoch',p_expected_epoch,'manifest',p_manifest_fingerprint,'recovery',p_recovery_manifest_hash,'count',p_record_count,'bytes',p_total_bytes));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'begin_staging' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID was already used with different input'; end if; return v_existing.result; end if;
  insert into private.campaign_document_recovery_receipts(actor_id,campaign_id,family,device_id,recovery_manifest_hash,receipt_hash)
  values(v_actor,p_campaign_id,'campaign_settings',p_device_id,p_recovery_manifest_hash,p_recovery_receipt_hash) on conflict do nothing;
  insert into private.campaign_document_manifests(campaign_id,family,device_id,cutover_epoch,fingerprint,record_count,total_bytes,manifest,blocker_count,created_by)
  values(p_campaign_id,'campaign_settings',p_device_id,p_expected_epoch,p_manifest_fingerprint,p_record_count,p_total_bytes,jsonb_build_object('fingerprint',p_manifest_fingerprint,'recordCount',p_record_count,'totalBytes',p_total_bytes),0,v_actor)
  on conflict(campaign_id,family,fingerprint) do update set fingerprint=excluded.fingerprint returning id into v_manifest_id;
  v_run_id:=extensions.gen_random_uuid();
  insert into private.campaign_document_staging_runs(id,campaign_id,family,device_id,expected_epoch,manifest_id,recovery_manifest_hash,state,created_by)
  values(v_run_id,p_campaign_id,'campaign_settings',p_device_id,p_expected_epoch,v_manifest_id,p_recovery_manifest_hash,'staging',v_actor);
  v_result:=jsonb_build_object('runId',v_run_id,'state','staging','manifestFingerprint',p_manifest_fingerprint);
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'begin_staging',v_hash,v_result);
  return v_result;
end; $$;

create function public.stage_campaign_settings_items(p_mutation_id uuid,p_run_id uuid,p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_run private.campaign_document_staging_runs%rowtype; v_manifest private.campaign_document_manifests%rowtype; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_item jsonb; v_count integer; v_bytes bigint; v_result jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='authentication is required'; end if;
  if p_mutation_id is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<>1 then raise exception using errcode='22023',message='invalid staging items'; end if;
  v_hash:=private.campaign_document_request_hash(jsonb_build_object('runId',p_run_id,'items',p_items));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'stage_items' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID was already used with different input'; end if; return v_existing.result; end if;
  select * into v_run from private.campaign_document_staging_runs where id=p_run_id and created_by=v_actor and state in ('staging','validated') for update;
  if not found then raise exception using errcode='42501',message='campaign staging run is not available'; end if;
  perform private.require_campaign_settings_owner(v_run.campaign_id,v_run.expected_epoch,'legacy');
  delete from private.campaign_document_staging_items where run_id=p_run_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item)<>'object' or length(v_item->>'legacyId') not between 1 and 255 or (v_item->>'schemaVersion')::integer not between 1 and 1000
      or (v_item->>'payloadFingerprint') !~ '^[a-f0-9]{64}$'
      or pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(case when coalesce((v_item->>'tombstoned')::boolean,false) then jsonb_build_object('legacyId',v_item->>'legacyId','tombstoned',true) else v_item->'payload' end),'UTF8'))>262144
      or (v_item->>'payloadFingerprint')<>private.campaign_document_hash(case when coalesce((v_item->>'tombstoned')::boolean,false) then jsonb_build_object('legacyId',v_item->>'legacyId','tombstoned',true) else v_item->'payload' end)
    then raise exception using errcode='22023',message='invalid or oversized campaign settings document'; end if;
    insert into private.campaign_document_staging_items(run_id,legacy_id,schema_version,payload,payload_fingerprint,tombstoned,byte_count)
    values(p_run_id,v_item->>'legacyId',(v_item->>'schemaVersion')::integer,v_item->'payload',v_item->>'payloadFingerprint',coalesce((v_item->>'tombstoned')::boolean,false),greatest(1,pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(case when coalesce((v_item->>'tombstoned')::boolean,false) then jsonb_build_object('legacyId',v_item->>'legacyId','tombstoned',true) else v_item->'payload' end),'UTF8'))));
  end loop;
  select count(*),coalesce(sum(byte_count),0) into v_count,v_bytes from private.campaign_document_staging_items where run_id=p_run_id;
  select * into v_manifest from private.campaign_document_manifests where id=v_run.manifest_id;
  if v_count<>v_manifest.record_count or v_bytes<>v_manifest.total_bytes or v_bytes>5242880 then raise exception using errcode='22023',message='staged campaign settings do not match the manifest budget'; end if;
  update private.campaign_document_staging_runs set state='validated' where id=p_run_id;
  v_result:=jsonb_build_object('runId',p_run_id,'state','validated','itemCount',v_count,'totalBytes',v_bytes);
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'stage_items',v_hash,v_result);
  return v_result;
end; $$;

create function private.append_campaign_projection_event(
  p_version private.campaign_document_versions,
  p_previous_payload jsonb default null,
  p_previous_tombstoned boolean default true
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_previous_visible boolean; v_current_visible boolean; v_changed boolean;
begin
  v_previous_visible:=not coalesce(p_previous_tombstoned,true) and private.campaign_settings_has_projection(p_previous_payload);
  v_current_visible:=not p_version.tombstoned and private.campaign_settings_has_projection(p_version.payload);
  v_changed:=v_previous_visible<>v_current_visible or (
    v_current_visible and private.campaign_settings_projection_payload(p_previous_payload)
      is distinct from private.campaign_settings_projection_payload(p_version.payload)
  );
  if v_changed then
    insert into private.campaign_document_projection_outbox(campaign_id,campaign_document_version_id,family,legacy_id,server_version,cutover_epoch,projection_kind,source_fingerprint)
    values(p_version.campaign_id,p_version.id,p_version.family,p_version.legacy_id,p_version.server_version,p_version.cutover_epoch,'campaign_settings_v1',p_version.payload_fingerprint);
  end if;
end; $$;

create function public.confirm_campaign_settings_cutover(p_mutation_id uuid,p_run_id uuid,p_manifest_fingerprint text,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_run private.campaign_document_staging_runs%rowtype; v_manifest private.campaign_document_manifests%rowtype; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_item private.campaign_document_staging_items%rowtype; v_doc public.campaign_documents%rowtype; v_version private.campaign_document_versions%rowtype; v_result jsonb; v_count integer; v_account_history bigint; v_device_preview text;
begin
  if v_actor is null then raise exception using errcode='42501',message='authentication is required'; end if;
  v_hash:=private.campaign_document_request_hash(jsonb_build_object('runId',p_run_id,'manifest',p_manifest_fingerprint,'epoch',p_expected_epoch));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'confirm_cutover' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID was already used with different input'; end if; return v_existing.result; end if;
  select * into v_run from private.campaign_document_staging_runs where id=p_run_id and created_by=v_actor and state='validated' for update;
  if not found then raise exception using errcode='55000',message='validated staging run is required'; end if;
  perform private.require_campaign_settings_owner(v_run.campaign_id,p_expected_epoch,'legacy');
  select * into v_manifest from private.campaign_document_manifests where id=v_run.manifest_id;
  if v_manifest.fingerprint<>p_manifest_fingerprint or v_manifest.blocker_count<>0 or v_run.expected_epoch<>p_expected_epoch then raise exception using errcode='40001',message='exact campaign settings manifest confirmation is required'; end if;
  select count(*) into v_count from private.campaign_document_staging_items where run_id=p_run_id;
  if v_count<>v_manifest.record_count then raise exception using errcode='55000',message='complete staged campaign settings generation is required'; end if;
  select coalesce(sum(pg_column_size(v.payload)),0) into v_account_history from private.campaign_document_versions v join public.campaigns c on c.id=v.campaign_id where c.owner_id=v_actor;
  if v_account_history+v_manifest.total_bytes>52428800 then raise exception using errcode='54000',message='campaign document history budget exceeded'; end if;
  for v_item in select * from private.campaign_document_staging_items where run_id=p_run_id order by legacy_id loop
    insert into public.campaign_documents(campaign_id,family,legacy_id,payload,schema_version,server_version,payload_fingerprint,tombstoned,last_mutation_id)
    values(v_run.campaign_id,'campaign_settings',v_item.legacy_id,case when v_item.tombstoned then null else v_item.payload end,v_item.schema_version,1,v_item.payload_fingerprint,v_item.tombstoned,p_mutation_id)
    returning * into v_doc;
    insert into private.campaign_document_versions(campaign_document_id,campaign_id,family,legacy_id,server_version,cutover_epoch,schema_version,payload,payload_fingerprint,tombstoned,actor_id,mutation_id,base_server_version)
    values(v_doc.id,v_doc.campaign_id,v_doc.family,v_doc.legacy_id,1,p_expected_epoch+1,v_doc.schema_version,v_doc.payload,v_doc.payload_fingerprint,v_doc.tombstoned,v_actor,p_mutation_id,0)
    returning * into v_version;
    perform private.append_campaign_projection_event(v_version);
  end loop;
  update public.campaign_authority_records set authority='postgres',epoch=p_expected_epoch+1,updated_at=statement_timestamp()
  where campaign_id=v_run.campaign_id and axis='durable_family' and family='campaign_settings' and authority='legacy' and epoch=p_expected_epoch;
  if not found then raise exception using errcode='40001',message='campaign settings authority changed during cutover'; end if;
  v_device_preview:=private.campaign_document_hash(jsonb_build_object(
    'campaignId',v_run.campaign_id,'family','campaign_settings','epoch',p_expected_epoch+1,
    'legacyId',v_doc.legacy_id,'serverVersion',v_doc.server_version,
    'schemaVersion',v_doc.schema_version,'payloadFingerprint',v_doc.payload_fingerprint,
    'tombstoned',v_doc.tombstoned
  ));
  insert into private.campaign_family_device_enrollments(
    campaign_id,family,device_id,owner_id,cutover_epoch,preview_fingerprint,
    legacy_candidate_fingerprint,state
  ) values(
    v_run.campaign_id,'campaign_settings',v_run.device_id,v_actor,p_expected_epoch+1,
    v_device_preview,null,'enrolled'
  );
  insert into private.campaign_family_cutover_generations(campaign_id,family,epoch,authority,manifest_fingerprint,current_generation,projection_journal_reconciled,verified_complete,created_by)
  values(v_run.campaign_id,'campaign_settings',p_expected_epoch+1,'postgres',p_manifest_fingerprint,jsonb_build_object('runId',p_run_id,'recordCount',v_count),true,true,v_actor);
  update private.campaign_document_staging_runs set state='finalized',finalized_at=statement_timestamp() where id=p_run_id;
  v_result:=jsonb_build_object('campaignId',v_run.campaign_id,'family','campaign_settings','authority','postgres','epoch',p_expected_epoch+1,'recordCount',v_count,'manifestFingerprint',p_manifest_fingerprint);
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'confirm_cutover',v_hash,v_result);
  return v_result;
end; $$;

create function public.put_campaign_document(
  p_mutation_id uuid,p_campaign_id uuid,p_family text,p_expected_epoch bigint,p_legacy_id text,
  p_operation text,p_expected_server_version bigint,p_schema_version integer,p_payload jsonb,p_payload_fingerprint text,
  p_restore_source_version bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_doc public.campaign_documents%rowtype; v_version private.campaign_document_versions%rowtype; v_next bigint; v_tombstone boolean; v_result jsonb; v_account_history bigint; v_had_previous boolean; v_previous_payload jsonb; v_previous_tombstoned boolean:=true;
begin
  if p_family<>'campaign_settings' or p_operation not in ('create','replace','delete') or length(p_legacy_id) not between 1 and 255 or p_schema_version not between 1 and 1000 or p_payload_fingerprint !~ '^[a-f0-9]{64}$' or (p_operation<>'delete' and (p_payload is null or pg_column_size(p_payload)>262144))
  then raise exception using errcode='22023',message='invalid campaign document mutation'; end if;
  if p_payload_fingerprint<>private.campaign_document_hash(case when p_operation='delete' then jsonb_build_object('legacyId',p_legacy_id,'tombstoned',true) else p_payload end)
  then raise exception using errcode='22023',message='campaign document payload fingerprint mismatch'; end if;
  v_actor:=private.require_campaign_settings_owner(p_campaign_id,p_expected_epoch,'postgres');
  select coalesce(sum(pg_column_size(v.payload)),0) into v_account_history from private.campaign_document_versions v join public.campaigns c on c.id=v.campaign_id where c.owner_id=v_actor;
  if v_account_history+coalesce(pg_column_size(p_payload),1)>52428800 then raise exception using errcode='54000',message='campaign document history budget exceeded'; end if;
  v_hash:=private.campaign_document_request_hash(jsonb_build_object('campaignId',p_campaign_id,'family',p_family,'epoch',p_expected_epoch,'legacyId',p_legacy_id,'operation',p_operation,'base',p_expected_server_version,'schema',p_schema_version,'payload',p_payload,'fingerprint',p_payload_fingerprint,'restoreSourceVersion',p_restore_source_version));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>(case when p_restore_source_version is null then 'put_document' else 'restore_document' end) or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID was already used with different input'; end if; return v_existing.result; end if;
  select * into v_doc from public.campaign_documents where campaign_id=p_campaign_id and family=p_family and legacy_id=p_legacy_id for update;
  v_had_previous:=found;
  if v_had_previous then v_previous_payload:=v_doc.payload; v_previous_tombstoned:=v_doc.tombstoned; end if;
  if p_operation='create' then if v_had_previous or p_expected_server_version<>0 then raise exception using errcode='40001',message='campaign document CAS conflict'; end if; v_next:=1;
    insert into public.campaign_documents(campaign_id,family,legacy_id,payload,schema_version,server_version,payload_fingerprint,tombstoned,last_mutation_id)
    values(p_campaign_id,p_family,p_legacy_id,p_payload,p_schema_version,v_next,p_payload_fingerprint,false,p_mutation_id) returning * into v_doc;
  else
    if not v_had_previous or v_doc.server_version<>p_expected_server_version then raise exception using errcode='40001',message='campaign document CAS conflict'; end if;
    if v_doc.tombstoned and p_operation<>'delete' and p_restore_source_version is null then raise exception using errcode='55000',message='ordinary mutation cannot resurrect a tombstone'; end if;
    v_next:=v_doc.server_version+1; v_tombstone:=p_operation='delete';
    update public.campaign_documents set payload=case when v_tombstone then null else p_payload end,schema_version=p_schema_version,server_version=v_next,payload_fingerprint=p_payload_fingerprint,tombstoned=v_tombstone,last_mutation_id=p_mutation_id,updated_at=statement_timestamp() where id=v_doc.id returning * into v_doc;
  end if;
  insert into private.campaign_document_versions(campaign_document_id,campaign_id,family,legacy_id,server_version,cutover_epoch,schema_version,payload,payload_fingerprint,tombstoned,actor_id,mutation_id,base_server_version)
  values(v_doc.id,p_campaign_id,p_family,p_legacy_id,v_next,p_expected_epoch,p_schema_version,v_doc.payload,p_payload_fingerprint,v_doc.tombstoned,v_actor,p_mutation_id,p_expected_server_version) returning * into v_version;
  perform private.append_campaign_projection_event(v_version,v_previous_payload,v_previous_tombstoned);
  v_result:=jsonb_build_object('documentId',v_doc.id,'campaignId',p_campaign_id,'family',p_family,'legacyId',p_legacy_id,'serverVersion',v_next,'cutoverEpoch',p_expected_epoch,'payloadFingerprint',p_payload_fingerprint,'tombstoned',v_doc.tombstoned,'cloudSaved',true,'playerView',case when private.campaign_settings_has_projection(v_previous_payload) or private.campaign_settings_has_projection(v_doc.payload) then 'pending' else 'not-applicable' end);
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,case when p_restore_source_version is null then 'put_document' else 'restore_document' end,v_hash,v_result);
  return v_result;
end; $$;

create function public.list_campaign_document_versions(p_campaign_id uuid,p_family text,p_legacy_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_result jsonb;
begin
  if p_family<>'campaign_settings' or not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and deleted_at is null) then raise exception using errcode='42501',message='campaign owner authorization is required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('versionId',v.id,'serverVersion',v.server_version,'cutoverEpoch',v.cutover_epoch,'schemaVersion',v.schema_version,'payloadFingerprint',v.payload_fingerprint,'tombstoned',v.tombstoned,'mutationId',v.mutation_id,'acceptedAt',v.accepted_at) order by v.server_version desc),'[]'::jsonb) into v_result
  from private.campaign_document_versions v where v.campaign_id=p_campaign_id and v.family=p_family and v.legacy_id=p_legacy_id;
  return jsonb_build_object('campaignId',p_campaign_id,'family',p_family,'legacyId',p_legacy_id,'versions',v_result);
end; $$;

create function public.export_campaign_document_version(p_campaign_id uuid,p_family text,p_legacy_id text,p_server_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v private.campaign_document_versions%rowtype;
begin
  if p_family<>'campaign_settings' or not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and deleted_at is null) then raise exception using errcode='42501',message='campaign owner authorization is required'; end if;
  select * into v from private.campaign_document_versions where campaign_id=p_campaign_id and family=p_family and legacy_id=p_legacy_id and server_version=p_server_version;
  if not found then raise exception using errcode='P0002',message='campaign document version was not found'; end if;
  return jsonb_build_object('serverVersion',v.server_version,'schemaVersion',v.schema_version,'payloadFingerprint',v.payload_fingerprint,'tombstoned',v.tombstoned,'payload',v.payload);
end; $$;

create function public.compare_campaign_document_versions(p_campaign_id uuid,p_family text,p_legacy_id text,p_left bigint,p_right bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l jsonb; r jsonb;
begin
  l:=public.export_campaign_document_version(p_campaign_id,p_family,p_legacy_id,p_left); r:=public.export_campaign_document_version(p_campaign_id,p_family,p_legacy_id,p_right);
  return jsonb_build_object('left',l-'payload','right',r-'payload','identical',(l->>'payloadFingerprint')=(r->>'payloadFingerprint') and (l->>'tombstoned')=(r->>'tombstoned'));
end; $$;

create function public.restore_campaign_document_version(p_mutation_id uuid,p_campaign_id uuid,p_family text,p_expected_epoch bigint,p_legacy_id text,p_source_version bigint,p_expected_server_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_source private.campaign_document_versions%rowtype; v_result jsonb;
begin
  perform private.require_campaign_settings_owner(p_campaign_id,p_expected_epoch,'postgres');
  select * into v_source from private.campaign_document_versions where campaign_id=p_campaign_id and family=p_family and legacy_id=p_legacy_id and server_version=p_source_version;
  if not found then raise exception using errcode='P0002',message='campaign document version was not found'; end if;
  if v_source.tombstoned then raise exception using errcode='55000',message='restore source must contain a document payload'; end if;
  v_result:=public.put_campaign_document(p_mutation_id,p_campaign_id,p_family,p_expected_epoch,p_legacy_id,'replace',p_expected_server_version,v_source.schema_version,v_source.payload,v_source.payload_fingerprint,p_source_version);
  return v_result||jsonb_build_object('restoredFromVersion',p_source_version);
end; $$;

create function public.repair_campaign_document_current_from_history(
  p_mutation_id uuid,p_campaign_id uuid,p_family text,p_expected_epoch bigint,
  p_legacy_id text,p_expected_latest_version bigint,p_expected_latest_fingerprint text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_latest private.campaign_document_versions%rowtype; v_result jsonb;
begin
  if v_actor is null or p_family<>'campaign_settings' or p_expected_latest_fingerprint !~ '^[a-f0-9]{64}$' then raise exception using errcode='42501',message='campaign owner authorization is required'; end if;
  v_hash:=private.campaign_document_request_hash(jsonb_build_object('campaignId',p_campaign_id,'family',p_family,'epoch',p_expected_epoch,'legacyId',p_legacy_id,'latestVersion',p_expected_latest_version,'latestFingerprint',p_expected_latest_fingerprint));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'repair_current' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID was already used with different input'; end if; return v_existing.result; end if;
  perform private.require_campaign_settings_owner(p_campaign_id,p_expected_epoch,'postgres');
  select * into v_latest from private.campaign_document_versions
  where campaign_id=p_campaign_id and family=p_family and legacy_id=p_legacy_id
  order by server_version desc limit 1;
  if not found or v_latest.server_version<>p_expected_latest_version or v_latest.payload_fingerprint<>p_expected_latest_fingerprint then raise exception using errcode='40001',message='latest immutable history version changed'; end if;
  if not v_latest.tombstoned and private.campaign_document_hash(v_latest.payload)<>v_latest.payload_fingerprint then raise exception using errcode='55000',message='immutable history fingerprint verification failed'; end if;
  update public.campaign_documents set payload=v_latest.payload,schema_version=v_latest.schema_version,server_version=v_latest.server_version,payload_fingerprint=v_latest.payload_fingerprint,tombstoned=v_latest.tombstoned,last_mutation_id=p_mutation_id,updated_at=statement_timestamp()
  where id=v_latest.campaign_document_id and campaign_id=p_campaign_id and family=p_family and legacy_id=p_legacy_id;
  if not found then raise exception using errcode='55000',message='current-row deletion is protected by immutable history references'; end if;
  update private.campaign_document_projection_outbox set state='queued',available_at=statement_timestamp(),lease_owner=null,lease_expires_at=null,last_error_code=null
  where campaign_document_version_id=v_latest.id and projection_kind='campaign_settings_v1';
  v_result:=jsonb_build_object('campaignId',p_campaign_id,'family',p_family,'legacyId',p_legacy_id,'serverVersion',v_latest.server_version,'payloadFingerprint',v_latest.payload_fingerprint,'recoveredFromHistory',true,'playerView','pending');
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'repair_current',v_hash,v_result);
  return v_result;
end; $$;

create function public.enroll_campaign_settings_device(p_mutation_id uuid,p_campaign_id uuid,p_device_id uuid,p_expected_epoch bigint,p_preview_fingerprint text,p_legacy_candidate_fingerprint text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_result jsonb; v_doc public.campaign_documents%rowtype; v_preview_fingerprint text;
begin
  if p_device_id is null or p_preview_fingerprint !~ '^[a-f0-9]{64}$' or (p_legacy_candidate_fingerprint is not null and p_legacy_candidate_fingerprint !~ '^[a-f0-9]{64}$') then raise exception using errcode='22023',message='invalid device enrollment preview'; end if;
  v_actor:=private.require_campaign_settings_owner(p_campaign_id,p_expected_epoch,'postgres');
  v_hash:=private.campaign_document_request_hash(jsonb_build_object('campaignId',p_campaign_id,'deviceId',p_device_id,'epoch',p_expected_epoch,'preview',p_preview_fingerprint,'legacy',p_legacy_candidate_fingerprint));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'enroll_device' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID was already used with different input'; end if; return v_existing.result; end if;
  select * into v_doc from public.campaign_documents where campaign_id=p_campaign_id and family='campaign_settings';
  if not found then raise exception using errcode='55000',message='current campaign settings document requires history recovery'; end if;
  v_preview_fingerprint:=private.campaign_document_hash(jsonb_build_object('campaignId',p_campaign_id,'family','campaign_settings','epoch',p_expected_epoch,'legacyId',v_doc.legacy_id,'serverVersion',v_doc.server_version,'schemaVersion',v_doc.schema_version,'payloadFingerprint',v_doc.payload_fingerprint,'tombstoned',v_doc.tombstoned));
  if v_preview_fingerprint<>p_preview_fingerprint then raise exception using errcode='40001',message='device enrollment preview changed'; end if;
  insert into private.campaign_family_device_enrollments(campaign_id,family,device_id,owner_id,cutover_epoch,preview_fingerprint,legacy_candidate_fingerprint,state)
  values(p_campaign_id,'campaign_settings',p_device_id,v_actor,p_expected_epoch,p_preview_fingerprint,p_legacy_candidate_fingerprint,'enrolled')
  on conflict(campaign_id,family,device_id,owner_id) do update set cutover_epoch=excluded.cutover_epoch,preview_fingerprint=excluded.preview_fingerprint,legacy_candidate_fingerprint=excluded.legacy_candidate_fingerprint,state='enrolled',removed_at=null;
  v_result:=jsonb_build_object('campaignId',p_campaign_id,'family','campaign_settings','deviceId',p_device_id,'epoch',p_expected_epoch,'state','enrolled');
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'enroll_device',v_hash,v_result);
  return v_result;
end; $$;

create function public.preview_campaign_settings_device_enrollment(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_epoch bigint; v_doc public.campaign_documents%rowtype; v_preview text;
begin
  if v_actor is null or not exists(
    select 1 from public.campaigns c where c.id=p_campaign_id and c.owner_id=v_actor
      and c.ownership_state='owner_verified' and c.deleted_at is null
  ) then raise exception using errcode='42501',message='campaign owner authorization is required'; end if;
  select a.epoch into v_epoch from public.campaign_authority_records a
  where a.campaign_id=p_campaign_id and a.axis='durable_family'
    and a.family='campaign_settings' and a.authority='postgres';
  if not found then return jsonb_build_object('authority','legacy'); end if;
  select * into v_doc from public.campaign_documents d
  where d.campaign_id=p_campaign_id and d.family='campaign_settings';
  if not found then raise exception using errcode='55000',message='current campaign settings document requires history recovery'; end if;
  v_preview:=private.campaign_document_hash(jsonb_build_object(
    'campaignId',p_campaign_id,'family','campaign_settings','epoch',v_epoch,
    'legacyId',v_doc.legacy_id,'serverVersion',v_doc.server_version,
    'schemaVersion',v_doc.schema_version,'payloadFingerprint',v_doc.payload_fingerprint,
    'tombstoned',v_doc.tombstoned
  ));
  return jsonb_build_object(
    'authority','postgres','epoch',v_epoch,'previewFingerprint',v_preview,
    'legacyId',v_doc.legacy_id,'serverVersion',v_doc.server_version,
    'schemaVersion',v_doc.schema_version,'payloadFingerprint',v_doc.payload_fingerprint,
    'tombstoned',v_doc.tombstoned,'payload',v_doc.payload
  );
end; $$;

create function public.remove_campaign_settings_device(p_mutation_id uuid,p_campaign_id uuid,p_device_id uuid,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_result jsonb;
begin
  if p_mutation_id is null or p_device_id is null then raise exception using errcode='22023',message='invalid device removal'; end if;
  v_actor:=private.require_campaign_settings_owner(p_campaign_id,p_expected_epoch,'postgres');
  v_hash:=private.campaign_document_request_hash(jsonb_build_object('campaignId',p_campaign_id,'deviceId',p_device_id,'epoch',p_expected_epoch));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'remove_device' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID was already used with different input'; end if; return v_existing.result; end if;
  update private.campaign_family_device_enrollments set state='removed',removed_at=statement_timestamp()
  where campaign_id=p_campaign_id and family='campaign_settings' and device_id=p_device_id and owner_id=v_actor;
  if not found then raise exception using errcode='55000',message='exact enrolled device is required'; end if;
  v_result:=jsonb_build_object('campaignId',p_campaign_id,'family','campaign_settings','deviceId',p_device_id,'epoch',p_expected_epoch,'state','removed');
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'remove_device',v_hash,v_result);
  return v_result;
end; $$;

create function public.claim_campaign_document_projection_events(p_worker_id uuid,p_limit integer,p_lease_seconds integer)
returns table(event_id uuid,campaign_id uuid,campaign_code text,legacy_id text,server_version bigint,cutover_epoch bigint,source_fingerprint text,payload jsonb,tombstoned boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('request.jwt.claim.role',true)<>'service_role' or p_worker_id is null or p_limit not between 1 and 100 or p_lease_seconds not between 5 and 300 then raise exception using errcode='42501',message='projection worker authorization is required'; end if;
  return query with candidates as (
    select o.id from private.campaign_document_projection_outbox o
    where (o.state in ('queued','retry') and o.available_at<=statement_timestamp()) or (o.state='leased' and o.lease_expires_at<=statement_timestamp())
    order by o.available_at,o.created_at limit p_limit for update skip locked
  ), claimed as (
    update private.campaign_document_projection_outbox o set state='leased',lease_owner=p_worker_id,lease_expires_at=statement_timestamp()+make_interval(secs=>p_lease_seconds),attempt_count=o.attempt_count+1
    from candidates c where o.id=c.id returning o.*
  ) select c.id,c.campaign_id,c.legacy_id,c.legacy_id,c.server_version,c.cutover_epoch,c.source_fingerprint,v.payload,v.tombstoned
  from claimed c join private.campaign_document_versions v on v.id=c.campaign_document_version_id
  order by c.available_at,c.created_at;
end; $$;

create function public.ack_campaign_document_projection_event(p_event_id uuid,p_worker_id uuid,p_projection_fingerprint text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('request.jwt.claim.role',true)<>'service_role' or p_projection_fingerprint !~ '^[a-f0-9]{64}$' then raise exception using errcode='42501',message='projection worker authorization is required'; end if;
  if exists(select 1 from private.campaign_document_projection_outbox where id=p_event_id and state='acknowledged' and projection_fingerprint=p_projection_fingerprint) then return; end if;
  update private.campaign_document_projection_outbox set state='acknowledged',projection_fingerprint=p_projection_fingerprint,acknowledged_at=statement_timestamp(),lease_owner=null,lease_expires_at=null,last_error_code=null
  where id=p_event_id and state='leased' and lease_owner=p_worker_id and lease_expires_at>statement_timestamp();
  if not found then raise exception using errcode='40001',message='projection event lease is stale'; end if;
end; $$;

create function public.fail_campaign_document_projection_event(p_event_id uuid,p_worker_id uuid,p_error_code text,p_incident_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_event private.campaign_document_projection_outbox%rowtype; v_dead boolean;
begin
  if current_setting('request.jwt.claim.role',true)<>'service_role' or length(p_error_code) not between 1 and 100 then raise exception using errcode='42501',message='projection worker authorization is required'; end if;
  select * into v_event from private.campaign_document_projection_outbox where id=p_event_id and state='leased' and lease_owner=p_worker_id for update;
  if not found then raise exception using errcode='40001',message='projection event lease is stale'; end if;
  v_dead:=v_event.attempt_count>=8 or p_incident_kind in ('equal_version_divergence','poison_event','stale_epoch');
  update private.campaign_document_projection_outbox set state=case when v_dead then 'dead' else 'retry' end,available_at=statement_timestamp()+least(interval '5 minutes',interval '2 seconds'*power(2,greatest(0,attempt_count-1))),lease_owner=null,lease_expires_at=null,last_error_code=p_error_code where id=p_event_id;
  if v_dead then insert into private.campaign_document_projection_incidents(event_id,campaign_id,family,incident_kind,metadata) values(p_event_id,v_event.campaign_id,'campaign_settings',coalesce(p_incident_kind,'retry_exhausted'),jsonb_build_object('errorCode',p_error_code,'attemptCount',v_event.attempt_count)); end if;
end; $$;

create function public.campaign_document_projection_status(p_campaign_id uuid,p_family text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_pending integer; v_failed integer; v_oldest timestamptz;
begin
  if p_family<>'campaign_settings' or not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and deleted_at is null) then raise exception using errcode='42501',message='campaign owner authorization is required'; end if;
  select count(*) filter(where state<>'acknowledged' and state<>'dead'),count(*) filter(where state='dead'),min(created_at) filter(where state<>'acknowledged') into v_pending,v_failed,v_oldest from private.campaign_document_projection_outbox where campaign_id=p_campaign_id and family=p_family;
  return jsonb_build_object('pendingCount',v_pending,'failedCount',v_failed,'oldestPendingAt',v_oldest,'freshnessSloSeconds',60,'status',case when v_failed>0 then 'failed' when v_pending>0 then 'pending' else 'current' end);
end; $$;

create function public.list_campaign_document_projection_incidents(p_campaign_id uuid,p_family text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_result jsonb;
begin
  if p_family<>'campaign_settings' or not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and deleted_at is null) then raise exception using errcode='42501',message='campaign owner authorization is required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('incidentId',i.id,'eventId',i.event_id,'kind',i.incident_kind,'createdAt',i.created_at,'resolvedAt',i.resolved_at) order by i.created_at),'[]'::jsonb) into v_result
  from private.campaign_document_projection_incidents i where i.campaign_id=p_campaign_id and i.family=p_family and i.resolved_at is null;
  return jsonb_build_object('campaignId',p_campaign_id,'family',p_family,'incidents',v_result);
end; $$;

create function public.replay_campaign_document_projection_event(p_mutation_id uuid,p_campaign_id uuid,p_expected_epoch bigint,p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_hash text; v_existing private.campaign_document_mutation_receipts%rowtype; v_event private.campaign_document_projection_outbox%rowtype; v_result jsonb;
begin
  if v_actor is null or p_mutation_id is null or p_event_id is null then raise exception using errcode='42501',message='campaign owner authorization is required'; end if;
  v_hash:=private.campaign_document_request_hash(jsonb_build_object('campaignId',p_campaign_id,'epoch',p_expected_epoch,'eventId',p_event_id));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'replay_projection' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID was already used with different input'; end if; return v_existing.result; end if;
  perform private.require_campaign_settings_owner(p_campaign_id,p_expected_epoch,'postgres');
  select * into v_event from private.campaign_document_projection_outbox where id=p_event_id and campaign_id=p_campaign_id and family='campaign_settings' for update;
  if not found or v_event.state<>'dead' then raise exception using errcode='55000',message='a dead campaign settings projection event is required'; end if;
  update private.campaign_document_projection_outbox set state='queued',attempt_count=0,available_at=statement_timestamp(),lease_owner=null,lease_expires_at=null,last_error_code=null where id=p_event_id;
  update private.campaign_document_projection_incidents set resolved_at=statement_timestamp() where event_id=p_event_id and resolved_at is null;
  v_result:=jsonb_build_object('campaignId',p_campaign_id,'family','campaign_settings','eventId',p_event_id,'state','queued');
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'replay_projection',v_hash,v_result);
  return v_result;
end; $$;

create function public.resolve_campaign_settings_projection_authority(p_campaign_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_authority public.campaign_authority_records%rowtype;
begin
  if current_setting('request.jwt.claim.role',true)<>'service_role' or length(p_campaign_code) not between 1 and 64 then
    raise exception using errcode='42501',message='application authority lookup is required';
  end if;
  select a.* into v_authority
  from public.campaigns c
  join public.campaign_authority_records a on a.campaign_id=c.id
  where c.display_code=p_campaign_code and c.deleted_at is null
    and a.axis='durable_family' and a.family='campaign_settings';
  if not found then return jsonb_build_object('authority','unselected'); end if;
  return jsonb_build_object('authority',v_authority.authority,'epoch',v_authority.epoch);
end; $$;

create function public.rollback_campaign_settings_family(p_mutation_id uuid,p_campaign_id uuid,p_expected_epoch bigint,p_manifest_fingerprint text,p_current_generation jsonb,p_projection_journal_reconciled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_result jsonb; v_hash text; v_preview jsonb; v_existing private.campaign_document_mutation_receipts%rowtype;
begin
  if not p_projection_journal_reconciled or p_manifest_fingerprint !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_current_generation)<>'object' then raise exception using errcode='55000',message='verified current generation and projection reconciliation are required'; end if;
  if v_actor is null then raise exception using errcode='42501',message='authentication is required'; end if;
  v_hash:=private.campaign_document_request_hash(jsonb_build_object('campaignId',p_campaign_id,'epoch',p_expected_epoch,'manifest',p_manifest_fingerprint,'generation',p_current_generation,'projection',p_projection_journal_reconciled));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_document_mutation_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'rollback_family' or v_existing.request_hash<>v_hash then raise exception using errcode='22023',message='mutation ID was already used with different input'; end if; return v_existing.result; end if;
  v_actor:=private.require_campaign_settings_owner(p_campaign_id,p_expected_epoch,'postgres');
  if exists(select 1 from private.campaign_document_projection_outbox where campaign_id=p_campaign_id and state in ('queued','leased','retry')) then raise exception using errcode='55000',message='projection journal reconciliation is incomplete'; end if;
  v_preview:=public.preview_campaign_settings_device_enrollment(p_campaign_id);
  if v_preview->>'previewFingerprint'<>p_manifest_fingerprint
    or v_preview->>'legacyId'<>p_current_generation->>'legacyId'
    or (v_preview->>'serverVersion')::bigint<>(p_current_generation->>'serverVersion')::bigint
    or v_preview->>'payloadFingerprint'<>p_current_generation->>'fingerprint'
  then raise exception using errcode='40001',message='verified current Postgres generation changed'; end if;
  update public.campaign_authority_records set authority='legacy',epoch=p_expected_epoch+1,updated_at=statement_timestamp() where campaign_id=p_campaign_id and axis='durable_family' and family='campaign_settings' and authority='postgres' and epoch=p_expected_epoch;
  if not found then raise exception using errcode='40001',message='campaign settings authority changed during rollback'; end if;
  insert into private.campaign_family_cutover_generations(campaign_id,family,epoch,authority,manifest_fingerprint,current_generation,projection_journal_reconciled,verified_complete,created_by)
  values(p_campaign_id,'campaign_settings',p_expected_epoch+1,'legacy_restored',p_manifest_fingerprint,p_current_generation,true,true,v_actor);
  v_result:=jsonb_build_object('campaignId',p_campaign_id,'family','campaign_settings','authority','legacy','epoch',p_expected_epoch+1,'currentGeneration',v_preview);
  insert into private.campaign_document_mutation_receipts(actor_id,mutation_id,operation,request_hash,result) values(v_actor,p_mutation_id,'rollback_family',v_hash,v_result);
  return v_result;
end; $$;

revoke all on function private.campaign_document_hash(jsonb) from public,anon,authenticated;
revoke all on function private.canonical_campaign_document_json(jsonb) from public,anon,authenticated;
revoke all on function private.require_campaign_settings_owner(uuid,bigint,text) from public,anon,authenticated;
revoke all on function private.campaign_document_request_hash(jsonb) from public,anon,authenticated;
revoke all on function private.campaign_settings_has_projection(jsonb) from public,anon,authenticated;
revoke all on function private.campaign_settings_projection_payload(jsonb) from public,anon,authenticated;
revoke all on function private.reject_campaign_document_history_change() from public,anon,authenticated;
revoke all on function private.append_campaign_projection_event(private.campaign_document_versions,jsonb,boolean) from public,anon,authenticated;

revoke all on function public.begin_campaign_settings_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint) from public,anon,authenticated;
revoke all on function public.stage_campaign_settings_items(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.confirm_campaign_settings_cutover(uuid,uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.put_campaign_document(uuid,uuid,text,bigint,text,text,bigint,integer,jsonb,text,bigint) from public,anon,authenticated;
revoke all on function public.list_campaign_document_versions(uuid,text,text) from public,anon,authenticated;
revoke all on function public.export_campaign_document_version(uuid,text,text,bigint) from public,anon,authenticated;
revoke all on function public.compare_campaign_document_versions(uuid,text,text,bigint,bigint) from public,anon,authenticated;
revoke all on function public.restore_campaign_document_version(uuid,uuid,text,bigint,text,bigint,bigint) from public,anon,authenticated;
revoke all on function public.repair_campaign_document_current_from_history(uuid,uuid,text,bigint,text,bigint,text) from public,anon,authenticated;
revoke all on function public.enroll_campaign_settings_device(uuid,uuid,uuid,bigint,text,text) from public,anon,authenticated;
revoke all on function public.preview_campaign_settings_device_enrollment(uuid) from public,anon,authenticated;
revoke all on function public.remove_campaign_settings_device(uuid,uuid,uuid,bigint) from public,anon,authenticated;
revoke all on function public.claim_campaign_document_projection_events(uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.ack_campaign_document_projection_event(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.fail_campaign_document_projection_event(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.campaign_document_projection_status(uuid,text) from public,anon,authenticated;
revoke all on function public.list_campaign_document_projection_incidents(uuid,text) from public,anon,authenticated;
revoke all on function public.replay_campaign_document_projection_event(uuid,uuid,bigint,uuid) from public,anon,authenticated;
revoke all on function public.resolve_campaign_settings_projection_authority(text) from public,anon,authenticated;
revoke all on function public.rollback_campaign_settings_family(uuid,uuid,bigint,text,jsonb,boolean) from public,anon,authenticated;

grant execute on function public.begin_campaign_settings_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint) to authenticated;
grant execute on function public.stage_campaign_settings_items(uuid,uuid,jsonb) to authenticated;
grant execute on function public.confirm_campaign_settings_cutover(uuid,uuid,text,bigint) to authenticated;
grant execute on function public.put_campaign_document(uuid,uuid,text,bigint,text,text,bigint,integer,jsonb,text,bigint) to authenticated;
grant execute on function public.list_campaign_document_versions(uuid,text,text) to authenticated;
grant execute on function public.export_campaign_document_version(uuid,text,text,bigint) to authenticated;
grant execute on function public.compare_campaign_document_versions(uuid,text,text,bigint,bigint) to authenticated;
grant execute on function public.restore_campaign_document_version(uuid,uuid,text,bigint,text,bigint,bigint) to authenticated;
grant execute on function public.repair_campaign_document_current_from_history(uuid,uuid,text,bigint,text,bigint,text) to authenticated;
grant execute on function public.enroll_campaign_settings_device(uuid,uuid,uuid,bigint,text,text) to authenticated;
grant execute on function public.preview_campaign_settings_device_enrollment(uuid) to authenticated;
grant execute on function public.remove_campaign_settings_device(uuid,uuid,uuid,bigint) to authenticated;
grant execute on function public.campaign_document_projection_status(uuid,text) to authenticated;
grant execute on function public.list_campaign_document_projection_incidents(uuid,text) to authenticated;
grant execute on function public.replay_campaign_document_projection_event(uuid,uuid,bigint,uuid) to authenticated;
grant execute on function public.resolve_campaign_settings_projection_authority(text) to service_role;
grant execute on function public.rollback_campaign_settings_family(uuid,uuid,bigint,text,jsonb,boolean) to authenticated;
grant execute on function public.claim_campaign_document_projection_events(uuid,integer,integer) to service_role;
grant execute on function public.ack_campaign_document_projection_event(uuid,uuid,text) to service_role;
grant execute on function public.fail_campaign_document_projection_event(uuid,uuid,text,text) to service_role;
