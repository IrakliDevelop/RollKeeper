create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  role text not null check (role in ('dm', 'player')),
  status text not null check (status in ('active', 'left', 'removed')),
  membership_epoch bigint not null default 0 check (membership_epoch >= 0),
  joined_at timestamptz not null default statement_timestamp(),
  left_at timestamptz,
  removed_at timestamptz,
  removed_by uuid references auth.users (id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (campaign_id, user_id)
);

create table public.campaign_character_links (
  campaign_id uuid not null,
  member_id uuid not null,
  character_id uuid not null references public.characters (id) on delete restrict,
  legacy_player_id text check (
    legacy_player_id is null or length(legacy_player_id) between 1 and 200
  ),
  legacy_character_id text check (
    legacy_character_id is null or length(legacy_character_id) between 1 and 255
  ),
  guest_subject_id uuid,
  status text not null check (status in ('active', 'retired', 'removed')),
  linked_at timestamptz not null default statement_timestamp(),
  unlinked_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (campaign_id, member_id, character_id),
  unique (campaign_id, character_id),
  foreign key (campaign_id, member_id)
    references public.campaign_members (campaign_id, user_id) on delete restrict
);

create table private.campaign_membership_invitations (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  creator_id uuid not null references auth.users (id) on delete restrict,
  invited_account_id uuid not null references auth.users (id) on delete restrict,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  role text not null check (role in ('dm', 'player')),
  legacy_player_id text check (
    legacy_player_id is null or length(legacy_player_id) between 1 and 200
  ),
  guest_subject_id uuid,
  membership_epoch bigint not null check (membership_epoch >= 0),
  expires_at timestamptz not null,
  max_uses integer not null check (max_uses between 1 and 5),
  use_count integer not null default 0 check (use_count between 0 and max_uses),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'refused', 'revoked', 'expired')),
  accepted_at timestamptz,
  refused_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);

create table private.campaign_membership_shadow_entries (
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  entry_kind text not null check (
    entry_kind in ('legacy_roster', 'guest_subject', 'removal_tombstone')
  ),
  source_id text not null check (length(source_id) between 1 and 255),
  display_label text not null check (length(display_label) between 1 and 255),
  source_fingerprint text not null check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  present boolean not null default true,
  classification text check (classification in ('abandoned', 'duplicate')),
  classified_by uuid references auth.users (id) on delete restrict,
  classified_at timestamptz,
  first_seen_at timestamptz not null default statement_timestamp(),
  last_seen_at timestamptz not null default statement_timestamp(),
  shadow_revision bigint not null check (shadow_revision >= 1),
  primary key (campaign_id, entry_kind, source_id)
);

