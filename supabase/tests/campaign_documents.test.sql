begin;

select plan(47);

select has_table('public', 'campaign_documents', 'current campaign documents exist');
select has_table('private', 'campaign_document_versions', 'immutable document history is private');
select has_table('private', 'campaign_document_staging_runs', 'staging runs are private');
select has_table('private', 'campaign_document_staging_items', 'staging items are private');
select has_table('private', 'campaign_document_manifests', 'manifests are private');
select has_table('private', 'campaign_document_recovery_receipts', 'recovery receipts are private');
select has_table('private', 'campaign_document_mutation_receipts', 'mutation receipts are private');
select has_table('private', 'campaign_document_projection_outbox', 'projection outbox is private');
select has_table('private', 'campaign_document_projection_incidents', 'projection incidents are private');
select has_table('private', 'campaign_family_cutover_generations', 'cutover generations are private');
select has_table('private', 'campaign_family_device_enrollments', 'device enrollments are private');

select is((select relrowsecurity from pg_class where oid = 'public.campaign_documents'::regclass), true, 'current document RLS is enabled');
select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'anon cannot use private durable-family storage');
select ok(not has_schema_privilege('authenticated', 'private', 'USAGE'), 'browser clients cannot use private durable-family storage');
select ok(not has_table_privilege('anon', 'public.campaign_documents', 'SELECT'), 'anon receives no private document grant');
select ok(not has_table_privilege('authenticated', 'public.campaign_documents', 'INSERT'), 'browsers cannot insert current rows directly');
select ok(not has_table_privilege('authenticated', 'public.campaign_documents', 'UPDATE'), 'browsers cannot update current rows directly');
select ok(not has_table_privilege('authenticated', 'public.campaign_documents', 'DELETE'), 'browsers cannot delete current rows directly');

select ok(has_function_privilege('authenticated', 'public.put_campaign_document(uuid,uuid,text,bigint,text,text,bigint,integer,jsonb,text,bigint)', 'EXECUTE'), 'authenticated owners can use the CAS mutation RPC');
select ok(not has_function_privilege('anon', 'public.put_campaign_document(uuid,uuid,text,bigint,text,text,bigint,integer,jsonb,text,bigint)', 'EXECUTE'), 'anon cannot mutate documents');
select ok(has_function_privilege('authenticated', 'public.list_campaign_document_versions(uuid,text,text)', 'EXECUTE'), 'owners can request metadata-first history');
select ok(not has_function_privilege('anon', 'public.list_campaign_document_versions(uuid,text,text)', 'EXECUTE'), 'anon cannot list history');
select ok(has_function_privilege('authenticated', 'public.restore_campaign_document_version(uuid,uuid,text,bigint,text,bigint,bigint)', 'EXECUTE'), 'owners can restore an exact version as a new version');
select ok(not has_function_privilege('authenticated', 'public.claim_campaign_document_projection_events(uuid,integer,integer)', 'EXECUTE'), 'browser clients cannot claim projection work');
select ok(has_function_privilege('service_role', 'public.claim_campaign_document_projection_events(uuid,integer,integer)', 'EXECUTE'), 'only the application worker can claim projection work');
select ok(has_function_privilege('authenticated', 'public.preview_campaign_settings_device_enrollment(uuid)', 'EXECUTE'), 'owners can explicitly preview device enrollment');
select ok(not has_function_privilege('anon', 'public.preview_campaign_settings_device_enrollment(uuid)', 'EXECUTE'), 'anon cannot preview device enrollment');
select ok(has_function_privilege('authenticated', 'public.repair_campaign_document_current_from_history(uuid,uuid,text,bigint,text,bigint,text)', 'EXECUTE'), 'owners can explicitly repair current state from history');
select ok(not has_function_privilege('anon', 'public.repair_campaign_document_current_from_history(uuid,uuid,text,bigint,text,bigint,text)', 'EXECUTE'), 'anon cannot repair current documents');
select ok(has_function_privilege('service_role', 'public.resolve_campaign_settings_projection_authority(text)', 'EXECUTE'), 'the application can resolve projection authority');
select ok(not has_function_privilege('authenticated', 'public.resolve_campaign_settings_projection_authority(text)', 'EXECUTE'), 'browser clients cannot resolve authority by campaign code');
select ok(has_function_privilege('authenticated', 'public.list_campaign_document_projection_incidents(uuid,text)', 'EXECUTE'), 'owners can inspect sanitized projection incidents');
select ok(not has_function_privilege('anon', 'public.list_campaign_document_projection_incidents(uuid,text)', 'EXECUTE'), 'anon cannot inspect projection incidents');
select ok(has_function_privilege('authenticated', 'public.replay_campaign_document_projection_event(uuid,uuid,bigint,uuid)', 'EXECUTE'), 'owners can manually replay an exact dead event');
select ok(not has_function_privilege('anon', 'public.replay_campaign_document_projection_event(uuid,uuid,bigint,uuid)', 'EXECUTE'), 'anon cannot replay projection work');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

