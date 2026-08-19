-- Keep short-lived invitation links, but let a redeemed guest capability span
-- the long scheduling gaps common to tabletop campaigns. Sessions remain
-- fixed-expiry, owner-revocable, scoped, hashed at rest, and rotatable.

create or replace function private.redeem_campaign_guest_invitation(
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
    or p_session_expires_at > statement_timestamp() + interval '60 days'
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

create or replace function private.rotate_campaign_guest_session(
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
    or p_new_expires_at > statement_timestamp() + interval '60 days'
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
