begin;

select plan(74);

select has_table('public', 'campaign_members', 'campaign members exist');
select has_table('public', 'campaign_character_links', 'explicit character links exist');
select has_table('private', 'campaign_membership_invitations', 'account invitations are private');
select has_table('private', 'campaign_membership_shadow_entries', 'legacy and guest shadow entries are private');
select has_table('private', 'campaign_membership_manifests', 'readiness manifests are private');
select has_table('private', 'campaign_membership_generations', 'rollback generations are private');
select has_table('private', 'campaign_membership_receipts', 'membership mutation receipts are private');
select has_table('private', 'campaign_membership_rate_limits', 'membership rate limits are private');

select is((select relrowsecurity from pg_class where oid = 'public.campaign_members'::regclass), true, 'member RLS is enabled');
select is((select relrowsecurity from pg_class where oid = 'public.campaign_character_links'::regclass), true, 'character-link RLS is enabled');
select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'anon cannot use the private schema');
select ok(not has_schema_privilege('authenticated', 'private', 'USAGE'), 'authenticated browsers cannot use private membership storage');
select ok(not has_table_privilege('anon', 'public.campaign_members', 'SELECT'), 'anon cannot read campaign members');
select ok(not has_table_privilege('anon', 'public.campaign_character_links', 'SELECT'), 'anon cannot read campaign character links');
select is((select count(*)::integer from information_schema.columns where table_schema = 'private' and table_name = 'campaign_membership_invitations' and column_name in ('token', 'secret', 'raw_token')), 0, 'invitation storage contains no raw secret');

select ok(has_function_privilege('authenticated', 'public.issue_campaign_membership_invitation(uuid,uuid,uuid,bytea,timestamptz,integer,text,text,uuid)', 'EXECUTE'), 'authenticated owners can call invitation issuance');
select ok(not has_function_privilege('anon', 'public.issue_campaign_membership_invitation(uuid,uuid,uuid,bytea,timestamptz,integer,text,text,uuid)', 'EXECUTE'), 'anon cannot issue membership invitations');
select ok(has_function_privilege('authenticated', 'public.accept_campaign_membership_invitation(uuid,bytea,text)', 'EXECUTE'), 'authenticated accounts can explicitly accept or refuse');
select ok(not has_function_privilege('anon', 'public.accept_campaign_membership_invitation(uuid,bytea,text)', 'EXECUTE'), 'anon cannot accept membership');
select ok(has_function_privilege('authenticated', 'public.link_campaign_character(uuid,uuid,uuid,text,text,uuid)', 'EXECUTE'), 'authenticated members can explicitly link an owned cloud character');
select ok(not has_function_privilege('anon', 'public.confirm_campaign_membership_cutover(uuid,uuid,text,bigint)', 'EXECUTE'), 'anon cannot confirm cutover');
select ok(not has_function_privilege('authenticated', 'public.resolve_campaign_membership_authority(text)', 'EXECUTE'), 'browser clients cannot inspect the server authority resolver');
select ok(has_function_privilege('service_role', 'public.resolve_campaign_membership_authority(text)', 'EXECUTE'), 'the application service can resolve membership authority');
select ok(has_function_privilege('authenticated', 'public.replay_campaign_membership_cutover(uuid,uuid,text,bigint)', 'EXECUTE'), 'authenticated owners can safely recover a committed cutover response');
select ok(has_function_privilege('authenticated', 'public.list_my_campaign_memberships()', 'EXECUTE'), 'authenticated accounts can restore their safe active-membership DTO');
select ok(not has_function_privilege('anon', 'public.list_my_campaign_memberships()', 'EXECUTE'), 'anon cannot list private account memberships');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

create temporary table membership_workspace as
select public.create_campaign_workspace(
  '91000000-0000-4000-8000-000000000001',
  'Membership cutover workspace',
  'new_workspace',
  null
) as result;
grant select on membership_workspace to service_role, authenticated;

create temporary table membership_invitation as
select public.issue_campaign_membership_invitation(
  '92000000-0000-4000-8000-000000000001',
  (select (result ->> 'campaignId')::uuid from membership_workspace),
  '20000000-0000-4000-8000-000000000002',
  extensions.digest('account-bound-membership-token', 'sha256'),
  statement_timestamp() + interval '30 minutes',
  1,
  'player',
  'legacy-player-a',
  null
) as result;
grant select on membership_invitation to authenticated;