create table private.campaign_membership_manifests (
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  version bigint not null check (version >= 1),
  shadow_revision bigint not null check (shadow_revision >= 0),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  manifest jsonb not null,
  blocker_count integer not null check (blocker_count >= 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  primary key (campaign_id, version),
  unique (campaign_id, fingerprint)
);

create table private.campaign_membership_generations (
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  epoch bigint not null check (epoch >= 1),
  authority text not null check (authority in ('postgres', 'legacy')),
  manifest_fingerprint text not null check (manifest_fingerprint ~ '^[a-f0-9]{64}$'),
  manifest jsonb not null,
  verified_complete boolean not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  primary key (campaign_id, epoch)
);

create table private.campaign_membership_cutover_state (
  campaign_id uuid primary key references public.campaigns (id) on delete restrict,
  state text not null check (state in ('open', 'freezing', 'postgres', 'rollback_freezing', 'legacy_restored')),
  shadow_revision bigint not null default 0 check (shadow_revision >= 0),
  frozen_manifest_version bigint,
  frozen_manifest_fingerprint text check (
    frozen_manifest_fingerprint is null
    or frozen_manifest_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  updated_at timestamptz not null default statement_timestamp()
);

create table private.campaign_membership_receipts (
  actor_id uuid not null references auth.users (id) on delete restrict,
  mutation_id uuid not null,
  operation text not null check (operation in (
    'issue_membership_invitation',
    'accept_membership_invitation',
    'revoke_membership_invitation',
    'link_campaign_character',
    'unlink_campaign_character',
    'remove_campaign_member',
    'replace_membership_shadow',
    'classify_membership_shadow',
    'prepare_membership_manifest',
    'begin_membership_freeze',
    'cancel_membership_freeze',
    'confirm_membership_cutover',
    'rollback_membership_cutover'
  )),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (actor_id, mutation_id)
);

create table private.campaign_membership_rate_limits (
  key_hash bytea not null check (octet_length(key_hash) = 32),
  action text not null check (action in ('issue', 'accept', 'validate', 'cutover')),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1),
  primary key (key_hash, action)
);

create index campaign_members_user_id_idx on public.campaign_members (user_id);
create index campaign_members_removed_by_idx on public.campaign_members (removed_by);
create index campaign_character_links_member_id_idx on public.campaign_character_links (member_id);
create index campaign_character_links_character_id_idx on public.campaign_character_links (character_id);
create unique index campaign_character_links_active_legacy_player_idx
  on public.campaign_character_links (campaign_id, legacy_player_id)
  where status = 'active' and legacy_player_id is not null;
create unique index campaign_character_links_active_legacy_character_idx
  on public.campaign_character_links (campaign_id, legacy_character_id)
  where status = 'active' and legacy_character_id is not null;
create unique index campaign_character_links_active_guest_subject_idx
  on public.campaign_character_links (campaign_id, guest_subject_id)
  where status = 'active' and guest_subject_id is not null;
create index membership_invitations_campaign_idx on private.campaign_membership_invitations (campaign_id);
create index membership_invitations_creator_idx on private.campaign_membership_invitations (creator_id);
create index membership_invitations_account_idx on private.campaign_membership_invitations (invited_account_id);

alter table public.campaign_members enable row level security;
alter table public.campaign_character_links enable row level security;
alter table private.campaign_membership_invitations enable row level security;
alter table private.campaign_membership_shadow_entries enable row level security;
alter table private.campaign_membership_manifests enable row level security;
alter table private.campaign_membership_generations enable row level security;
alter table private.campaign_membership_cutover_state enable row level security;
alter table private.campaign_membership_receipts enable row level security;
alter table private.campaign_membership_rate_limits enable row level security;

revoke all on table public.campaign_members from public, anon, authenticated;
revoke all on table public.campaign_character_links from public, anon, authenticated;
revoke all on table private.campaign_membership_invitations from public, anon, authenticated;
revoke all on table private.campaign_membership_shadow_entries from public, anon, authenticated;
revoke all on table private.campaign_membership_manifests from public, anon, authenticated;
revoke all on table private.campaign_membership_generations from public, anon, authenticated;
revoke all on table private.campaign_membership_cutover_state from public, anon, authenticated;
revoke all on table private.campaign_membership_receipts from public, anon, authenticated;
revoke all on table private.campaign_membership_rate_limits from public, anon, authenticated;

grant select on table public.campaign_members to authenticated;
grant select on table public.campaign_character_links to authenticated;

create policy campaign_members_select_owner_or_self
on public.campaign_members for select to authenticated
using (
  (user_id = (select auth.uid()) and status = 'active')
  or exists (
    select 1 from public.campaigns
    where campaigns.id = campaign_members.campaign_id
      and campaigns.owner_id = (select auth.uid())
  )
);

create policy campaign_character_links_select_owner_or_self
on public.campaign_character_links for select to authenticated
using (
  (
    member_id = (select auth.uid())
    and exists (
      select 1 from public.campaign_members
      where campaign_members.campaign_id = campaign_character_links.campaign_id
        and campaign_members.user_id = (select auth.uid())
        and campaign_members.status = 'active'
    )
  )
  or exists (
    select 1 from public.campaigns
    where campaigns.id = campaign_character_links.campaign_id
      and campaigns.owner_id = (select auth.uid())
  )
);

create function private.membership_request_hash(p_request jsonb)
returns text language sql immutable set search_path = ''
as $$ select encode(extensions.digest(p_request::text, 'sha256'), 'hex') $$;

create function private.consume_membership_rate_limit(
  p_key_hash bytea,
  p_action text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_row private.campaign_membership_rate_limits%rowtype;
begin
  if (select auth.role()) not in ('authenticated', 'service_role')
    or octet_length(p_key_hash) <> 32
    or p_action not in ('issue', 'accept', 'validate', 'cutover')
    or p_limit not between 1 and 1000
    or p_window_seconds not between 1 and 86400
  then
    raise exception using errcode = '42501', message = 'membership rate limit access is denied';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(encode(p_key_hash, 'hex') || ':' || p_action, 0)
  );
  select * into v_row from private.campaign_membership_rate_limits
  where key_hash = p_key_hash and action = p_action for update;
  if not found or v_row.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    insert into private.campaign_membership_rate_limits(key_hash, action, window_started_at, request_count)
    values (p_key_hash, p_action, v_now, 1)
    on conflict (key_hash, action) do update
      set window_started_at = excluded.window_started_at, request_count = 1;
    return true;
  end if;
  if v_row.request_count >= p_limit then return false; end if;
  update private.campaign_membership_rate_limits set request_count = request_count + 1
  where key_hash = p_key_hash and action = p_action;
  return true;
end;
$$;

create function public.issue_campaign_membership_invitation(
  p_mutation_id uuid,
  p_campaign_id uuid,
  p_invited_account_id uuid,
  p_token_hash bytea,
  p_expires_at timestamptz,
  p_max_uses integer,
  p_role text,
  p_legacy_player_id text,
  p_guest_subject_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_request_hash text;
  v_existing private.campaign_membership_receipts%rowtype;
  v_invitation_id uuid := extensions.gen_random_uuid();
  v_epoch bigint;
  v_result jsonb;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  if p_mutation_id is null or p_invited_account_id is null or octet_length(p_token_hash) <> 32
    or p_expires_at <= statement_timestamp() + interval '1 minute'
    or p_expires_at > statement_timestamp() + interval '7 days'
    or p_max_uses not between 1 and 5 or p_role not in ('dm', 'player')
    or (p_legacy_player_id is not null and length(p_legacy_player_id) not between 1 and 200)
  then raise exception using errcode = '22023', message = 'invalid membership invitation request'; end if;

  select membership_cutover_epoch into v_epoch from public.campaigns
  where id = p_campaign_id and owner_id = v_actor and ownership_state = 'owner_verified'
    and deleted_at is null and membership_authority = 'legacy' for share;
  if not found then raise exception using errcode = '42501', message = 'campaign owner authorization is required'; end if;
  if p_guest_subject_id is not null and not exists (
    select 1 from private.campaign_guest_sessions s
    where s.campaign_id = p_campaign_id
      and s.subject_id = p_guest_subject_id
      and s.revoked_at is null
      and s.expires_at > statement_timestamp()
      and s.legacy_player_id is not distinct from p_legacy_player_id
  ) then
    raise exception using errcode = '42501', message = 'campaign guest binding is not valid';
  end if;

  v_request_hash := private.membership_request_hash(jsonb_build_object(
    'campaignId', p_campaign_id, 'accountId', p_invited_account_id,
    'tokenHash', encode(p_token_hash, 'hex'), 'expiresAt', p_expires_at,
    'maxUses', p_max_uses, 'role', p_role, 'legacyPlayerId', p_legacy_player_id,
    'guestSubjectId', p_guest_subject_id
  ));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_mutation_id::text, 0));
  select * into v_existing from private.campaign_membership_receipts
  where actor_id = v_actor and mutation_id = p_mutation_id;
  if found then
    if v_existing.operation <> 'issue_membership_invitation' or v_existing.request_hash <> v_request_hash
    then raise exception using errcode = '22023', message = 'mutation ID was already used with different input'; end if;
    return v_existing.result;
  end if;
  if not private.consume_membership_rate_limit(extensions.digest(v_actor::text || ':' || p_campaign_id::text, 'sha256'), 'issue', 20, 3600)
  then raise exception using errcode = 'P0001', message = 'membership invitation rate limit exceeded'; end if;

  insert into private.campaign_membership_invitations(
    id, campaign_id, creator_id, invited_account_id, token_hash, role,
    legacy_player_id, guest_subject_id, membership_epoch, expires_at, max_uses
  ) values (
    v_invitation_id, p_campaign_id, v_actor, p_invited_account_id, p_token_hash,
    p_role, p_legacy_player_id, p_guest_subject_id, v_epoch, p_expires_at, p_max_uses
  );
  v_result := jsonb_build_object(
    'invitationId', v_invitation_id, 'campaignId', p_campaign_id,
    'invitedAccountId', p_invited_account_id, 'role', p_role,
    'legacyPlayerId', p_legacy_player_id, 'guestSubjectId', p_guest_subject_id,
    'expiresAt', p_expires_at, 'maxUses', p_max_uses, 'useCount', 0,
    'status', 'pending'
  );
  insert into private.campaign_membership_receipts(actor_id, mutation_id, operation, request_hash, result)
  values(v_actor, p_mutation_id, 'issue_membership_invitation', v_request_hash, v_result);
  return v_result;
