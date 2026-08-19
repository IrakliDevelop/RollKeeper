create table private.campaign_guest_invitations (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  creator_id uuid not null references auth.users (id) on delete restrict,
  membership_epoch bigint not null check (membership_epoch >= 0),
  live_runtime_epoch bigint not null check (live_runtime_epoch >= 0),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  scopes text[] not null check (
    cardinality(scopes) between 1 and 11
    and scopes <@ array[
      'campaign:read',
      'player:join',
      'player:read',
      'player:sync',
      'player:leave',
      'shared:read',
      'shared:ack',
      'party:read',
      'initiative:submit',
      'turn:request',
      'marker:claim'
    ]::text[]
  ),
  legacy_player_id text check (
    legacy_player_id is null or length(legacy_player_id) between 1 and 200
  ),
  expires_at timestamptz not null,
  max_uses integer not null check (max_uses between 1 and 5),
  use_count integer not null default 0 check (
    use_count >= 0 and use_count <= max_uses
  ),
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);

create table private.campaign_guest_sessions (
  id uuid primary key,
  invitation_id uuid not null
    references private.campaign_guest_invitations (id) on delete restrict,
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  membership_epoch bigint not null check (membership_epoch >= 0),
  live_runtime_epoch bigint not null check (live_runtime_epoch >= 0),
  subject_id uuid not null,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  scopes text[] not null,
  legacy_player_id text,
  expires_at timestamptz not null,
  rotated_from uuid references private.campaign_guest_sessions (id)
    on delete restrict,
  revoked_at timestamptz,
  revocation_reason text check (
    revocation_reason is null
    or revocation_reason in ('rotated', 'owner_revoked', 'invitation_revoked')
  ),
  last_used_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint guest_session_binding_shape check (
    legacy_player_id is null or length(legacy_player_id) between 1 and 200
  )
);

create table private.guest_mutation_receipts (
  operation text not null check (
    operation in (
      'issue_guest_invitation',
      'redeem_guest_invitation',
      'rotate_guest_session',
      'revoke_guest_invitation',
      'revoke_guest_session'
    )
  ),
  mutation_id uuid not null,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (operation, mutation_id)
);

create table private.guest_rate_limit_windows (
  key_hash bytea not null check (octet_length(key_hash) = 32),
  action text not null check (
    action in ('issue', 'redeem', 'rotate', 'invalid')
  ),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1),
  primary key (key_hash, action)
);

create index campaign_guest_invitations_campaign_id_idx
  on private.campaign_guest_invitations (campaign_id);
create index campaign_guest_invitations_creator_id_idx
  on private.campaign_guest_invitations (creator_id);
create index campaign_guest_sessions_invitation_id_idx
  on private.campaign_guest_sessions (invitation_id);
create index campaign_guest_sessions_campaign_id_idx
  on private.campaign_guest_sessions (campaign_id);
create index campaign_guest_sessions_subject_id_idx
  on private.campaign_guest_sessions (subject_id);
create index campaign_guest_sessions_rotated_from_idx
  on private.campaign_guest_sessions (rotated_from);

revoke all on table private.campaign_guest_invitations
from public, anon, authenticated;
revoke all on table private.campaign_guest_sessions
from public, anon, authenticated;
revoke all on table private.guest_mutation_receipts
from public, anon, authenticated;
revoke all on table private.guest_rate_limit_windows
from public, anon, authenticated;
grant usage on schema private to service_role;

create function private.consume_guest_rate_limit(
  p_key_hash bytea,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := (select auth.role());
  v_now timestamptz := statement_timestamp();
  v_row private.guest_rate_limit_windows%rowtype;
begin
  if v_role not in ('authenticated', 'service_role') then
    raise exception using errcode = '42501', message = 'rate limit access is denied';
  end if;
  if octet_length(p_key_hash) <> 32
    or p_action not in ('issue', 'redeem', 'rotate', 'invalid')
    or p_limit not between 1 and 1000
    or p_window_seconds not between 1 and 86400
  then
    raise exception using errcode = '22023', message = 'invalid rate limit request';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(encode(p_key_hash, 'hex') || ':' || p_action, 0)
  );
  select * into v_row
  from private.guest_rate_limit_windows
  where key_hash = p_key_hash and action = p_action
  for update;

  if not found or v_row.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    insert into private.guest_rate_limit_windows (
      key_hash,
      action,
      window_started_at,
      request_count
    ) values (p_key_hash, p_action, v_now, 1)
    on conflict (key_hash, action) do update
    set window_started_at = excluded.window_started_at,
        request_count = 1;
    return true;
  end if;

  if v_row.request_count >= p_limit then
    return false;
  end if;

  update private.guest_rate_limit_windows
  set request_count = request_count + 1
  where key_hash = p_key_hash and action = p_action;
  return true;