select is(result ->> 'status', 'pending', 'owner issues a pending account-bound invitation') from membership_invitation;
select is((select membership_authority from public.campaigns where id = (select (result ->> 'campaignId')::uuid from membership_workspace)), 'legacy', 'invitation issuance does not cut over membership');

create temporary table refused_invitation as
select public.issue_campaign_membership_invitation(
  '92000000-0000-4000-8000-000000000002',
  (select (result ->> 'campaignId')::uuid from membership_workspace),
  '20000000-0000-4000-8000-000000000002',
  extensions.digest('membership-refusal-token', 'sha256'),
  statement_timestamp() + interval '30 minutes',1,'player','legacy-refused',null
) as result;
create temporary table revoked_invitation as
select public.issue_campaign_membership_invitation(
  '92000000-0000-4000-8000-000000000003',
  (select (result ->> 'campaignId')::uuid from membership_workspace),
  '20000000-0000-4000-8000-000000000002',
  extensions.digest('membership-revoked-token', 'sha256'),
  statement_timestamp() + interval '30 minutes',1,'player','legacy-revoked',null
) as result;
select is(
  public.revoke_campaign_membership_invitation(
    '92000000-0000-4000-8000-000000000004',
    (select (result ->> 'invitationId')::uuid from revoked_invitation)
  ) ->> 'status','revoked','the owner explicitly revokes a pending invitation'
);
create temporary table expired_invitation as
select public.issue_campaign_membership_invitation(
  '92000000-0000-4000-8000-000000000005',
  (select (result ->> 'campaignId')::uuid from membership_workspace),
  '20000000-0000-4000-8000-000000000002',
  extensions.digest('membership-expired-token', 'sha256'),
  statement_timestamp() + interval '30 minutes',1,'player','legacy-expired',null
) as result;

reset role;
update private.campaign_membership_invitations set expires_at=statement_timestamp()-interval '1 minute'
where token_hash=extensions.digest('membership-expired-token','sha256');
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.accept_campaign_membership_invitation(
    '93000000-0000-4000-8000-000000000001',
    extensions.digest('account-bound-membership-token', 'sha256'),
    'accepted'
  )$$,
  '42501',
  'membership invitation is not valid',
  'a different account cannot accept the invitation'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select is(
  public.accept_campaign_membership_invitation(
    '93000000-0000-4000-8000-000000000004',
    extensions.digest('membership-refusal-token','sha256'),'refused'
  ) ->> 'status','refused','the invited account can explicitly refuse without becoming a member'
);
select is((select count(*)::integer from public.campaign_members where campaign_id=(select (result ->> 'campaignId')::uuid from membership_workspace) and user_id=auth.uid()),0,'refusal creates no campaign membership');
select throws_ok(
  $$select public.accept_campaign_membership_invitation(
    '93000000-0000-4000-8000-000000000005',extensions.digest('membership-revoked-token','sha256'),'accepted'
  )$$,'42501','membership invitation is not valid','a revoked invitation cannot be accepted'
);
select throws_ok(
  $$select public.accept_campaign_membership_invitation(
    '93000000-0000-4000-8000-000000000006',extensions.digest('membership-expired-token','sha256'),'accepted'
  )$$,'42501','membership invitation is not valid','an expired invitation cannot be accepted'
);
select throws_ok(
  $$select public.accept_campaign_membership_invitation(
    '93000000-0000-4000-8000-000000000007',extensions.digest('fabricated-membership-token','sha256'),'accepted'
  )$$,'42501','membership invitation is not valid','a fabricated invitation cannot be accepted'
);
create temporary table accepted_membership as
select public.accept_campaign_membership_invitation(
  '93000000-0000-4000-8000-000000000002',
  extensions.digest('account-bound-membership-token', 'sha256'),
  'accepted'
) as result;

select is(result ->> 'status', 'active', 'the bound account explicitly accepts membership') from accepted_membership;
select is(
  public.accept_campaign_membership_invitation(
    '93000000-0000-4000-8000-000000000002',
    extensions.digest('account-bound-membership-token', 'sha256'),
    'accepted'
  ),
  (select result from accepted_membership),
  'identical response-loss acceptance replay returns the stored response'
);
select throws_ok(
  $$select public.accept_campaign_membership_invitation(
    '93000000-0000-4000-8000-000000000002',
    extensions.digest('account-bound-membership-token', 'sha256'),
    'refused'
  )$$,
  '22023',
  'mutation ID was already used with different input',
  'changed-input acceptance replay is denied'
);