end;
$$;

create function public.accept_campaign_membership_invitation(
  p_mutation_id uuid,
  p_token_hash bytea,
  p_decision text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_request_hash text;
  v_existing private.campaign_membership_receipts%rowtype;
  v_invitation private.campaign_membership_invitations%rowtype;
  v_result jsonb;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  if p_mutation_id is null or octet_length(p_token_hash) <> 32 or p_decision not in ('accepted', 'refused')
  then raise exception using errcode = '22023', message = 'invalid membership invitation response'; end if;
  v_request_hash := private.membership_request_hash(jsonb_build_object(
    'accountId', v_actor, 'tokenHash', encode(p_token_hash, 'hex'), 'decision', p_decision
  ));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_mutation_id::text, 0));
  select * into v_existing from private.campaign_membership_receipts
  where actor_id = v_actor and mutation_id = p_mutation_id;
  if found then
    if v_existing.operation <> 'accept_membership_invitation' or v_existing.request_hash <> v_request_hash
    then raise exception using errcode = '22023', message = 'mutation ID was already used with different input'; end if;
    return v_existing.result;
  end if;
  if not private.consume_membership_rate_limit(extensions.digest(v_actor::text, 'sha256'), 'accept', 30, 3600)
  then raise exception using errcode = 'P0001', message = 'membership acceptance rate limit exceeded'; end if;
  select * into v_invitation from private.campaign_membership_invitations
  where token_hash = p_token_hash for update;
  if not found or v_invitation.invited_account_id <> v_actor or v_invitation.status <> 'pending'
    or v_invitation.revoked_at is not null or v_invitation.expires_at <= statement_timestamp()
    or v_invitation.use_count >= v_invitation.max_uses
    or not exists (
      select 1 from public.campaigns c
      join public.campaign_authority_records a on a.campaign_id = c.id
       and a.axis = 'membership' and a.family = '__none__'
       and a.authority = 'legacy' and a.epoch = v_invitation.membership_epoch
      where c.id = v_invitation.campaign_id and c.membership_authority = 'legacy'
        and c.membership_cutover_epoch = v_invitation.membership_epoch
    )
  then raise exception using errcode = '42501', message = 'membership invitation is not valid'; end if;

  update private.campaign_membership_invitations set
    use_count = use_count + 1,
    status = p_decision,
    accepted_at = case when p_decision = 'accepted' then statement_timestamp() else null end,
    refused_at = case when p_decision = 'refused' then statement_timestamp() else null end
  where id = v_invitation.id;
  if p_decision = 'accepted' then
    if exists (select 1 from public.campaign_members where campaign_id = v_invitation.campaign_id and user_id = v_actor and status = 'removed')
    then raise exception using errcode = '42501', message = 'removed membership requires a new owner-approved flow'; end if;
    insert into public.campaign_members(campaign_id, user_id, role, status, membership_epoch)
    values(v_invitation.campaign_id, v_actor, v_invitation.role, 'active', v_invitation.membership_epoch)
    on conflict (campaign_id, user_id) do update set
      role = excluded.role, status = 'active', left_at = null, updated_at = statement_timestamp();
  end if;
  v_result := jsonb_build_object(
    'invitationId', v_invitation.id, 'campaignId', v_invitation.campaign_id,
    'memberId', v_actor, 'role', v_invitation.role,
    'status', case when p_decision = 'accepted' then 'active' else 'refused' end
  );
  insert into private.campaign_membership_receipts(actor_id, mutation_id, operation, request_hash, result)
  values(v_actor, p_mutation_id, 'accept_membership_invitation', v_request_hash, v_result);
  return v_result;
end;
$$;

create function public.link_campaign_character(
  p_mutation_id uuid,
  p_campaign_id uuid,
  p_character_id uuid,
  p_legacy_player_id text,
  p_legacy_character_id text,
  p_guest_subject_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_request_hash text;
  v_existing private.campaign_membership_receipts%rowtype;
  v_result jsonb;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  if p_mutation_id is null or p_campaign_id is null or p_character_id is null
  then raise exception using errcode = '22023', message = 'campaign and character are required'; end if;
  if not exists (select 1 from public.campaign_members where campaign_id = p_campaign_id and user_id = v_actor and status = 'active')
    or not exists (select 1 from public.characters where id = p_character_id and owner_id = v_actor and deleted_at is null)
    or not exists (
      select 1 from private.campaign_membership_invitations i
      where i.campaign_id = p_campaign_id
        and i.invited_account_id = v_actor
        and i.status = 'accepted'
        and i.legacy_player_id is not distinct from p_legacy_player_id
        and i.guest_subject_id is not distinct from p_guest_subject_id
    )
  then raise exception using errcode = '42501', message = 'active membership and owned cloud character are required'; end if;
  v_request_hash := private.membership_request_hash(jsonb_build_object(
    'campaignId', p_campaign_id, 'characterId', p_character_id,
    'legacyPlayerId', p_legacy_player_id, 'legacyCharacterId', p_legacy_character_id,
    'guestSubjectId', p_guest_subject_id
  ));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_mutation_id::text, 0));
  select * into v_existing from private.campaign_membership_receipts where actor_id = v_actor and mutation_id = p_mutation_id;
  if found then
    if v_existing.operation <> 'link_campaign_character' or v_existing.request_hash <> v_request_hash
    then raise exception using errcode = '22023', message = 'mutation ID was already used with different input'; end if;
    return v_existing.result;
  end if;
  insert into public.campaign_character_links(
    campaign_id, member_id, character_id, legacy_player_id, legacy_character_id,
    guest_subject_id, status
  ) values (
    p_campaign_id, v_actor, p_character_id, p_legacy_player_id,
    p_legacy_character_id, p_guest_subject_id, 'active'
  ) on conflict (campaign_id, member_id, character_id) do update set
    legacy_player_id = excluded.legacy_player_id,
    legacy_character_id = excluded.legacy_character_id,
    guest_subject_id = excluded.guest_subject_id,
    status = 'active', unlinked_at = null, updated_at = statement_timestamp();
  v_result := jsonb_build_object(
    'campaignId', p_campaign_id, 'memberId', v_actor,
    'characterId', p_character_id, 'status', 'active'
  );
  insert into private.campaign_membership_receipts(actor_id, mutation_id, operation, request_hash, result)
  values(v_actor, p_mutation_id, 'link_campaign_character', v_request_hash, v_result);
  return v_result;