end;
$$;

create function public.issue_campaign_guest_invitation(
  p_mutation_id uuid,
  p_campaign_id uuid,
  p_token_hash bytea,
  p_expires_at timestamptz,
  p_max_uses integer,
  p_legacy_player_id text
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
  v_result jsonb;
  v_invitation_id uuid := extensions.gen_random_uuid();
  v_display_code text;
  v_scopes text[];
  v_membership_epoch bigint;
  v_live_runtime_epoch bigint;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  if p_mutation_id is null
    or p_campaign_id is null
    or octet_length(p_token_hash) <> 32
    or p_expires_at <= statement_timestamp() + interval '1 minute'
    or p_expires_at > statement_timestamp() + interval '24 hours'
    or p_max_uses not between 1 and 5
    or (p_legacy_player_id is not null
      and length(p_legacy_player_id) not between 1 and 200)
  then
    raise exception using errcode = '22023', message = 'invalid guest invitation request';
  end if;

  select campaigns.display_code, membership.epoch, live_runtime.epoch
  into v_display_code, v_membership_epoch, v_live_runtime_epoch
  from public.campaigns as campaigns
  join public.campaign_authority_records as membership
    on membership.campaign_id = campaigns.id
   and membership.axis = 'membership'
   and membership.family = '__none__'
   and membership.authority = 'legacy'
   and membership.epoch = campaigns.membership_cutover_epoch
  join public.campaign_authority_records as live_runtime
    on live_runtime.campaign_id = campaigns.id
   and live_runtime.axis = 'live_runtime'
   and live_runtime.family = '__none__'
   and live_runtime.authority = 'redis_relay'
  where campaigns.id = p_campaign_id
    and campaigns.owner_id = v_actor_id
    and campaigns.ownership_state = 'owner_verified'
    and campaigns.deleted_at is null
    and campaigns.membership_authority = 'legacy'
  for share of campaigns, membership, live_runtime;
  if not found then
    raise exception using errcode = '42501', message = 'campaign owner authorization is required';
  end if;
  v_scopes := array['campaign:read', 'shared:read', 'party:read']::text[];
  if p_legacy_player_id is not null then
    v_scopes := v_scopes || array[
      'player:join',
      'player:read',
      'player:sync',
      'player:leave',
      'shared:ack',
      'initiative:submit',
      'turn:request',
      'marker:claim'
    ]::text[];
  end if;

  v_request := jsonb_build_object(
    'actorId', v_actor_id,
    'campaignId', p_campaign_id,
    'tokenHash', encode(p_token_hash, 'hex'),
    'expiresAt', p_expires_at,
    'maxUses', p_max_uses,
    'legacyPlayerId', p_legacy_player_id,
    'scopes', v_scopes
  );
  v_request_hash := encode(extensions.digest(v_request::text, 'sha256'), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('issue:' || p_mutation_id::text, 0)
  );
  select request_hash, result into v_existing_hash, v_result
  from private.guest_mutation_receipts
  where operation = 'issue_guest_invitation'
    and mutation_id = p_mutation_id;
  if found then
    if v_existing_hash <> v_request_hash then
      raise exception using errcode = '22023', message = 'mutation ID was already used with different input';
    end if;
    return v_result;
  end if;

  if not private.consume_guest_rate_limit(
    extensions.digest(v_actor_id::text || ':' || p_campaign_id::text, 'sha256'),
    'issue',
    10,
    3600
  ) then
    raise exception using errcode = 'P0001', message = 'guest invitation rate limit exceeded';
  end if;

  insert into private.campaign_guest_invitations (
    id,
    campaign_id,
    creator_id,
    membership_epoch,
    live_runtime_epoch,
    token_hash,
    scopes,
    legacy_player_id,
    expires_at,
    max_uses
  ) values (
    v_invitation_id,
    p_campaign_id,
    v_actor_id,
    v_membership_epoch,
    v_live_runtime_epoch,
    p_token_hash,
    v_scopes,
    p_legacy_player_id,
    p_expires_at,
    p_max_uses
  );

  v_result := jsonb_build_object(
    'invitationId', v_invitation_id,
    'campaignId', p_campaign_id,
    'displayCode', v_display_code,
    'legacyPlayerId', p_legacy_player_id,
    'scopes', to_jsonb(v_scopes),
    'expiresAt', p_expires_at,
    'maxUses', p_max_uses,
    'useCount', 0
  );
  insert into private.guest_mutation_receipts (
    operation,
    mutation_id,
    request_hash,
    result
  ) values ('issue_guest_invitation', p_mutation_id, v_request_hash, v_result);
  return v_result;
end;
$$;

create function private.redeem_campaign_guest_invitation(
  p_mutation_id uuid,
  p_token_hash bytea,
  p_request_hash text,
  p_subject_id uuid,
  p_session_token_hash bytea,
  p_session_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_hash text;
  v_result jsonb;
  v_invitation private.campaign_guest_invitations%rowtype;
  v_session_id uuid := extensions.gen_random_uuid();
  v_display_code text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'application service authorization is required';
  end if;
  if p_mutation_id is null
    or octet_length(p_token_hash) <> 32
    or p_request_hash !~ '^[a-f0-9]{64}$'
    or p_subject_id is null
    or octet_length(p_session_token_hash) <> 32
    or p_session_expires_at <= statement_timestamp()
    or p_session_expires_at > statement_timestamp() + interval '24 hours'
  then
    raise exception using errcode = '42501', message = 'guest invitation is not valid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('redeem:' || p_mutation_id::text, 0)
  );
  select request_hash, result into v_existing_hash, v_result
  from private.guest_mutation_receipts
  where operation = 'redeem_guest_invitation'
    and mutation_id = p_mutation_id;
  if found then
    if v_existing_hash <> p_request_hash then
      raise exception using errcode = '22023', message = 'mutation ID was already used with different input';
    end if;
    return v_result;
  end if;

  select * into v_invitation
  from private.campaign_guest_invitations
  where token_hash = p_token_hash
  for update;
  if not found
    or v_invitation.revoked_at is not null
    or v_invitation.expires_at <= statement_timestamp()
    or v_invitation.use_count >= v_invitation.max_uses
  then
    raise exception using errcode = '42501', message = 'guest invitation is not valid';
  end if;

  select campaigns.display_code into v_display_code
  from public.campaigns as campaigns
  join public.campaign_authority_records as membership
    on membership.campaign_id = campaigns.id
   and membership.axis = 'membership'
   and membership.family = '__none__'
   and membership.authority = 'legacy'
   and membership.epoch = v_invitation.membership_epoch
   and membership.epoch = campaigns.membership_cutover_epoch
  join public.campaign_authority_records as live_runtime
    on live_runtime.campaign_id = campaigns.id
   and live_runtime.axis = 'live_runtime'
   and live_runtime.family = '__none__'
   and live_runtime.authority = 'redis_relay'
   and live_runtime.epoch = v_invitation.live_runtime_epoch
  where campaigns.id = v_invitation.campaign_id
    and campaigns.ownership_state = 'owner_verified'
    and campaigns.membership_authority = 'legacy'
    and campaigns.deleted_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'guest invitation is not valid';
  end if;

  insert into private.campaign_guest_sessions (
    id,
    invitation_id,
    campaign_id,
    membership_epoch,
    live_runtime_epoch,
    subject_id,
    token_hash,
    scopes,
    legacy_player_id,
    expires_at
  ) values (
    v_session_id,
    v_invitation.id,
    v_invitation.campaign_id,
    v_invitation.membership_epoch,
    v_invitation.live_runtime_epoch,
    p_subject_id,
    p_session_token_hash,
    v_invitation.scopes,
    v_invitation.legacy_player_id,
    p_session_expires_at
  );
  update private.campaign_guest_invitations
  set use_count = use_count + 1
  where id = v_invitation.id;

  v_result := jsonb_build_object(
    'sessionId', v_session_id,
    'invitationId', v_invitation.id,
    'campaignId', v_invitation.campaign_id,
    'displayCode', v_display_code,
    'subjectId', p_subject_id,
    'legacyPlayerId', v_invitation.legacy_player_id,
    'scopes', to_jsonb(v_invitation.scopes),
    'expiresAt', p_session_expires_at
  );
  insert into private.guest_mutation_receipts (
    operation,
    mutation_id,
    request_hash,
    result
  ) values ('redeem_guest_invitation', p_mutation_id, p_request_hash, v_result);
  return v_result;
end;
$$;

create function private.authorize_campaign_guest_session(
  p_session_token_hash bytea,
  p_display_code text,
  p_required_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session private.campaign_guest_sessions%rowtype;
  v_invitation_revoked_at timestamptz;
  v_found boolean := false;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'application service authorization is required';
  end if;
  select sessions.*
  into v_session
  from private.campaign_guest_sessions as sessions
  join public.campaigns as campaigns
    on campaigns.id = sessions.campaign_id
  join public.campaign_authority_records as membership
    on membership.campaign_id = sessions.campaign_id
   and membership.axis = 'membership'
   and membership.family = '__none__'
   and membership.authority = 'legacy'
   and membership.epoch = sessions.membership_epoch
   and membership.epoch = campaigns.membership_cutover_epoch
  join public.campaign_authority_records as live_runtime
    on live_runtime.campaign_id = sessions.campaign_id
   and live_runtime.axis = 'live_runtime'
   and live_runtime.family = '__none__'
   and live_runtime.authority = 'redis_relay'
   and live_runtime.epoch = sessions.live_runtime_epoch
  where sessions.token_hash = p_session_token_hash
    and campaigns.display_code = p_display_code
    and campaigns.ownership_state = 'owner_verified'
    and campaigns.membership_authority = 'legacy'
    and campaigns.deleted_at is null;
  v_found := found;
  if v_found then
    select revoked_at into v_invitation_revoked_at
    from private.campaign_guest_invitations
    where id = v_session.invitation_id;
  end if;
  if not v_found
    or v_session.revoked_at is not null
    or v_invitation_revoked_at is not null
    or v_session.expires_at <= statement_timestamp()
    or not (p_required_scope = any(v_session.scopes))
    or (
      p_required_scope in (
        'player:join',
        'player:read',
        'player:sync',
        'player:leave',
        'shared:ack',
        'initiative:submit',
        'turn:request',
        'marker:claim'
      )
      and v_session.legacy_player_id is null
    )
  then
    raise exception using errcode = '42501', message = 'guest session is not authorized';
  end if;

  update private.campaign_guest_sessions
  set last_used_at = statement_timestamp()
  where id = v_session.id;
  return jsonb_build_object(
    'sessionId', v_session.id,
    'campaignId', v_session.campaign_id,
    'subjectId', v_session.subject_id,
    'legacyPlayerId', v_session.legacy_player_id,
    'scopes', to_jsonb(v_session.scopes),
    'expiresAt', v_session.expires_at
  );
end;
$$;

create function private.rotate_campaign_guest_session(
  p_mutation_id uuid,
  p_current_token_hash bytea,
  p_request_hash text,
  p_new_token_hash bytea,
  p_new_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_hash text;
  v_result jsonb;
  v_current private.campaign_guest_sessions%rowtype;
  v_invitation_revoked_at timestamptz;
  v_new_session_id uuid := extensions.gen_random_uuid();
  v_display_code text;
  v_found boolean := false;
  v_campaign_valid boolean := false;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'application service authorization is required';
  end if;
  if p_mutation_id is null
    or octet_length(p_current_token_hash) <> 32
    or p_request_hash !~ '^[a-f0-9]{64}$'
    or octet_length(p_new_token_hash) <> 32
    or p_new_expires_at <= statement_timestamp()
    or p_new_expires_at > statement_timestamp() + interval '24 hours'
  then
    raise exception using errcode = '42501', message = 'guest session is not authorized';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('rotate:' || p_mutation_id::text, 0)
  );
  select request_hash, result into v_existing_hash, v_result
  from private.guest_mutation_receipts
  where operation = 'rotate_guest_session'
    and mutation_id = p_mutation_id;
  if found then
    if v_existing_hash <> p_request_hash then
      raise exception using errcode = '22023', message = 'mutation ID was already used with different input';
    end if;
    return v_result;
  end if;

  select sessions.*
  into v_current
  from private.campaign_guest_sessions as sessions
  where sessions.token_hash = p_current_token_hash
  for update of sessions;
  v_found := found;
  if v_found then
    select invitations.revoked_at, campaigns.display_code
    into v_invitation_revoked_at, v_display_code
    from private.campaign_guest_invitations as invitations
    join public.campaigns as campaigns
      on campaigns.id = invitations.campaign_id
    where invitations.id = v_current.invitation_id;
    select exists (
      select 1
      from public.campaigns as campaigns
      join public.campaign_authority_records as membership
        on membership.campaign_id = campaigns.id
       and membership.axis = 'membership'
       and membership.family = '__none__'
       and membership.authority = 'legacy'
       and membership.epoch = v_current.membership_epoch
       and membership.epoch = campaigns.membership_cutover_epoch
      join public.campaign_authority_records as live_runtime
        on live_runtime.campaign_id = campaigns.id
       and live_runtime.axis = 'live_runtime'
       and live_runtime.family = '__none__'
       and live_runtime.authority = 'redis_relay'
       and live_runtime.epoch = v_current.live_runtime_epoch
      where campaigns.id = v_current.campaign_id
        and campaigns.ownership_state = 'owner_verified'
        and campaigns.membership_authority = 'legacy'
        and campaigns.deleted_at is null
    ) into v_campaign_valid;
  end if;
  if not v_found
    or not v_campaign_valid
    or v_current.revoked_at is not null
    or v_invitation_revoked_at is not null
    or v_current.expires_at <= statement_timestamp()
  then
    raise exception using errcode = '42501', message = 'guest session is not authorized';
  end if;

  insert into private.campaign_guest_sessions (
    id,
    invitation_id,
    campaign_id,
    membership_epoch,
    live_runtime_epoch,
    subject_id,
    token_hash,
    scopes,
    legacy_player_id,
    expires_at,
    rotated_from
  ) values (
    v_new_session_id,
    v_current.invitation_id,
    v_current.campaign_id,
    v_current.membership_epoch,
    v_current.live_runtime_epoch,
    v_current.subject_id,
    p_new_token_hash,
    v_current.scopes,
    v_current.legacy_player_id,
    p_new_expires_at,
    v_current.id
  );
  update private.campaign_guest_sessions
  set revoked_at = statement_timestamp(), revocation_reason = 'rotated'
  where id = v_current.id;

  v_result := jsonb_build_object(
    'sessionId', v_new_session_id,
    'invitationId', v_current.invitation_id,
    'campaignId', v_current.campaign_id,
    'displayCode', v_display_code,
    'subjectId', v_current.subject_id,
    'legacyPlayerId', v_current.legacy_player_id,
    'scopes', to_jsonb(v_current.scopes),
    'expiresAt', p_new_expires_at
  );
  insert into private.guest_mutation_receipts (
    operation,
    mutation_id,
    request_hash,
    result
  ) values ('rotate_guest_session', p_mutation_id, p_request_hash, v_result);
  return v_result;
end;
$$;

create function public.revoke_campaign_guest_invitation(
  p_mutation_id uuid,
  p_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_request_hash text;
  v_existing_hash text;
  v_result jsonb;
  v_session_count integer;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'actorId', v_actor_id,
    'invitationId', p_invitation_id
  )::text, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('revoke-invitation:' || p_mutation_id::text, 0)
  );
  select request_hash, result into v_existing_hash, v_result
  from private.guest_mutation_receipts
  where operation = 'revoke_guest_invitation' and mutation_id = p_mutation_id;
  if found then
    if v_existing_hash <> v_request_hash then
      raise exception using errcode = '22023', message = 'mutation ID was already used with different input';
    end if;
    return v_result;
  end if;

  perform 1
  from private.campaign_guest_invitations as invitations
  join public.campaigns as campaigns on campaigns.id = invitations.campaign_id
  where invitations.id = p_invitation_id and campaigns.owner_id = v_actor_id
  for update of invitations;
  if not found then
    raise exception using errcode = '42501', message = 'campaign owner authorization is required';
  end if;
  update private.campaign_guest_invitations
  set revoked_at = coalesce(revoked_at, statement_timestamp())
  where id = p_invitation_id;
  update private.campaign_guest_sessions
  set revoked_at = coalesce(revoked_at, statement_timestamp()),
      revocation_reason = coalesce(revocation_reason, 'invitation_revoked')
  where invitation_id = p_invitation_id;
  get diagnostics v_session_count = row_count;
  v_result := jsonb_build_object(
    'invitationId', p_invitation_id,
    'revoked', true,
    'revokedSessionCount', v_session_count
  );
  insert into private.guest_mutation_receipts (
    operation, mutation_id, request_hash, result
  ) values ('revoke_guest_invitation', p_mutation_id, v_request_hash, v_result);
  return v_result;
end;
$$;

create function public.revoke_campaign_guest_session(
  p_mutation_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_request_hash text;
  v_existing_hash text;
  v_result jsonb;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'actorId', v_actor_id,
    'sessionId', p_session_id
  )::text, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('revoke-session:' || p_mutation_id::text, 0)
  );
  select request_hash, result into v_existing_hash, v_result
  from private.guest_mutation_receipts
  where operation = 'revoke_guest_session' and mutation_id = p_mutation_id;
  if found then
    if v_existing_hash <> v_request_hash then
      raise exception using errcode = '22023', message = 'mutation ID was already used with different input';
    end if;
    return v_result;
  end if;

  perform 1
  from private.campaign_guest_sessions as sessions
  join public.campaigns as campaigns on campaigns.id = sessions.campaign_id
  where sessions.id = p_session_id and campaigns.owner_id = v_actor_id
  for update of sessions;
  if not found then
    raise exception using errcode = '42501', message = 'campaign owner authorization is required';
  end if;
  update private.campaign_guest_sessions
  set revoked_at = coalesce(revoked_at, statement_timestamp()),
      revocation_reason = coalesce(revocation_reason, 'owner_revoked')
  where id = p_session_id;
  v_result := jsonb_build_object('sessionId', p_session_id, 'revoked', true);
  insert into private.guest_mutation_receipts (
    operation, mutation_id, request_hash, result
  ) values ('revoke_guest_session', p_mutation_id, v_request_hash, v_result);
  return v_result;
