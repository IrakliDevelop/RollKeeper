create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.campaigns (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete restrict,
  display_code text not null unique check (display_code ~ '^[A-F0-9]{12}$'),
  name text not null check (length(name) between 1 and 255),
  ownership_state text not null default 'owner_verified'
    check (ownership_state in ('owner_verified', 'archived')),
  membership_authority text not null default 'legacy'
    check (membership_authority in ('legacy', 'postgres')),
  membership_cutover_epoch bigint not null default 0
    check (membership_cutover_epoch >= 0),
  server_version bigint not null default 1 check (server_version >= 1),
  deleted_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table public.campaign_authority_records (
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  axis text not null check (
    axis in ('workspace', 'membership', 'durable_family', 'live_runtime')
  ),
  family text not null,
  authority text not null,
  epoch bigint not null check (epoch >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (campaign_id, axis, family),
  constraint campaign_authority_shape_check check (
    (
      axis = 'workspace'
      and family = '__none__'
      and authority = 'authenticated_owner'
      and epoch = 1
    )
    or (
      axis = 'membership'
      and family = '__none__'
      and authority in ('legacy', 'postgres')
    )
    or (
      axis = 'live_runtime'
      and family = '__none__'
      and authority = 'redis_relay'
    )
    or (
      axis = 'durable_family'
      and family in (
        'campaign_settings',
        'calendar',
        'magic_item',
        'npc',
        'encounter_definition',
        'location',
        'battle_map',
        'combat_log_archive'
      )
      and authority in ('legacy', 'postgres')
    )
  )
);

create table private.workspace_claim_authorizations (
  id uuid primary key,
  claimant_id uuid not null references auth.users (id) on delete restrict,
  legacy_source_fingerprint text not null
    check (legacy_source_fingerprint ~ '^[a-f0-9]{64}$'),
  token_hash bytea not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (claimant_id, legacy_source_fingerprint)
);

create table public.campaign_workspace_claim_provenance (
  campaign_id uuid primary key references public.campaigns (id) on delete restrict,
  claimant_id uuid not null references auth.users (id) on delete restrict,
  claim_kind text not null
    check (claim_kind in ('new_workspace', 'import_fork', 'manual_verified')),
  source_fingerprint text check (
    source_fingerprint is null or source_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  proof_method text not null check (
    proof_method in ('authenticated_creation', 'explicit_fork', 'manual_verified')
  ),
  authorization_id uuid references private.workspace_claim_authorizations (id)
    on delete restrict,
  claimed_at timestamptz not null default statement_timestamp(),
  constraint campaign_claim_provenance_shape_check check (
    (
      claim_kind = 'new_workspace'
      and source_fingerprint is null
      and proof_method = 'authenticated_creation'
      and authorization_id is null
    )
    or (
      claim_kind = 'import_fork'
      and source_fingerprint is not null
      and proof_method = 'explicit_fork'
      and authorization_id is null
    )
    or (
      claim_kind = 'manual_verified'
      and source_fingerprint is not null
      and proof_method = 'manual_verified'
      and authorization_id is not null
    )
  )
);

create table private.campaign_mutation_receipts (
  actor_id uuid not null references auth.users (id) on delete restrict,
  mutation_id uuid not null,
  operation text not null check (
    operation in ('create_campaign_workspace', 'claim_campaign_workspace')
  ),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (actor_id, mutation_id)
);

alter table public.campaigns enable row level security;
alter table public.campaign_authority_records enable row level security;
alter table public.campaign_workspace_claim_provenance enable row level security;

revoke all on table public.campaigns from public, anon, authenticated;
revoke all on table public.campaign_authority_records
from public, anon, authenticated;
revoke all on table public.campaign_workspace_claim_provenance
from public, anon, authenticated;
revoke all on table private.workspace_claim_authorizations
from public, anon, authenticated;
revoke all on table private.campaign_mutation_receipts
from public, anon, authenticated;

grant select on table public.campaigns to authenticated;
grant select on table public.campaign_authority_records to authenticated;
grant select on table public.campaign_workspace_claim_provenance
to authenticated;

create policy campaigns_select_owner
on public.campaigns
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy campaign_authority_records_select_owner
on public.campaign_authority_records
for select
to authenticated
using (
  exists (
    select 1
    from public.campaigns
    where campaigns.id = campaign_authority_records.campaign_id
      and campaigns.owner_id = (select auth.uid())
  )
);

create policy campaign_workspace_claim_provenance_select_owner
on public.campaign_workspace_claim_provenance
for select
to authenticated
using (claimant_id = (select auth.uid()));

create function private.generate_campaign_display_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(encode(extensions.gen_random_bytes(6), 'hex'));
    exit when not exists (
      select 1 from public.campaigns where display_code = v_code
    );
  end loop;
  return v_code;
end;
$$;

create function private.insert_owner_workspace(
  p_actor_id uuid,
  p_name text,
  p_claim_kind text,
  p_source_fingerprint text,
  p_proof_method text,
  p_authorization_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_campaign_id uuid := extensions.gen_random_uuid();
  v_display_code text := private.generate_campaign_display_code();
  v_family text;
begin
  insert into public.campaigns (
    id,
    owner_id,
    display_code,
    name,
    ownership_state,
    membership_authority,
    membership_cutover_epoch,
    server_version
  ) values (
    v_campaign_id,
    p_actor_id,
    v_display_code,
    p_name,
    'owner_verified',
    'legacy',
    0,
    1
  );

  insert into public.campaign_authority_records (
    campaign_id,
    axis,
    family,
    authority,
    epoch
  ) values
    (v_campaign_id, 'workspace', '__none__', 'authenticated_owner', 1),
    (v_campaign_id, 'membership', '__none__', 'legacy', 0),
    (v_campaign_id, 'live_runtime', '__none__', 'redis_relay', 0);

  foreach v_family in array array[
    'campaign_settings',
    'calendar',
    'magic_item',
    'npc',
    'encounter_definition',
    'location',
    'battle_map',
    'combat_log_archive'
  ]
  loop
    insert into public.campaign_authority_records (
      campaign_id,
      axis,
      family,
      authority,
      epoch
    ) values (
      v_campaign_id,
      'durable_family',
      v_family,
      'legacy',
      0
    );
  end loop;

  insert into public.campaign_workspace_claim_provenance (
    campaign_id,
    claimant_id,
    claim_kind,
    source_fingerprint,
    proof_method,
    authorization_id
  ) values (
    v_campaign_id,
    p_actor_id,
    p_claim_kind,
    p_source_fingerprint,
    p_proof_method,
    p_authorization_id
  );

  return jsonb_build_object(
    'campaignId', v_campaign_id,
    'displayCode', v_display_code,
    'membershipAuthority', 'legacy',
    'familyAuthorities', 'legacy',
    'liveRuntimeAuthority', 'redis_relay'
  );
end;
$$;

create function public.create_campaign_workspace(
  p_mutation_id uuid,
  p_name text,
  p_creation_kind text,
  p_source_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_request jsonb;
  v_request_hash text;
  v_existing_hash text;
  v_existing_operation text;
  v_result jsonb;
  v_campaign_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  if p_mutation_id is null or length(trim(p_name)) not between 1 and 255 then
    raise exception using errcode = '22023', message = 'valid mutation ID and workspace name are required';
  end if;
  if p_creation_kind not in ('new_workspace', 'import_fork') then
    raise exception using errcode = '22023', message = 'invalid workspace creation kind';
  end if;
  if p_creation_kind = 'new_workspace' and p_source_fingerprint is not null then
    raise exception using errcode = '22023', message = 'new workspaces have no legacy source fingerprint';
  end if;
  if p_creation_kind = 'import_fork'
    and (p_source_fingerprint is null or p_source_fingerprint !~ '^[a-f0-9]{64}$')
  then
    raise exception using errcode = '22023', message = 'a SHA-256 source fingerprint is required for import/fork';
  end if;

  v_request := jsonb_build_object(
    'name', trim(p_name),
    'creationKind', p_creation_kind,
    'sourceFingerprint', p_source_fingerprint
  );
  v_request_hash := encode(extensions.digest(v_request::text, 'sha256'), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor_id::text || ':' || p_mutation_id::text, 0)
  );
  select operation, request_hash, result
  into v_existing_operation, v_existing_hash, v_result
  from private.campaign_mutation_receipts
  where actor_id = v_actor_id and mutation_id = p_mutation_id;
  if found then
    if v_existing_operation <> 'create_campaign_workspace'
      or v_existing_hash <> v_request_hash
    then
      raise exception using errcode = '22023', message = 'mutation ID was already used with different input';
    end if;
    return v_result;
  end if;

  v_result := private.insert_owner_workspace(
    v_actor_id,
    trim(p_name),
    p_creation_kind,
    p_source_fingerprint,
    case when p_creation_kind = 'new_workspace'
      then 'authenticated_creation'
      else 'explicit_fork'
    end,
    null
  );
  v_campaign_id := (v_result ->> 'campaignId')::uuid;

  insert into private.campaign_mutation_receipts (
    actor_id,
    mutation_id,
    operation,
    request_hash,
    campaign_id,
    result
  ) values (
    v_actor_id,
    p_mutation_id,
    'create_campaign_workspace',
    v_request_hash,
    v_campaign_id,
    v_result
  );
  return v_result;
end;
$$;

create function public.claim_campaign_workspace(
  p_mutation_id uuid,
  p_name text,
  p_legacy_source_fingerprint text,
  p_authorization_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_request jsonb;
  v_request_hash text;
  v_existing_hash text;
  v_existing_operation text;
  v_result jsonb;
  v_campaign_id uuid;
  v_authorization_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  if p_mutation_id is null
    or length(trim(p_name)) not between 1 and 255
    or p_legacy_source_fingerprint !~ '^[a-f0-9]{64}$'
    or length(p_authorization_token) < 16
  then
    raise exception using errcode = '42501', message = 'workspace ownership proof was not accepted';
  end if;

  v_request := jsonb_build_object(
    'name', trim(p_name),
    'legacySourceFingerprint', p_legacy_source_fingerprint,
    'authorizationTokenHash', encode(
      extensions.digest(p_authorization_token, 'sha256'),
      'hex'
    )
  );
  v_request_hash := encode(extensions.digest(v_request::text, 'sha256'), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor_id::text || ':' || p_mutation_id::text, 0)
  );
  select operation, request_hash, result
  into v_existing_operation, v_existing_hash, v_result
  from private.campaign_mutation_receipts
  where actor_id = v_actor_id and mutation_id = p_mutation_id;
  if found then
    if v_existing_operation <> 'claim_campaign_workspace'
      or v_existing_hash <> v_request_hash
    then
      raise exception using errcode = '22023', message = 'mutation ID was already used with different input';
    end if;
    return v_result;
  end if;

  select id
  into v_authorization_id
  from private.workspace_claim_authorizations
  where claimant_id = v_actor_id
    and legacy_source_fingerprint = p_legacy_source_fingerprint
    and token_hash = extensions.digest(p_authorization_token, 'sha256')
    and consumed_at is null
    and expires_at > statement_timestamp()
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'workspace ownership proof was not accepted';
  end if;

  v_result := private.insert_owner_workspace(
    v_actor_id,
    trim(p_name),
    'manual_verified',
    p_legacy_source_fingerprint,
    'manual_verified',
    v_authorization_id
  );
  v_campaign_id := (v_result ->> 'campaignId')::uuid;
  update private.workspace_claim_authorizations
  set consumed_at = statement_timestamp()
  where id = v_authorization_id;

  insert into private.campaign_mutation_receipts (
    actor_id,
    mutation_id,
    operation,
    request_hash,
    campaign_id,
    result
  ) values (
    v_actor_id,
    p_mutation_id,
    'claim_campaign_workspace',
    v_request_hash,
    v_campaign_id,
    v_result
  );
  return v_result;
end;
$$;

revoke all on function private.generate_campaign_display_code()
from public, anon, authenticated;
revoke all on function private.insert_owner_workspace(uuid,text,text,text,text,uuid)
from public, anon, authenticated;
revoke all on function public.create_campaign_workspace(uuid,text,text,text)
from public, anon, authenticated;
revoke all on function public.claim_campaign_workspace(uuid,text,text,text)
from public, anon, authenticated;

grant execute on function public.create_campaign_workspace(uuid,text,text,text)
to authenticated;
grant execute on function public.claim_campaign_workspace(uuid,text,text,text)
to authenticated;