end;
$$;

create function public.unlink_campaign_character(
  p_mutation_id uuid, p_campaign_id uuid, p_character_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_hash text; v_existing private.campaign_membership_receipts%rowtype; v_result jsonb;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  v_hash := private.membership_request_hash(jsonb_build_object('campaignId', p_campaign_id, 'characterId', p_character_id));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_mutation_id::text, 0));
  select * into v_existing from private.campaign_membership_receipts where actor_id = v_actor and mutation_id = p_mutation_id;
  if found then if v_existing.operation <> 'unlink_campaign_character' or v_existing.request_hash <> v_hash then raise exception using errcode='22023', message='mutation ID was already used with different input'; end if; return v_existing.result; end if;
  update public.campaign_character_links set status='retired', unlinked_at=statement_timestamp(), updated_at=statement_timestamp()
  where campaign_id=p_campaign_id and member_id=v_actor and character_id=p_character_id and status='active';
  if not found then raise exception using errcode='42501', message='active character link is required'; end if;
  v_result := jsonb_build_object('campaignId',p_campaign_id,'memberId',v_actor,'characterId',p_character_id,'status','retired');
  insert into private.campaign_membership_receipts values(v_actor,p_mutation_id,'unlink_campaign_character',v_hash,v_result,statement_timestamp());
  return v_result;
end;
$$;

create function public.revoke_campaign_membership_invitation(
  p_mutation_id uuid, p_invitation_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_hash text; v_existing private.campaign_membership_receipts%rowtype; v_result jsonb;
begin
  if v_actor is null then raise exception using errcode='42501', message='authentication is required'; end if;
  v_hash := private.membership_request_hash(jsonb_build_object('invitationId',p_invitation_id));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_mutation_id::text,0));
  select * into v_existing from private.campaign_membership_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation <> 'revoke_membership_invitation' or v_existing.request_hash <> v_hash then raise exception using errcode='22023', message='mutation ID was already used with different input'; end if; return v_existing.result; end if;
  update private.campaign_membership_invitations i set status='revoked', revoked_at=coalesce(revoked_at,statement_timestamp())
  from public.campaigns c where i.id=p_invitation_id and c.id=i.campaign_id and c.owner_id=v_actor and i.status='pending';
  if not found then raise exception using errcode='42501', message='campaign owner authorization is required'; end if;
  v_result := jsonb_build_object('invitationId',p_invitation_id,'status','revoked');
  insert into private.campaign_membership_receipts values(v_actor,p_mutation_id,'revoke_membership_invitation',v_hash,v_result,statement_timestamp());
  return v_result;
end;
$$;

create function public.remove_campaign_member(
  p_mutation_id uuid, p_campaign_id uuid, p_member_id uuid,
  p_expected_legacy_player_id text, p_expected_epoch bigint
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_hash text; v_existing private.campaign_membership_receipts%rowtype; v_result jsonb;
begin
  if v_actor is null or not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and membership_authority='postgres' and membership_cutover_epoch=p_expected_epoch)
  then raise exception using errcode='42501', message='campaign owner authorization is required'; end if;
  if not exists(select 1 from public.campaign_character_links
    where campaign_id=p_campaign_id and member_id=p_member_id and status='active'
      and legacy_player_id=p_expected_legacy_player_id)
  then raise exception using errcode='42501', message='explicit member link is required'; end if;
  v_hash := private.membership_request_hash(jsonb_build_object('campaignId',p_campaign_id,'memberId',p_member_id,'legacyPlayerId',p_expected_legacy_player_id,'epoch',p_expected_epoch));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_mutation_id::text,0));
  select * into v_existing from private.campaign_membership_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation <> 'remove_campaign_member' or v_existing.request_hash <> v_hash then raise exception using errcode='22023', message='mutation ID was already used with different input'; end if; return v_existing.result; end if;
  update public.campaign_members set status='removed', removed_at=statement_timestamp(), removed_by=v_actor, updated_at=statement_timestamp()
  where campaign_id=p_campaign_id and user_id=p_member_id and status='active';
  if not found then raise exception using errcode='42501', message='active member is required'; end if;
  update public.campaign_character_links set status='removed', unlinked_at=statement_timestamp(), updated_at=statement_timestamp()
  where campaign_id=p_campaign_id and member_id=p_member_id and status='active';
  v_result := jsonb_build_object('campaignId',p_campaign_id,'memberId',p_member_id,'status','removed','epoch',p_expected_epoch);
  insert into private.campaign_membership_receipts values(v_actor,p_mutation_id,'remove_campaign_member',v_hash,v_result,statement_timestamp());
  return v_result;
end;
$$;

