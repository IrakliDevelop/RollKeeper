begin;

select plan(29);

select ok(has_function_privilege('authenticated','public.begin_calendar_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint)','EXECUTE'),'owner can begin calendar staging');
select ok(not has_function_privilege('anon','public.begin_calendar_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint)','EXECUTE'),'anon cannot stage calendars');
select ok(has_function_privilege('authenticated','public.put_calendar_document(uuid,uuid,bigint,text,text,bigint,integer,jsonb,text,bigint)','EXECUTE'),'owner can use calendar CAS');
select ok(not has_function_privilege('anon','public.put_calendar_document(uuid,uuid,bigint,text,text,bigint,integer,jsonb,text,bigint)','EXECUTE'),'anon cannot mutate calendars');
select ok(not has_function_privilege('authenticated','public.claim_calendar_projection_events(uuid,integer,integer)','EXECUTE'),'browser cannot claim calendar projection work');
select ok(has_function_privilege('service_role','public.claim_calendar_projection_events(uuid,integer,integer)','EXECUTE'),'service worker can claim calendar projection work');
select ok(not has_table_privilege('authenticated','private.campaign_document_versions','SELECT'),'history has no direct browser grant');
select ok(not has_table_privilege('authenticated','private.campaign_document_projection_outbox','SELECT'),'outbox has no direct browser grant');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

create temporary table calendar_workspace as
select public.create_campaign_workspace(
  'b1000000-0000-4000-8000-000000000001','Calendar test','new_workspace',null
) as result;
grant select on calendar_workspace to authenticated,service_role;

reset role;
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from calendar_workspace) and axis='durable_family' and family='calendar'),'legacy','calendar starts legacy');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from calendar_workspace) and axis='durable_family' and family='campaign_settings'),'legacy','calendar work does not activate settings');

create temporary table calendar_fixture as
select pg_catalog.jsonb_build_object(
  'config',pg_catalog.jsonb_build_object('clock',pg_catalog.jsonb_build_object('hoursPerDay',24),'weekDays','[]'::jsonb,'months','[]'::jsonb,'seasons','[]'::jsonb,'moons','[]'::jsonb,'namedYears','[]'::jsonb,'eras','[]'::jsonb,'yearOffset',0,'yearStartWeekdayOffset',0,'mechanics',pg_catalog.jsonb_build_object()),
  'currentTime',0,'startTime',0,'events',pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('id','evt-public','title','Festival','description','Known','year',1,'month',0,'day',1,'createdAt',1,'visibility','public'),
    pg_catalog.jsonb_build_object('id','evt-private','title','Secret','description','Hidden','year',1,'month',0,'day',2,'createdAt',2,'visibility','private')
  ),'weather','clear'
) as payload;
alter table calendar_fixture add column fingerprint text;
alter table calendar_fixture add column bytes integer;
update calendar_fixture set fingerprint=private.campaign_document_hash(payload),bytes=pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(payload),'UTF8'));
grant select on calendar_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select throws_ok(
  $$select public.begin_calendar_staging('b2000000-0000-4000-8000-000000000001',(select (result->>'campaignId')::uuid from calendar_workspace),'b3000000-0000-4000-8000-000000000001',0,repeat('a',64),repeat('b',64),repeat('b',64),1,(select bytes from calendar_fixture))$$,
  '42501','campaign owner authorization is required','other account cannot stage calendar'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
create temporary table calendar_run as
select public.begin_calendar_staging(
  'b2000000-0000-4000-8000-000000000002',(select (result->>'campaignId')::uuid from calendar_workspace),
  'b3000000-0000-4000-8000-000000000001',0,repeat('a',64),repeat('b',64),repeat('b',64),1,(select bytes from calendar_fixture)
) as result;
grant select on calendar_run to authenticated;
select is(result->>'state','staging','matching recovery receipt begins calendar staging') from calendar_run;
select is(
  public.stage_calendar_items(
    'b2000000-0000-4000-8000-000000000003',(select (result->>'runId')::uuid from calendar_run),
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('legacyId','ABC123','schemaVersion',1,'payload',(select payload from calendar_fixture),'payloadFingerprint',(select fingerprint from calendar_fixture),'tombstoned',false))
  )->>'state','validated','exact calendar item validates'
);
create temporary table calendar_cutover as
select public.confirm_calendar_cutover('b2000000-0000-4000-8000-000000000004',(select (result->>'runId')::uuid from calendar_run),repeat('a',64),0) as result;
grant select on calendar_cutover to authenticated,service_role;
select is(result->>'authority','postgres','explicit confirmation activates only calendar') from calendar_cutover;