select is((select count(*)::integer from public.campaign_members where campaign_id = (select (result ->> 'campaignId')::uuid from membership_workspace) and user_id = auth.uid() and status = 'active'), 1, 'acceptance creates one active account membership');
select is((select count(*)::integer from public.campaign_character_links where campaign_id = (select (result ->> 'campaignId')::uuid from membership_workspace)), 0, 'acceptance never uploads or links a character');
select is(
  public.list_my_campaign_memberships() #>> '{memberships,0,campaignId}',
  (select result ->> 'campaignId' from membership_workspace),
  'an accepted account can restore only its safe active campaign DTO after reload'
);

reset role;
insert into public.characters(
  id,owner_id,legacy_client_id,name,payload,schema_version,client_revision,server_version
) values
  ('94000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','legacy-character-a','Account character',jsonb_build_object('id','legacy-character-a'),1,0,1),
  ('94000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','foreign-character','Foreign character',jsonb_build_object('id','foreign-character'),1,0,1);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.link_campaign_character(
    '95000000-0000-4000-8000-000000000001',
    (select (result ->> 'campaignId')::uuid from membership_workspace),
    '94000000-0000-4000-8000-000000000002',
    'legacy-player-a','foreign-character',null
  )$$,
  '42501',
  'active membership and owned cloud character are required',
  'a member cannot link another account character'
);
create temporary table linked_character as
select public.link_campaign_character(
  '95000000-0000-4000-8000-000000000002',
  (select (result ->> 'campaignId')::uuid from membership_workspace),
  '94000000-0000-4000-8000-000000000001',
  'legacy-player-a','legacy-character-a',null
) as result;
select is(result ->> 'status','active','a member explicitly links an owned cloud character') from linked_character;

reset role;
select is((select owner_id::text from public.characters where id='94000000-0000-4000-8000-000000000001'),'20000000-0000-4000-8000-000000000002','character ownership is unchanged by linking');

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
create temporary table replaced_shadow as
select public.replace_campaign_membership_shadow(
  '96000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  (select (result ->> 'campaignId')::uuid from membership_workspace),
  jsonb_build_array(jsonb_build_object(
    'kind','legacy_roster','sourceId','legacy-player-a','label','Synthetic player',
    'fingerprint',repeat('a',64)
  ))
) as result;
select is(result ->> 'entryCount','1','server reconciliation shadows every supplied legacy entry') from replaced_shadow;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
create temporary table ready_manifest as
select public.prepare_campaign_membership_manifest(
  '97000000-0000-4000-8000-000000000001',
  (select (result ->> 'campaignId')::uuid from membership_workspace)
) as result;
grant select on ready_manifest to authenticated, service_role;
select is(result ->> 'blockerCount','0','accepted membership and explicit link satisfy the complete manifest') from ready_manifest;
select is(
  public.begin_campaign_membership_freeze(
    '97000000-0000-4000-8000-000000000002',
    (select (result ->> 'campaignId')::uuid from membership_workspace),
    (select result ->> 'fingerprint' from ready_manifest),
    (select (result ->> 'version')::bigint from ready_manifest)
  ) ->> 'state',
  'freezing',
  'owner explicitly freezes join and removal against the exact manifest'
);
create temporary table cutover_result as
select public.confirm_campaign_membership_cutover(
  '97000000-0000-4000-8000-000000000003',
  (select (result ->> 'campaignId')::uuid from membership_workspace),
  (select result ->> 'fingerprint' from ready_manifest),
  (select (result ->> 'version')::bigint from ready_manifest)
) as result;
select is(result ->> 'authority','postgres','successful confirmation atomically cuts over membership') from cutover_result;
select is(result ->> 'epoch','1','the first cutover creates membership epoch one') from cutover_result;
select is(
  public.confirm_campaign_membership_cutover(
    '97000000-0000-4000-8000-000000000003',
    (select (result ->> 'campaignId')::uuid from membership_workspace),
    (select result ->> 'fingerprint' from ready_manifest),
    (select (result ->> 'version')::bigint from ready_manifest)
  ),
  (select result from cutover_result),
  'cutover response-loss replay returns the committed epoch without fallback'
);
select is(
  public.replay_campaign_membership_cutover(
    '97000000-0000-4000-8000-000000000003',
    (select (result ->> 'campaignId')::uuid from membership_workspace),
    (select result ->> 'fingerprint' from ready_manifest),
    (select (result ->> 'version')::bigint from ready_manifest)
  ),
  (select result from cutover_result),
  'the HTTP orchestration replay probe recovers the committed result before refreezing'
);
select throws_ok(
  $$select public.confirm_campaign_membership_cutover(
    '97000000-0000-4000-8000-000000000003',
    (select (result ->> 'campaignId')::uuid from membership_workspace),
    repeat('f',64),
    (select (result ->> 'version')::bigint from ready_manifest)
  )$$,
  '22023','mutation ID was already used with different input',
  'changed-input cutover replay is denied'
);
select is((select membership_authority from public.campaigns where id=(select (result ->> 'campaignId')::uuid from membership_workspace)),'postgres','campaign row records Postgres-primary membership');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result ->> 'campaignId')::uuid from membership_workspace) and axis='membership'),'postgres','authority record flips in the same transaction');
select is((select count(*)::integer from public.campaign_authority_records where campaign_id=(select (result ->> 'campaignId')::uuid from membership_workspace) and axis='durable_family' and authority='legacy'),8,'cutover changes no durable DM family');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result ->> 'campaignId')::uuid from membership_workspace) and axis='live_runtime'),'redis_relay','cutover leaves Redis and relay live runtime unchanged');
savepoint verified_server_generation;
select is(
  public.rollback_campaign_membership(
    '97000000-0000-4000-8000-000000000099',
    (select (result ->> 'campaignId')::uuid from membership_workspace),1,
    jsonb_build_object('acceptedMembers','[]'::jsonb,'characterLinks','[]'::jsonb),
    (select result ->> 'fingerprint' from ready_manifest)
  ) ->> 'authority',
  'legacy',
  'rollback trusts only the recorded verified generation, never the client copy'
);
rollback to savepoint verified_server_generation;