create function private.build_campaign_membership_manifest(p_campaign_id uuid)
returns jsonb language sql stable set search_path = ''
as $$
  with
  shadow as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'kind',entry_kind,'sourceId',source_id,'label',display_label,
      'fingerprint',source_fingerprint,'present',present,
      'classification',classification,'revision',shadow_revision
    ) order by entry_kind,source_id),'[]'::jsonb) value
    from private.campaign_membership_shadow_entries where campaign_id=p_campaign_id
  ),
  invites as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'invitationId',id,'accountId',invited_account_id,'role',role,
      'legacyPlayerId',legacy_player_id,'guestSubjectId',guest_subject_id,
      'status',status,'expiresAt',expires_at,'maxUses',max_uses,'useCount',use_count
    ) order by id),'[]'::jsonb) value
    from private.campaign_membership_invitations where campaign_id=p_campaign_id
  ),
  members as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'accountId',user_id,'role',role,'status',status,'epoch',membership_epoch,
      'removedAt',removed_at
    ) order by user_id),'[]'::jsonb) value
    from public.campaign_members where campaign_id=p_campaign_id
  ),
  links as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'accountId',member_id,'characterId',character_id,
      'legacyPlayerId',legacy_player_id,'legacyCharacterId',legacy_character_id,
      'guestSubjectId',guest_subject_id,'status',status
    ) order by member_id,character_id),'[]'::jsonb) value
    from public.campaign_character_links where campaign_id=p_campaign_id
  ),
  guest_sessions as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'subjectId',subject_id,'legacyPlayerId',legacy_player_id,
      'revoked',revoked_at is not null,'expiresAt',expires_at
    ) order by subject_id),'[]'::jsonb) value
    from private.campaign_guest_sessions where campaign_id=p_campaign_id
  ),
  blockers as (
    select coalesce(jsonb_agg(value order by value::text),'[]'::jsonb) value from (
      select jsonb_build_object('kind','unexplained-shadow','sourceId',s.source_id) value
      from private.campaign_membership_shadow_entries s
      where s.campaign_id=p_campaign_id and s.present and s.classification is null
        and not exists (
          select 1 from public.campaign_character_links l
          join public.campaign_members m on m.campaign_id=l.campaign_id and m.user_id=l.member_id
          where l.campaign_id=s.campaign_id and l.status='active' and m.status='active'
            and ((s.entry_kind='legacy_roster' and l.legacy_player_id=s.source_id)
              or (s.entry_kind='guest_subject' and l.guest_subject_id::text=s.source_id))
        )
      union all
      select jsonb_build_object('kind','pending-invitation','invitationId',i.id)
      from private.campaign_membership_invitations i
      where i.campaign_id=p_campaign_id and i.status='pending' and i.revoked_at is null
        and i.expires_at > statement_timestamp()
      union all
      select jsonb_build_object('kind','member-without-character','accountId',m.user_id)
      from public.campaign_members m where m.campaign_id=p_campaign_id and m.status='active'
        and not exists(select 1 from public.campaign_character_links l where l.campaign_id=m.campaign_id and l.member_id=m.user_id and l.status='active')
    ) b
  )
  select jsonb_build_object(
    'format','rollkeeper-membership-readiness-v1','campaignId',p_campaign_id,
    'legacyRoster',(select coalesce(jsonb_agg(e order by e::text),'[]'::jsonb) from jsonb_array_elements((select value from shadow)) e where e->>'kind'='legacy_roster'),
    'guestSubjects',(
      (select coalesce(jsonb_agg(e order by e::text),'[]'::jsonb) from jsonb_array_elements((select value from shadow)) e where e->>'kind'='guest_subject')
      || (select value from guest_sessions)
    ),
    'invitations',(select value from invites),
    'acceptedMembers',(select value from members),
    'characterLinks',(select value from links),
    'classifications',(select coalesce(jsonb_agg(e order by e::text),'[]'::jsonb) from jsonb_array_elements((select value from shadow)) e where e->>'classification' is not null),
    'removals',(
      (select coalesce(jsonb_agg(e order by e::text),'[]'::jsonb) from jsonb_array_elements((select value from members)) e where e->>'status'='removed')
      || (select coalesce(jsonb_agg(e order by e::text),'[]'::jsonb) from jsonb_array_elements((select value from shadow)) e where e->>'kind'='removal_tombstone')
    ),
    'blockers',(select value from blockers)
  );
$$;