end;
$$;

create function public.list_campaign_guest_access(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  if not exists (
    select 1 from public.campaigns
    where id = p_campaign_id and owner_id = v_actor_id
  ) then
    raise exception using errcode = '42501', message = 'campaign owner authorization is required';
  end if;
  select jsonb_build_object(
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'invitationId', invitations.id,
        'legacyPlayerId', invitations.legacy_player_id,
        'scopes', invitations.scopes,
        'expiresAt', invitations.expires_at,
        'maxUses', invitations.max_uses,
        'useCount', invitations.use_count,
        'revokedAt', invitations.revoked_at,
        'createdAt', invitations.created_at
      ) order by invitations.created_at desc)
      from private.campaign_guest_invitations as invitations
      where invitations.campaign_id = p_campaign_id
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sessionId', sessions.id,
        'invitationId', sessions.invitation_id,
        'subjectId', sessions.subject_id,
        'legacyPlayerId', sessions.legacy_player_id,
        'scopes', sessions.scopes,
        'expiresAt', sessions.expires_at,
        'revokedAt', sessions.revoked_at,
        'lastUsedAt', sessions.last_used_at,
        'createdAt', sessions.created_at
      ) order by sessions.created_at desc)
      from private.campaign_guest_sessions as sessions
      where sessions.campaign_id = p_campaign_id
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- PostgREST exposes the public API schema, not the private storage schema. These
-- service-role-only invoker wrappers keep all authority records private while
-- providing the application server a narrow callable surface.
create function public.consume_guest_rate_limit(
  p_key_hash bytea,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.consume_guest_rate_limit(
    p_key_hash, p_action, p_limit, p_window_seconds
  );
$$;

create function public.redeem_campaign_guest_invitation(
  p_mutation_id uuid,
  p_token_hash bytea,
  p_request_hash text,
  p_subject_id uuid,
  p_session_token_hash bytea,
  p_session_expires_at timestamptz
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.redeem_campaign_guest_invitation(
    p_mutation_id,
    p_token_hash,
    p_request_hash,
    p_subject_id,
    p_session_token_hash,
    p_session_expires_at
  );
$$;

create function public.authorize_campaign_guest_session(
  p_session_token_hash bytea,
  p_display_code text,
  p_required_scope text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.authorize_campaign_guest_session(
    p_session_token_hash, p_display_code, p_required_scope
  );
$$;

create function public.rotate_campaign_guest_session(
  p_mutation_id uuid,
  p_current_token_hash bytea,
  p_request_hash text,
  p_new_token_hash bytea,
  p_new_expires_at timestamptz
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.rotate_campaign_guest_session(
    p_mutation_id,
    p_current_token_hash,
    p_request_hash,
    p_new_token_hash,
    p_new_expires_at
  );
$$;

revoke all on function private.consume_guest_rate_limit(bytea,text,integer,integer)
from public, anon, authenticated;
revoke all on function public.issue_campaign_guest_invitation(uuid,uuid,bytea,timestamptz,integer,text)
from public, anon, authenticated;
revoke all on function private.redeem_campaign_guest_invitation(uuid,bytea,text,uuid,bytea,timestamptz)
from public, anon, authenticated;
revoke all on function private.authorize_campaign_guest_session(bytea,text,text)
from public, anon, authenticated;
revoke all on function private.rotate_campaign_guest_session(uuid,bytea,text,bytea,timestamptz)
from public, anon, authenticated;
revoke all on function public.revoke_campaign_guest_invitation(uuid,uuid)
from public, anon, authenticated;
revoke all on function public.revoke_campaign_guest_session(uuid,uuid)
from public, anon, authenticated;
revoke all on function public.list_campaign_guest_access(uuid)
from public, anon, authenticated;
revoke all on function public.consume_guest_rate_limit(bytea,text,integer,integer)
from public, anon, authenticated;
revoke all on function public.redeem_campaign_guest_invitation(uuid,bytea,text,uuid,bytea,timestamptz)
from public, anon, authenticated;
revoke all on function public.authorize_campaign_guest_session(bytea,text,text)
from public, anon, authenticated;
revoke all on function public.rotate_campaign_guest_session(uuid,bytea,text,bytea,timestamptz)
from public, anon, authenticated;

grant execute on function public.issue_campaign_guest_invitation(uuid,uuid,bytea,timestamptz,integer,text)
to authenticated;
grant execute on function public.revoke_campaign_guest_invitation(uuid,uuid)
to authenticated;
grant execute on function public.revoke_campaign_guest_session(uuid,uuid)
to authenticated;
grant execute on function public.list_campaign_guest_access(uuid)
to authenticated;
grant execute on function private.consume_guest_rate_limit(bytea,text,integer,integer)
to service_role;
grant execute on function private.redeem_campaign_guest_invitation(uuid,bytea,text,uuid,bytea,timestamptz)
to service_role;
grant execute on function private.authorize_campaign_guest_session(bytea,text,text)
to service_role;
grant execute on function private.rotate_campaign_guest_session(uuid,bytea,text,bytea,timestamptz)
to service_role;
grant execute on function public.consume_guest_rate_limit(bytea,text,integer,integer)
to service_role;
grant execute on function public.redeem_campaign_guest_invitation(uuid,bytea,text,uuid,bytea,timestamptz)
to service_role;
grant execute on function public.authorize_campaign_guest_session(bytea,text,text)
to service_role;
grant execute on function public.rotate_campaign_guest_session(uuid,bytea,text,bytea,timestamptz)
to service_role;