reset role;
select is((select count(*) from public.campaign_documents where family='calendar'),1::bigint,'calendar current row created');
select is((select count(*) from private.campaign_document_versions where family='calendar'),1::bigint,'calendar version 1 created atomically');
select is((select count(*) from private.campaign_document_projection_outbox where family='calendar'),1::bigint,'calendar projection event created atomically');
select is((select count(*) from private.campaign_family_device_enrollments where family='calendar' and device_id='b3000000-0000-4000-8000-000000000001'),1::bigint,'initial device enrolled atomically');

create temporary table calendar_v2 as
select pg_catalog.jsonb_set(payload,'{currentTime}','1'::jsonb) as payload from calendar_fixture;
alter table calendar_v2 add column fingerprint text;
update calendar_v2 set fingerprint=private.campaign_document_hash(payload);
grant select on calendar_v2 to authenticated;
create temporary table calendar_tombstone_fingerprint as
select private.campaign_document_hash(
  pg_catalog.jsonb_build_object('legacyId','ABC123','tombstoned',true)
) as fingerprint;
grant select on calendar_tombstone_fingerprint to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select is(
  public.put_calendar_document('b2000000-0000-4000-8000-000000000005',(select (result->>'campaignId')::uuid from calendar_workspace),1,'ABC123','replace',1,1,(select payload from calendar_v2),(select fingerprint from calendar_v2))->>'serverVersion',
  '2','calendar CAS accepts the expected base version'
);
select is(
  public.put_calendar_document('b2000000-0000-4000-8000-000000000005',(select (result->>'campaignId')::uuid from calendar_workspace),1,'ABC123','replace',1,1,(select payload from calendar_v2),(select fingerprint from calendar_v2))->>'serverVersion',
  '2','response-loss retry returns the stored receipt'
);
select throws_ok(
  $$select public.put_calendar_document('b2000000-0000-4000-8000-000000000006',(select (result->>'campaignId')::uuid from calendar_workspace),1,'ABC123','replace',1,1,(select payload from calendar_v2),(select fingerprint from calendar_v2))$$,
  '40001','calendar server version conflict','stale CAS loses without overwrite'
);
select is((public.list_calendar_document_versions((select (result->>'campaignId')::uuid from calendar_workspace),'ABC123')->'versions'->0->>'serverVersion'),'2','history metadata is newest first');
select is((public.export_calendar_document_version((select (result->>'campaignId')::uuid from calendar_workspace),'ABC123',1)->'payload'->'events'->1->>'title'),'Secret','exact private history export remains owner-only');
select is(
  public.put_calendar_document('b2000000-0000-4000-8000-000000000008',(select (result->>'campaignId')::uuid from calendar_workspace),1,'ABC123','delete',2,1,null,(select fingerprint from calendar_tombstone_fingerprint))->>'tombstoned',
  'true','calendar deletion creates an explicit tombstone version'
);
select throws_ok(
  $$select public.put_calendar_document('b2000000-0000-4000-8000-000000000009',(select (result->>'campaignId')::uuid from calendar_workspace),1,'ABC123','replace',3,1,(select payload from calendar_fixture),(select fingerprint from calendar_fixture))$$,
  '55000','calendar tombstone cannot be resurrected without explicit history restore','ordinary writes cannot resurrect a calendar tombstone'
);
select is(
  public.restore_calendar_document_version('b2000000-0000-4000-8000-000000000010',(select (result->>'campaignId')::uuid from calendar_workspace),1,'ABC123',1,3)->>'serverVersion',
  '4','explicit owner history restore creates a new version after tombstone'
);
select is(public.remove_calendar_device('b2000000-0000-4000-8000-000000000007',(select (result->>'campaignId')::uuid from calendar_workspace),'b3000000-0000-4000-8000-000000000001',1)->>'state','removed','exact device removal succeeds');

reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select is((select campaign_code from public.claim_calendar_projection_events('b4000000-0000-4000-8000-000000000001',1,30) limit 1),'ABC123','worker receives only the preserved calendar compatibility code');
reset role;

select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from calendar_workspace) and axis='durable_family' and family='campaign_settings'),'legacy','calendar mutations never move settings authority');

select * from finish();
rollback;
