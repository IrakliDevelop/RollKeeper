begin;

select plan(47);

select has_table(
  'private',
  'campaign_guest_invitations',
  'guest invitations are private'
);

select is(
  (select relrowsecurity from pg_class where oid = 'private.campaign_guest_invitations'::regclass),
  true,
  'private invitations have defense-in-depth RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'private.campaign_guest_sessions'::regclass),
  true,
  'private guest sessions have defense-in-depth RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'private.guest_mutation_receipts'::regclass),
  true,
  'private guest receipts have defense-in-depth RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'private.guest_rate_limit_windows'::regclass),
  true,
  'private guest rate windows have defense-in-depth RLS enabled'
);

select ok(
  pg_get_functiondef(
    'private.redeem_campaign_guest_invitation(uuid,bytea,text,uuid,bytea,timestamptz)'::regprocedure
  ) like '%interval ''60 days''%',
  'redemption accepts the reviewed sixty-day fixed guest lifetime'
);
select ok(
  pg_get_functiondef(
    'private.rotate_campaign_guest_session(uuid,bytea,text,bytea,timestamptz)'::regprocedure
  ) like '%interval ''60 days''%',
  'rotation accepts the reviewed sixty-day fixed guest lifetime'
);
select has_table(
  'private',
  'campaign_guest_sessions',
  'guest sessions are private'
);
select has_table(
  'private',
  'guest_mutation_receipts',
  'guest mutation receipts are private'
);
select has_table(
  'private',
  'guest_rate_limit_windows',
  'guest rate limits are private'
);

select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anonymous clients cannot use the private schema'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated browser clients cannot use the private schema'
);
select ok(
  not has_table_privilege(
    'anon',
    'private.campaign_guest_invitations',
    'SELECT'
  ),
  'anonymous clients cannot read invitations'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'private.campaign_guest_sessions',
    'SELECT'
  ),
  'authenticated browser clients cannot read guest sessions'
);

select is(
  (select count(*)::integer
   from information_schema.columns
   where table_schema = 'private'
     and table_name = 'campaign_guest_invitations'
     and column_name in ('token', 'secret', 'raw_token')),
  0,
  'invitation storage has no raw secret column'
);
select is(
  (select count(*)::integer
   from information_schema.columns
   where table_schema = 'private'
     and table_name = 'campaign_guest_sessions'
     and column_name in ('token', 'secret', 'raw_token')),
  0,
  'session storage has no raw secret column'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.issue_campaign_guest_invitation(uuid,uuid,bytea,timestamptz,integer,text)',
    'EXECUTE'
  ),
  'authenticated owners can call the narrow issuance RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.issue_campaign_guest_invitation(uuid,uuid,bytea,timestamptz,integer,text)',
    'EXECUTE'
  ),
  'anonymous clients cannot issue guest invitations'
);
select ok(
  has_function_privilege(
    'service_role',
    'private.redeem_campaign_guest_invitation(uuid,bytea,text,uuid,bytea,timestamptz)',
    'EXECUTE'
  ),
  'only the application service can redeem invitations'
);
select ok(
  not has_function_privilege(
    'anon',
    'private.redeem_campaign_guest_invitation(uuid,bytea,text,uuid,bytea,timestamptz)',
    'EXECUTE'
  ),
  'anonymous browser clients cannot redeem through PostgREST directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.authorize_campaign_guest_session(bytea,text,text)',
    'EXECUTE'
  ),
  'authenticated browser clients cannot validate or inspect guest sessions directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.authorize_campaign_guest_session(bytea,text,text)',
    'EXECUTE'
  ),
  'the application service can call the narrow public authorization wrapper'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.authorize_campaign_guest_session(bytea,text,text)',
    'EXECUTE'
  ),
  'anonymous browsers cannot call the public authorization wrapper'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

create temporary table guest_workspace as
select public.create_campaign_workspace(
  '81000000-0000-4000-8000-000000000001',
  'Guest integration workspace',
  'new_workspace',
  null
) as result;
grant select on guest_workspace to service_role;

create temporary table issued_invitation as
select public.issue_campaign_guest_invitation(
  '82000000-0000-4000-8000-000000000001',
  (select (result ->> 'campaignId')::uuid from guest_workspace),
  extensions.digest('synthetic-invitation-token', 'sha256'),
  statement_timestamp() + interval '30 minutes',
  1,
  'bound-player-a'
) as result;
grant select on issued_invitation to service_role;

select is(
  result ->> 'legacyPlayerId',
  'bound-player-a',
  'owner issuance binds the approved legacy player ID'
)
from issued_invitation;
select is(
  result ->> 'maxUses',
  '1',
  'owner issuance records the maximum use count'
)
from issued_invitation;
select is(
  (select membership_authority
   from public.campaigns
   where id = (select (result ->> 'campaignId')::uuid from guest_workspace)),
  'legacy',
  'invitation issuance does not cut over membership'
);
select is(
  (select count(*)::integer
   from public.campaign_authority_records
   where campaign_id = (select (result ->> 'campaignId')::uuid from guest_workspace)
     and axis = 'durable_family'
     and authority = 'legacy'),
  8,
  'invitation issuance does not cut over a durable family'
);