create temporary table document_workspace as
select public.create_campaign_workspace(
  'a1000000-0000-4000-8000-000000000001',
  'Campaign settings canary',
  'new_workspace',
  null
) as result;
grant select on document_workspace to authenticated, service_role;

select throws_ok(
  $$select public.put_campaign_document(
    'a2000000-0000-4000-8000-000000000001',
    (select (result ->> 'campaignId')::uuid from document_workspace),
    'campaign_settings',0,'ABC123','create',0,1,
    jsonb_build_object('stackableInspiration',true),'e45bf58f2d3ecfade94005585895cb74e68f1035737f9912cbaae022189d03fb'
  )$$,
  '55000','campaign family authority is not postgres',
  'ordinary mutation cannot create rows before explicit cutover'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.begin_campaign_settings_staging(
    'a3000000-0000-4000-8000-000000000001',
    (select (result ->> 'campaignId')::uuid from document_workspace),
    '40000000-0000-4000-8000-000000000004',0,repeat('b',64),
    repeat('c',64),repeat('c',64),1,29
  )$$,
  '42501','campaign owner authorization is required',
  'another account cannot stage by body campaign ID'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
create temporary table staging_run as
select public.begin_campaign_settings_staging(
  'a3000000-0000-4000-8000-000000000002',
  (select (result ->> 'campaignId')::uuid from document_workspace),
  '40000000-0000-4000-8000-000000000004',0,repeat('b',64),
  repeat('c',64),repeat('c',64),1,29
) as result;

select is(result ->> 'state','staging','matching recovery receipt opens private staging') from staging_run;
select is(
  public.stage_campaign_settings_items(
    'a3000000-0000-4000-8000-000000000003',
    (select (result ->> 'runId')::uuid from staging_run),
    jsonb_build_array(jsonb_build_object(
      'legacyId','ABC123','schemaVersion',1,
      'payload',jsonb_build_object('stackableInspiration',true),
      'payloadFingerprint','e45bf58f2d3ecfade94005585895cb74e68f1035737f9912cbaae022189d03fb','tombstoned',false
    ))
  ) ->> 'itemCount','1','validated staging retains the exact canary document'
);

create temporary table cutover_result as
select public.confirm_campaign_settings_cutover(
  'a3000000-0000-4000-8000-000000000004',
  (select (result ->> 'runId')::uuid from staging_run),
  repeat('b',64),0
) as result;

select is(result ->> 'authority','postgres','exact confirmation atomically activates only campaign_settings') from cutover_result;
reset role;
select ok(
  (select count(*) from public.campaign_documents) = 1
  and (select count(*) from private.campaign_document_versions) = 1
  and (select count(*) from private.campaign_document_projection_outbox) = 1
  and (select count(*) from private.campaign_document_mutation_receipts) >= 1,
  'initial cutover atomically creates current, version 1, projection event, and receipt'
);

select is(
  (select count(*) from private.campaign_family_device_enrollments
   where campaign_id=(select (result ->> 'campaignId')::uuid from document_workspace)
     and family='campaign_settings'
     and device_id='40000000-0000-4000-8000-000000000004'),
  1::bigint,
  'initial cutover atomically enrolls the exact staging device for later exact-device removal'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.remove_campaign_settings_device(
    'a3000000-0000-4000-8000-000000000007',
    (select (result ->> 'campaignId')::uuid from document_workspace),
    '40000000-0000-4000-8000-000000000099',1
  )$$,
  '55000','exact enrolled device is required',
  'device removal rejects a different device identity'
);
select is(
  public.remove_campaign_settings_device(
    'a3000000-0000-4000-8000-000000000008',
    (select (result ->> 'campaignId')::uuid from document_workspace),
    '40000000-0000-4000-8000-000000000004',1
  ) ->> 'state',
  'removed',
  'the exact staging device can be removed after initial cutover'
);
reset role;

create temporary table private_only_document_change as
select
  jsonb_build_object(
    'stackableInspiration', true,
    'dmDashboardUi', jsonb_build_object('npcSectionOpen', false)
  ) as payload;
alter table private_only_document_change add column fingerprint text;
update private_only_document_change
set fingerprint = private.campaign_document_hash(payload);
grant select on private_only_document_change to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select public.put_campaign_document(
  'a3000000-0000-4000-8000-000000000005',
  (select (result ->> 'campaignId')::uuid from document_workspace),
  'campaign_settings',1,'ABC123','replace',1,1,
  (select payload from private_only_document_change),
  (select fingerprint from private_only_document_change)
);
reset role;

select is(
  (select count(*) from private.campaign_document_projection_outbox),
  1::bigint,
  'private-only campaign settings changes create no projection event'
);

select is(
  (select authority from public.campaign_authority_records
   where campaign_id=(select (result ->> 'campaignId')::uuid from document_workspace)
     and axis='durable_family' and family='calendar'),
  'legacy','later durable families remain untouched'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(
  (select campaign_code from public.claim_campaign_document_projection_events(
    'a3000000-0000-4000-8000-000000000006', 1, 30
  ) limit 1),
  'ABC123',
  'projection work targets the preserved legacy compatibility code'
);
reset role;

select * from finish();
rollback;