create function public.prepare_campaign_membership_manifest(
  p_mutation_id uuid, p_campaign_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid:=auth.uid(); v_manifest jsonb; v_fingerprint text; v_version bigint; v_shadow bigint; v_blockers integer; v_result jsonb; v_request_hash text; v_existing private.campaign_membership_receipts%rowtype;
begin
  if v_actor is null or not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified')
  then raise exception using errcode='42501', message='campaign owner authorization is required'; end if;
  v_request_hash:=private.membership_request_hash(jsonb_build_object('campaignId',p_campaign_id));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  select * into v_existing from private.campaign_membership_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then
    if v_existing.operation<>'prepare_membership_manifest' or v_existing.request_hash<>v_request_hash
    then raise exception using errcode='22023',message='mutation ID was already used with different input'; end if;
    return v_existing.result;
  end if;
  if not private.consume_membership_rate_limit(extensions.digest(v_actor::text||':'||p_campaign_id::text,'sha256'),'validate',30,3600)
  then raise exception using errcode='P0001', message='membership validation rate limit exceeded'; end if;
  select shadow_revision into v_shadow from private.campaign_membership_cutover_state where campaign_id=p_campaign_id;
  if not found then insert into private.campaign_membership_cutover_state(campaign_id,state) values(p_campaign_id,'open') returning shadow_revision into v_shadow; end if;
  v_manifest:=private.build_campaign_membership_manifest(p_campaign_id);
  v_fingerprint:=private.membership_request_hash(v_manifest);
  v_blockers:=jsonb_array_length(v_manifest->'blockers');
  select coalesce(max(version),0)+1 into v_version from private.campaign_membership_manifests where campaign_id=p_campaign_id;
  insert into private.campaign_membership_manifests(campaign_id,version,shadow_revision,fingerprint,manifest,blocker_count,created_by)
  values(p_campaign_id,v_version,v_shadow,v_fingerprint,v_manifest,v_blockers,v_actor)
  on conflict(campaign_id,fingerprint) do update set created_at=private.campaign_membership_manifests.created_at
  returning version into v_version;
  v_result:=jsonb_build_object('campaignId',p_campaign_id,'version',v_version,'shadowRevision',v_shadow,'fingerprint',v_fingerprint,'blockerCount',v_blockers,'manifest',v_manifest);
  insert into private.campaign_membership_receipts(actor_id,mutation_id,operation,request_hash,result)
  values(v_actor,p_mutation_id,'prepare_membership_manifest',v_request_hash,v_result);
  return v_result;
end;
$$;

create function public.replace_campaign_membership_shadow(
  p_mutation_id uuid,
  p_owner_id uuid,
  p_campaign_id uuid,
  p_entries jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_entry jsonb;
  v_revision bigint;
  v_result jsonb;
begin
  if (select auth.role()) <> 'service_role'
    or p_owner_id is null
    or jsonb_typeof(p_entries) <> 'array'
    or not exists (
      select 1 from public.campaigns
      where id=p_campaign_id and owner_id=p_owner_id
        and ownership_state='owner_verified' and membership_authority='legacy'
    )
  then raise exception using errcode='42501', message='application owner authorization is required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('membership-shadow:'||p_campaign_id::text,0));
  insert into private.campaign_membership_cutover_state(campaign_id,state,shadow_revision)
  values(p_campaign_id,'open',1)
  on conflict(campaign_id) do update set
    shadow_revision=private.campaign_membership_cutover_state.shadow_revision+1,
    updated_at=statement_timestamp()
  returning shadow_revision into v_revision;
  update private.campaign_membership_shadow_entries
  set present=false,shadow_revision=v_revision,last_seen_at=statement_timestamp()
  where campaign_id=p_campaign_id and entry_kind in ('legacy_roster','guest_subject','removal_tombstone');
  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    if v_entry->>'kind' not in ('legacy_roster','guest_subject','removal_tombstone')
      or length(v_entry->>'sourceId') not between 1 and 255
      or length(v_entry->>'label') not between 1 and 255
      or (v_entry->>'fingerprint') !~ '^[a-f0-9]{64}$'
    then raise exception using errcode='22023', message='invalid membership shadow entry'; end if;
    insert into private.campaign_membership_shadow_entries(
      campaign_id,entry_kind,source_id,display_label,source_fingerprint,present,shadow_revision
    ) values(
      p_campaign_id,v_entry->>'kind',v_entry->>'sourceId',v_entry->>'label',v_entry->>'fingerprint',true,v_revision
    ) on conflict(campaign_id,entry_kind,source_id) do update set
      display_label=excluded.display_label,
      source_fingerprint=excluded.source_fingerprint,
      present=true,
      last_seen_at=statement_timestamp(),
      shadow_revision=v_revision;
  end loop;
  v_result:=jsonb_build_object('campaignId',p_campaign_id,'shadowRevision',v_revision,'entryCount',jsonb_array_length(p_entries));
  insert into private.campaign_membership_receipts(actor_id,mutation_id,operation,request_hash,result)
  values(p_owner_id,p_mutation_id,'replace_membership_shadow',private.membership_request_hash(jsonb_build_object('campaignId',p_campaign_id,'entries',p_entries)),v_result);
  return v_result;
end;
$$;

create function public.classify_campaign_membership_shadow(
  p_mutation_id uuid,
  p_campaign_id uuid,
  p_entry_kind text,
  p_source_id text,
  p_classification text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid:=auth.uid(); v_result jsonb;
begin
  if v_actor is null or p_classification not in ('abandoned','duplicate')
    or not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and membership_authority='legacy')
  then raise exception using errcode='42501', message='campaign owner authorization is required'; end if;
  update private.campaign_membership_shadow_entries set
    classification=p_classification,classified_by=v_actor,classified_at=statement_timestamp()
  where campaign_id=p_campaign_id and entry_kind=p_entry_kind and source_id=p_source_id;
  if not found then raise exception using errcode='22023', message='membership shadow entry was not found'; end if;
  v_result:=jsonb_build_object('campaignId',p_campaign_id,'kind',p_entry_kind,'sourceId',p_source_id,'classification',p_classification);
  insert into private.campaign_membership_receipts(actor_id,mutation_id,operation,request_hash,result)
  values(v_actor,p_mutation_id,'classify_membership_shadow',private.membership_request_hash(v_result),v_result);
  return v_result;
end;
$$;

create function public.begin_campaign_membership_freeze(
  p_mutation_id uuid,p_campaign_id uuid,p_manifest_fingerprint text,p_manifest_version bigint
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid:=auth.uid(); v_manifest private.campaign_membership_manifests%rowtype; v_result jsonb;
begin
  if v_actor is null or not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and membership_authority='legacy')
  then raise exception using errcode='42501', message='campaign owner authorization is required'; end if;
  select * into v_manifest from private.campaign_membership_manifests
  where campaign_id=p_campaign_id and version=p_manifest_version and fingerprint=p_manifest_fingerprint;
  if not found or v_manifest.blocker_count<>0 then raise exception using errcode='40001', message='membership readiness manifest is stale or blocked'; end if;
  insert into private.campaign_membership_cutover_state(campaign_id,state,shadow_revision,frozen_manifest_version,frozen_manifest_fingerprint)
  values(p_campaign_id,'freezing',v_manifest.shadow_revision,p_manifest_version,p_manifest_fingerprint)
  on conflict(campaign_id) do update set state='freezing',frozen_manifest_version=p_manifest_version,
    frozen_manifest_fingerprint=p_manifest_fingerprint,updated_at=statement_timestamp();
  v_result:=jsonb_build_object('campaignId',p_campaign_id,'state','freezing','manifestFingerprint',p_manifest_fingerprint,'manifestVersion',p_manifest_version);
  insert into private.campaign_membership_receipts(actor_id,mutation_id,operation,request_hash,result)
  values(v_actor,p_mutation_id,'begin_membership_freeze',private.membership_request_hash(v_result),v_result);
  return v_result;
end;
$$;

create function public.cancel_campaign_membership_freeze(
  p_mutation_id uuid,p_campaign_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid:=auth.uid(); v_result jsonb;
begin
  if v_actor is null or not exists(select 1 from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and membership_authority='legacy')
  then raise exception using errcode='42501', message='campaign owner authorization is required'; end if;
  update private.campaign_membership_cutover_state set state='open',frozen_manifest_version=null,
    frozen_manifest_fingerprint=null,updated_at=statement_timestamp()
  where campaign_id=p_campaign_id and state='freezing';
  v_result:=jsonb_build_object('campaignId',p_campaign_id,'state','open');
  insert into private.campaign_membership_receipts(actor_id,mutation_id,operation,request_hash,result)
  values(v_actor,p_mutation_id,'cancel_membership_freeze',private.membership_request_hash(v_result),v_result);
  return v_result;
end;
$$;

create function public.confirm_campaign_membership_cutover(
  p_mutation_id uuid, p_campaign_id uuid, p_manifest_fingerprint text, p_manifest_version bigint
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid:=auth.uid(); v_campaign public.campaigns%rowtype; v_manifest private.campaign_membership_manifests%rowtype; v_current jsonb; v_current_fingerprint text; v_result jsonb; v_epoch bigint; v_request_hash text; v_existing private.campaign_membership_receipts%rowtype;
begin
  if v_actor is null then raise exception using errcode='42501', message='authentication is required'; end if;
  v_request_hash:=private.membership_request_hash(jsonb_build_object('campaignId',p_campaign_id,'fingerprint',p_manifest_fingerprint,'version',p_manifest_version));
  select * into v_existing from private.campaign_membership_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'confirm_membership_cutover' or v_existing.request_hash<>v_request_hash then raise exception using errcode='22023',message='mutation ID was already used with different input'; end if; return v_existing.result; end if;
  if not private.consume_membership_rate_limit(extensions.digest(v_actor::text||':'||p_campaign_id::text,'sha256'),'cutover',10,3600)
  then raise exception using errcode='P0001', message='membership cutover rate limit exceeded'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('membership-cutover:'||p_campaign_id::text,0));
  select * into v_campaign from public.campaigns where id=p_campaign_id and owner_id=v_actor and ownership_state='owner_verified' and deleted_at is null for update;
  if not found or v_campaign.membership_authority<>'legacy' then raise exception using errcode='42501', message='campaign owner authorization is required'; end if;
  select * into v_manifest from private.campaign_membership_manifests where campaign_id=p_campaign_id and version=p_manifest_version and fingerprint=p_manifest_fingerprint;
  if not found then raise exception using errcode='40001', message='membership readiness manifest is stale'; end if;
  if not exists(select 1 from private.campaign_membership_cutover_state where campaign_id=p_campaign_id and state='freezing' and frozen_manifest_version=p_manifest_version and frozen_manifest_fingerprint=p_manifest_fingerprint)
  then raise exception using errcode='40001',message='membership join and removal freeze is required'; end if;
  v_current:=private.build_campaign_membership_manifest(p_campaign_id);
  v_current_fingerprint:=private.membership_request_hash(v_current);
  if v_current_fingerprint<>p_manifest_fingerprint or jsonb_array_length(v_current->'blockers')<>0
  then raise exception using errcode='40001', message='membership readiness manifest is stale or blocked'; end if;
  if not exists(select 1 from public.campaign_members where campaign_id=p_campaign_id and status='active')
  then raise exception using errcode='40001', message='membership readiness manifest is blocked'; end if;
  v_epoch:=v_campaign.membership_cutover_epoch+1;
  update public.campaigns set membership_authority='postgres',membership_cutover_epoch=v_epoch,server_version=server_version+1,updated_at=statement_timestamp() where id=p_campaign_id;
  update public.campaign_authority_records set authority='postgres',epoch=v_epoch,updated_at=statement_timestamp() where campaign_id=p_campaign_id and axis='membership' and family='__none__';
  update public.campaign_members set membership_epoch=v_epoch,updated_at=statement_timestamp() where campaign_id=p_campaign_id and status='active';
  insert into private.campaign_membership_generations(campaign_id,epoch,authority,manifest_fingerprint,manifest,verified_complete,created_by)
  values(p_campaign_id,v_epoch,'postgres',p_manifest_fingerprint,v_current,true,v_actor);
  update private.campaign_guest_sessions set revoked_at=coalesce(revoked_at,statement_timestamp()),revocation_reason=coalesce(revocation_reason,'owner_revoked') where campaign_id=p_campaign_id;
  insert into private.campaign_membership_cutover_state(campaign_id,state,shadow_revision,updated_at)
  values(p_campaign_id,'postgres',v_manifest.shadow_revision,statement_timestamp())
  on conflict(campaign_id) do update set state='postgres',frozen_manifest_version=null,frozen_manifest_fingerprint=null,updated_at=statement_timestamp();
  v_result:=jsonb_build_object('campaignId',p_campaign_id,'authority','postgres','epoch',v_epoch,'manifestFingerprint',p_manifest_fingerprint,'guestSessionsRevoked',true);
  insert into private.campaign_membership_receipts(actor_id,mutation_id,operation,request_hash,result)
  values(v_actor,p_mutation_id,'confirm_membership_cutover',v_request_hash,v_result);
  return v_result;
end;
$$;

create function public.replay_campaign_membership_cutover(
  p_mutation_id uuid, p_campaign_id uuid,
  p_manifest_fingerprint text, p_manifest_version bigint
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_request_hash text;
  v_existing private.campaign_membership_receipts%rowtype;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='authentication is required';
  end if;
  v_request_hash:=private.membership_request_hash(jsonb_build_object(
    'campaignId',p_campaign_id,'fingerprint',p_manifest_fingerprint,
    'version',p_manifest_version
  ));
  select * into v_existing from private.campaign_membership_receipts
  where actor_id=v_actor and mutation_id=p_mutation_id;
  if not found then return null; end if;
  if v_existing.operation<>'confirm_membership_cutover'
    or v_existing.request_hash<>v_request_hash
  then
    raise exception using errcode='22023',message='mutation ID was already used with different input';
  end if;
  return v_existing.result;
end;
$$;

create function public.rollback_campaign_membership(
  p_mutation_id uuid, p_campaign_id uuid, p_expected_epoch bigint,
  p_generation jsonb, p_generation_fingerprint text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid:=auth.uid(); v_epoch bigint; v_result jsonb; v_request_hash text; v_existing private.campaign_membership_receipts%rowtype; v_generation private.campaign_membership_generations%rowtype;
begin
  if v_actor is null then raise exception using errcode='40001', message='verified complete membership generation is required'; end if;
  -- Keep the legacy RPC argument for wire compatibility; rollback authority is
  -- derived exclusively from the recorded server-side generation below.
  perform pg_catalog.jsonb_typeof(p_generation);
  v_request_hash:=private.membership_request_hash(jsonb_build_object('campaignId',p_campaign_id,'expectedEpoch',p_expected_epoch,'generationFingerprint',p_generation_fingerprint));
  select * into v_existing from private.campaign_membership_receipts where actor_id=v_actor and mutation_id=p_mutation_id;
  if found then if v_existing.operation<>'rollback_membership_cutover' or v_existing.request_hash<>v_request_hash then raise exception using errcode='22023',message='mutation ID was already used with different input'; end if; return v_existing.result; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('membership-cutover:'||p_campaign_id::text,0));
  select * into v_generation from private.campaign_membership_generations
  where campaign_id=p_campaign_id and epoch=p_expected_epoch and authority='postgres'
    and verified_complete and manifest_fingerprint=p_generation_fingerprint;
  if not found
    or private.membership_request_hash(v_generation.manifest)<>v_generation.manifest_fingerprint
    or jsonb_typeof(v_generation.manifest->'acceptedMembers')<>'array'
    or jsonb_typeof(v_generation.manifest->'characterLinks')<>'array'
  then raise exception using errcode='40001', message='verified complete membership generation is required'; end if;
  select membership_cutover_epoch+1 into v_epoch from public.campaigns
  where id=p_campaign_id and owner_id=v_actor and membership_authority='postgres' and membership_cutover_epoch=p_expected_epoch for update;
  if not found then raise exception using errcode='42501', message='campaign owner authorization is required'; end if;
  update public.campaigns set membership_authority='legacy',membership_cutover_epoch=v_epoch,server_version=server_version+1,updated_at=statement_timestamp() where id=p_campaign_id;
  update public.campaign_authority_records set authority='legacy',epoch=v_epoch,updated_at=statement_timestamp() where campaign_id=p_campaign_id and axis='membership' and family='__none__';
  insert into private.campaign_membership_generations(campaign_id,epoch,authority,manifest_fingerprint,manifest,verified_complete,created_by)
  values(p_campaign_id,v_epoch,'legacy',p_generation_fingerprint,v_generation.manifest,true,v_actor);
  insert into private.campaign_membership_cutover_state(campaign_id,state,updated_at)
  values(p_campaign_id,'legacy_restored',statement_timestamp())
  on conflict(campaign_id) do update set state='legacy_restored',updated_at=statement_timestamp();
  v_result:=jsonb_build_object('campaignId',p_campaign_id,'authority','legacy','epoch',v_epoch,'generationFingerprint',p_generation_fingerprint);
  insert into private.campaign_membership_receipts(actor_id,mutation_id,operation,request_hash,result)
  values(v_actor,p_mutation_id,'rollback_membership_cutover',v_request_hash,v_result);
  return v_result;
end;
$$;

create function public.resolve_campaign_membership_authority(p_display_code text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if (select auth.role())<>'service_role' then raise exception using errcode='42501', message='application service authorization is required'; end if;
  select jsonb_build_object(
    'campaignId',c.id,'ownerId',c.owner_id,'displayCode',c.display_code,
    'authority',a.authority,'epoch',a.epoch,
    'freezeState',coalesce(s.state,case when a.authority='postgres' then 'postgres' else 'open' end)
  ) into v_result
  from public.campaigns c
  join public.campaign_authority_records a on a.campaign_id=c.id and a.axis='membership' and a.family='__none__' and a.epoch=c.membership_cutover_epoch and a.authority=c.membership_authority
  left join private.campaign_membership_cutover_state s on s.campaign_id=c.id
  where c.display_code=p_display_code and c.deleted_at is null;
  if not found then
    if exists(select 1 from public.campaigns c where c.display_code=p_display_code and c.deleted_at is null) then
      raise exception using errcode='40001', message='membership authority record is missing';
    end if;
    return jsonb_build_object('managed',false);
  end if;
  return v_result;
end;
$$;

create function public.authorize_campaign_membership(p_campaign_id uuid,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid:=auth.uid(); v_result jsonb;
begin
  if v_actor is null then raise exception using errcode='42501', message='account membership is required'; end if;
  select jsonb_build_object(
    'campaignId',c.id,'accountId',v_actor,
    'role',case when c.owner_id=v_actor then 'owner' else m.role end,
    'status',case when c.owner_id=v_actor then 'active' else m.status end,
    'epoch',c.membership_cutover_epoch,
    'legacyPlayerId',l.legacy_player_id,'legacyCharacterId',l.legacy_character_id,
    'characterId',l.character_id
  ) into v_result
  from public.campaigns c
  left join public.campaign_members m on m.campaign_id=c.id and m.user_id=v_actor and m.status='active'
  left join public.campaign_character_links l on l.campaign_id=c.id and l.member_id=v_actor and l.status='active'
  where c.id=p_campaign_id and c.membership_authority='postgres' and c.membership_cutover_epoch=p_expected_epoch
    and (c.owner_id=v_actor or m.user_id is not null)
  order by l.linked_at limit 1;
  if not found then raise exception using errcode='42501', message='account membership is required'; end if;
  return v_result;
end;
$$;

create function public.list_my_campaign_memberships()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid:=auth.uid(); v_memberships jsonb;
begin
  if v_actor is null then raise exception using errcode='42501', message='account membership is required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'campaignId',m.campaign_id,
    'role',m.role,
    'status',m.status,
    'epoch',c.membership_cutover_epoch
  ) order by m.joined_at desc, m.campaign_id), '[]'::jsonb)
  into v_memberships
  from public.campaign_members m
  join public.campaigns c on c.id=m.campaign_id and c.deleted_at is null
  where m.user_id=v_actor and m.status='active';
  return jsonb_build_object('memberships',v_memberships);
end;
$$;

revoke all on function private.membership_request_hash(jsonb) from public,anon,authenticated;
revoke all on function private.consume_membership_rate_limit(bytea,text,integer,integer) from public,anon,authenticated;
revoke all on function private.build_campaign_membership_manifest(uuid) from public,anon,authenticated;
revoke all on function public.issue_campaign_membership_invitation(uuid,uuid,uuid,bytea,timestamptz,integer,text,text,uuid) from public,anon,authenticated;
revoke all on function public.accept_campaign_membership_invitation(uuid,bytea,text) from public,anon,authenticated;
revoke all on function public.link_campaign_character(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.unlink_campaign_character(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.revoke_campaign_membership_invitation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.remove_campaign_member(uuid,uuid,uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.prepare_campaign_membership_manifest(uuid,uuid) from public,anon,authenticated;
revoke all on function public.replace_campaign_membership_shadow(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.classify_campaign_membership_shadow(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.begin_campaign_membership_freeze(uuid,uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.cancel_campaign_membership_freeze(uuid,uuid) from public,anon,authenticated;
revoke all on function public.confirm_campaign_membership_cutover(uuid,uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.replay_campaign_membership_cutover(uuid,uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.rollback_campaign_membership(uuid,uuid,bigint,jsonb,text) from public,anon,authenticated;
revoke all on function public.resolve_campaign_membership_authority(text) from public,anon,authenticated;
revoke all on function public.authorize_campaign_membership(uuid,bigint) from public,anon,authenticated;
revoke all on function public.list_my_campaign_memberships() from public,anon,authenticated;

grant execute on function public.issue_campaign_membership_invitation(uuid,uuid,uuid,bytea,timestamptz,integer,text,text,uuid) to authenticated;
grant execute on function public.accept_campaign_membership_invitation(uuid,bytea,text) to authenticated;
grant execute on function public.link_campaign_character(uuid,uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.unlink_campaign_character(uuid,uuid,uuid) to authenticated;
grant execute on function public.revoke_campaign_membership_invitation(uuid,uuid) to authenticated;
grant execute on function public.remove_campaign_member(uuid,uuid,uuid,text,bigint) to authenticated;
grant execute on function public.prepare_campaign_membership_manifest(uuid,uuid) to authenticated;
grant execute on function public.replace_campaign_membership_shadow(uuid,uuid,uuid,jsonb) to service_role;
grant execute on function public.classify_campaign_membership_shadow(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.begin_campaign_membership_freeze(uuid,uuid,text,bigint) to authenticated;
grant execute on function public.cancel_campaign_membership_freeze(uuid,uuid) to authenticated;
grant execute on function public.confirm_campaign_membership_cutover(uuid,uuid,text,bigint) to authenticated;
grant execute on function public.replay_campaign_membership_cutover(uuid,uuid,text,bigint) to authenticated;
grant execute on function public.rollback_campaign_membership(uuid,uuid,bigint,jsonb,text) to authenticated;
grant execute on function public.authorize_campaign_membership(uuid,bigint) to authenticated;
grant execute on function public.list_my_campaign_memberships() to authenticated;
grant execute on function public.resolve_campaign_membership_authority(text) to service_role;