reset role;
create temporary table saved_membership_authority as
select * from public.campaign_authority_records
where campaign_id=(select (result ->> 'campaignId')::uuid from membership_workspace)
  and axis='membership' and family='__none__';
create temporary table saved_membership_campaign as
select display_code from public.campaigns
where id=(select (result ->> 'campaignId')::uuid from membership_workspace);
grant select on saved_membership_campaign to service_role;
delete from public.campaign_authority_records
where campaign_id=(select (result ->> 'campaignId')::uuid from membership_workspace)
  and axis='membership' and family='__none__';
set local role service_role;
select throws_ok(
  $$select public.resolve_campaign_membership_authority(
    (select display_code from saved_membership_campaign)
  )$$,
  '40001','membership authority record is missing',
  'a missing post-cutover authority record fails closed instead of falling back to legacy membership'
);
reset role;
insert into public.campaign_authority_records select * from saved_membership_authority;
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select is(
  public.authorize_campaign_membership(
    (select (result ->> 'campaignId')::uuid from membership_workspace),1
  ) ->> 'legacyPlayerId',
  'legacy-player-a',
  'Postgres-primary authorization returns only the explicit member link'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select throws_ok(
  $$select public.remove_campaign_member(
    '98000000-0000-4000-8000-000000000002',
    (select (result ->> 'campaignId')::uuid from membership_workspace),
    '20000000-0000-4000-8000-000000000002','request-body-impostor',1
  )$$,
  '42501','explicit member link is required',
  'a request-body player ID cannot select a Postgres member for removal'
);
select is(
  public.remove_campaign_member(
    '98000000-0000-4000-8000-000000000001',
    (select (result ->> 'campaignId')::uuid from membership_workspace),
    '20000000-0000-4000-8000-000000000002','legacy-player-a',1
  ) ->> 'status',
  'removed',
  'owner removes Postgres membership first'
);
reset role;
select is((select count(*)::integer from public.characters where id='94000000-0000-4000-8000-000000000001' and owner_id='20000000-0000-4000-8000-000000000002'),1,'membership removal does not delete or transfer the personal character');

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select throws_ok(
  $$select public.authorize_campaign_membership(
    (select (result ->> 'campaignId')::uuid from membership_workspace),1
  )$$,
  '42501','account membership is required','removed member immediately loses campaign authority'
);
select is((select count(*)::integer from public.campaign_members where campaign_id=(select (result ->> 'campaignId')::uuid from membership_workspace)),0,'removed member RLS hides campaign membership rows');
select is((select count(*)::integer from public.campaign_character_links where campaign_id=(select (result ->> 'campaignId')::uuid from membership_workspace)),0,'removed member RLS hides campaign character links');
select is(public.list_my_campaign_memberships() -> 'memberships', '[]'::jsonb, 'removed accounts restore no campaign membership DTO');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
create temporary table rollback_manifest as
select public.prepare_campaign_membership_manifest(
  '99000000-0000-4000-8000-000000000001',
  (select (result ->> 'campaignId')::uuid from membership_workspace)
) as result;
select throws_ok(
  $$select public.rollback_campaign_membership(
    '99000000-0000-4000-8000-000000000003',
    (select (result ->> 'campaignId')::uuid from membership_workspace),1,
    (select result -> 'manifest' from rollback_manifest),
    (select result ->> 'fingerprint' from rollback_manifest)
  )$$,
  '40001','verified complete membership generation is required',
  'rollback rejects an unrecorded post-cutover manifest even when its hash is internally consistent'
);
create temporary table rollback_result as
select public.rollback_campaign_membership(
  '99000000-0000-4000-8000-000000000002',
  (select (result ->> 'campaignId')::uuid from membership_workspace),1,
  (select result -> 'manifest' from ready_manifest),
  (select result ->> 'fingerprint' from ready_manifest)
) as result;
select is(result ->> 'authority','legacy','verified rollback restores legacy membership authority') from rollback_result;
select is(result ->> 'epoch','2','rollback creates a new epoch instead of rewinding') from rollback_result;
reset role;
select ok(
  (select count(*) from private.campaign_membership_shadow_entries where campaign_id=(select (result ->> 'campaignId')::uuid from membership_workspace)) >= 1
  and (select count(*) from private.campaign_membership_manifests where campaign_id=(select (result ->> 'campaignId')::uuid from membership_workspace)) >= 2
  and (select count(*) from private.campaign_membership_generations where campaign_id=(select (result ->> 'campaignId')::uuid from membership_workspace)) = 2,
  'cutover and rollback preserve shadows, manifests, and both authority generations'
);

insert into private.campaign_membership_rate_limits(key_hash,action,window_started_at,request_count)
values
  (extensions.digest('10000000-0000-4000-8000-000000000001:'||(select result->>'campaignId' from membership_workspace),'sha256'),'issue',statement_timestamp(),20),
  (extensions.digest('10000000-0000-4000-8000-000000000001:'||(select result->>'campaignId' from membership_workspace),'sha256'),'validate',statement_timestamp(),30),
  (extensions.digest('10000000-0000-4000-8000-000000000001:'||(select result->>'campaignId' from membership_workspace),'sha256'),'cutover',statement_timestamp(),10),
  (extensions.digest('20000000-0000-4000-8000-000000000002','sha256'),'accept',statement_timestamp(),30)
on conflict(key_hash,action) do update set window_started_at=excluded.window_started_at,request_count=excluded.request_count;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select throws_ok(
  $$select public.issue_campaign_membership_invitation(
    '99000000-0000-4000-8000-000000000010',(select (result->>'campaignId')::uuid from membership_workspace),
    '20000000-0000-4000-8000-000000000002',extensions.digest('rate-issue','sha256'),
    statement_timestamp()+interval '30 minutes',1,'player','rate-player',null
  )$$,'P0001','membership invitation rate limit exceeded','invitation issuance is transactionally rate limited'
);
select throws_ok(
  $$select public.prepare_campaign_membership_manifest(
    '99000000-0000-4000-8000-000000000011',(select (result->>'campaignId')::uuid from membership_workspace)
  )$$,'P0001','membership validation rate limit exceeded','readiness validation is transactionally rate limited'
);
select throws_ok(
  $$select public.confirm_campaign_membership_cutover(
    '99000000-0000-4000-8000-000000000012',(select (result->>'campaignId')::uuid from membership_workspace),
    (select result->>'fingerprint' from ready_manifest),(select (result->>'version')::bigint from ready_manifest)
  )$$,'P0001','membership cutover rate limit exceeded','cutover confirmation is transactionally rate limited'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select throws_ok(
  $$select public.accept_campaign_membership_invitation(
    '99000000-0000-4000-8000-000000000013',extensions.digest('rate-accept','sha256'),'accepted'
  )$$,'P0001','membership acceptance rate limit exceeded','invitation acceptance is transactionally rate limited'
);
reset role;

select * from finish();
rollback;