select throws_ok(
  $$select public.issue_campaign_guest_invitation(
    '82000000-0000-4000-8000-000000000001',
    (select (result ->> 'campaignId')::uuid from guest_workspace),
    extensions.digest('changed-token', 'sha256'),
    statement_timestamp() + interval '30 minutes',
    1,
    'bound-player-a'
  )$$,
  '22023',
  'mutation ID was already used with different input',
  'changed-input issuance replay is denied'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000002',
  true
);
select throws_ok(
  $$select public.issue_campaign_guest_invitation(
    '82000000-0000-4000-8000-000000000002',
    (select (result ->> 'campaignId')::uuid from guest_workspace),
    extensions.digest('cross-account-token', 'sha256'),
    statement_timestamp() + interval '30 minutes',
    1,
    'bound-player-a'
  )$$,
  '42501',
  'campaign owner authorization is required',
  'another account cannot issue an invitation'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temporary table redeemed_session as
select private.redeem_campaign_guest_invitation(
  '83000000-0000-4000-8000-000000000001',
  extensions.digest('synthetic-invitation-token', 'sha256'),
  repeat('a', 64),
  '84000000-0000-4000-8000-000000000001',
  extensions.digest('synthetic-session-token', 'sha256'),
  statement_timestamp() + interval '4 hours'
) as result;
grant select on redeemed_session to authenticated, service_role;

select is(
  result ->> 'legacyPlayerId',
  'bound-player-a',
  'redemption copies only the server-approved player binding'
)
from redeemed_session;
reset role;
select is(
  (select use_count::text
   from private.campaign_guest_invitations
   where id = (select (result ->> 'invitationId')::uuid from redeemed_session)),
  '1',
  'redemption increments the invitation use count atomically'
);
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select lives_ok(
  $$select private.redeem_campaign_guest_invitation(
    '83000000-0000-4000-8000-000000000001',
    extensions.digest('synthetic-invitation-token', 'sha256'),
    repeat('a', 64),
    '84000000-0000-4000-8000-000000000001',
    extensions.digest('synthetic-session-token', 'sha256'),
    statement_timestamp() + interval '4 hours'
  )$$,
  'identical response-loss redemption replay returns its receipt'
);
select throws_ok(
  $$select private.redeem_campaign_guest_invitation(
    '83000000-0000-4000-8000-000000000001',
    extensions.digest('different-invitation-token', 'sha256'),
    repeat('b', 64),
    '84000000-0000-4000-8000-000000000002',
    extensions.digest('different-session-token', 'sha256'),
    statement_timestamp() + interval '4 hours'
  )$$,
  '22023',
  'mutation ID was already used with different input',
  'changed-input redemption replay is denied'
);
select throws_ok(
  $$select private.redeem_campaign_guest_invitation(
    '83000000-0000-4000-8000-000000000002',
    extensions.digest('synthetic-invitation-token', 'sha256'),
    repeat('c', 64),
    '84000000-0000-4000-8000-000000000003',
    extensions.digest('second-session-token', 'sha256'),
    statement_timestamp() + interval '4 hours'
  )$$,
  '42501',
  'guest invitation is not valid',
  'a maximum-use invitation cannot be redeemed again'
);

select is(
  private.authorize_campaign_guest_session(
    extensions.digest('synthetic-session-token', 'sha256'),
    (select result ->> 'displayCode' from guest_workspace),
    'player:sync'
  ) ->> 'legacyPlayerId',
  'bound-player-a',
  'active session authorization returns its immutable player binding'
);
select throws_ok(
  $$select private.authorize_campaign_guest_session(
    extensions.digest('synthetic-session-token', 'sha256'),
    'BAD0BAD0BAD0',
    'player:sync'
  )$$,
  '42501',
  'guest session is not authorized',
  'wrong campaign authorization is denied'
);
select throws_ok(
  $$select private.authorize_campaign_guest_session(
    extensions.digest('synthetic-session-token', 'sha256'),
    (select result ->> 'displayCode' from guest_workspace),
    'dm:read'
  )$$,
  '42501',
  'guest session is not authorized',
  'wrong and DM scopes are denied'
);

reset role;
update public.campaign_authority_records
set epoch = epoch + 1
where campaign_id = (select (result ->> 'campaignId')::uuid from guest_workspace)
  and axis = 'membership';
set local role service_role;
select throws_ok(
  $$select private.authorize_campaign_guest_session(
    extensions.digest('synthetic-session-token', 'sha256'),
    (select result ->> 'displayCode' from guest_workspace),
    'player:sync'
  )$$,
  '42501',
  'guest session is not authorized',
  'a stale membership epoch fails closed'
);
reset role;
update public.campaign_authority_records
set epoch = epoch - 1
where campaign_id = (select (result ->> 'campaignId')::uuid from guest_workspace)
  and axis = 'membership';
delete from public.campaign_authority_records
where campaign_id = (select (result ->> 'campaignId')::uuid from guest_workspace)
  and axis = 'live_runtime';
set local role service_role;
select throws_ok(
  $$select private.authorize_campaign_guest_session(
    extensions.digest('synthetic-session-token', 'sha256'),
    (select result ->> 'displayCode' from guest_workspace),
    'player:sync'
  )$$,
  '42501',
  'guest session is not authorized',
  'a missing live-runtime authority record fails closed'
);
reset role;
insert into public.campaign_authority_records (
  campaign_id, axis, family, authority, epoch
) values (
  (select (result ->> 'campaignId')::uuid from guest_workspace),
  'live_runtime', '__none__', 'redis_relay', 0
);
update public.campaign_authority_records
set epoch = epoch + 1
where campaign_id = (select (result ->> 'campaignId')::uuid from guest_workspace)
  and axis = 'durable_family'
  and family = 'calendar';
set local role service_role;
select lives_ok(
  $$select private.authorize_campaign_guest_session(
    extensions.digest('synthetic-session-token', 'sha256'),
    (select result ->> 'displayCode' from guest_workspace),
    'player:sync'
  )$$,
  'an unrelated durable-family epoch does not change guest membership authority'
);
reset role;
update public.campaign_authority_records
set epoch = epoch - 1
where campaign_id = (select (result ->> 'campaignId')::uuid from guest_workspace)
  and axis = 'durable_family'
  and family = 'calendar';
update public.campaigns
set membership_authority = 'postgres', membership_cutover_epoch = 1
where id = (select (result ->> 'campaignId')::uuid from guest_workspace);
update public.campaign_authority_records
set authority = 'postgres', epoch = 1
where campaign_id = (select (result ->> 'campaignId')::uuid from guest_workspace)
  and axis = 'membership';
set local role service_role;
select throws_ok(
  $$select private.authorize_campaign_guest_session(
    extensions.digest('synthetic-session-token', 'sha256'),
    (select result ->> 'displayCode' from guest_workspace),
    'player:sync'
  )$$,
  '42501',
  'guest session is not authorized',
  'membership-migrated campaigns reject the legacy hybrid guest session'
);
reset role;
update public.campaigns
set membership_authority = 'legacy', membership_cutover_epoch = 0
where id = (select (result ->> 'campaignId')::uuid from guest_workspace);
update public.campaign_authority_records
set authority = 'legacy', epoch = 0
where campaign_id = (select (result ->> 'campaignId')::uuid from guest_workspace)
  and axis = 'membership';
set local role service_role;

create temporary table rotated_session as
select private.rotate_campaign_guest_session(
  '85000000-0000-4000-8000-000000000001',
  extensions.digest('synthetic-session-token', 'sha256'),
  repeat('d', 64),
  extensions.digest('rotated-session-token', 'sha256'),
  statement_timestamp() + interval '4 hours'
) as result;
grant select on rotated_session to authenticated, service_role;

select throws_ok(
  $$select private.authorize_campaign_guest_session(
    extensions.digest('synthetic-session-token', 'sha256'),
    (select result ->> 'displayCode' from guest_workspace),
    'player:sync'
  )$$,
  '42501',
  'guest session is not authorized',
  'rotation invalidates the prior session immediately'
);
select is(
  private.authorize_campaign_guest_session(
    extensions.digest('rotated-session-token', 'sha256'),
    (select result ->> 'displayCode' from guest_workspace),
    'player:sync'
  ) ->> 'legacyPlayerId',
  'bound-player-a',
  'the rotated session retains the approved binding and scopes'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
select lives_ok(
  format(
    'select public.revoke_campaign_guest_invitation(%L::uuid, %L::uuid)',
    '87000000-0000-4000-8000-000000000001',
    (select result ->> 'invitationId' from redeemed_session)
  ),
  'the owner can revoke the invitation and its sessions'
);

reset role;
set local role service_role;
select throws_ok(
  $$select private.authorize_campaign_guest_session(
    extensions.digest('rotated-session-token', 'sha256'),
    (select result ->> 'displayCode' from guest_workspace),
    'player:sync'
  )$$,
  '42501',
  'guest session is not authorized',
  'invitation revocation takes effect for existing sessions immediately'
);

select ok(
  private.consume_guest_rate_limit(
    extensions.digest('synthetic-rate-key', 'sha256'),
    'redeem',
    1,
    60
  ),
  'the first bounded action is allowed'
);
select ok(
  not private.consume_guest_rate_limit(
    extensions.digest('synthetic-rate-key', 'sha256'),
    'redeem',
    1,
    60
  ),
  'a request over the rate limit is denied'
);

select * from finish();
rollback;
