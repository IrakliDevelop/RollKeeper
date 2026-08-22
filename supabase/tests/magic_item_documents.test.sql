begin;

select plan(35);

select ok(has_function_privilege('authenticated','public.begin_magic_item_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint)','EXECUTE'),'owner can begin magic item staging');
select ok(not has_function_privilege('anon','public.begin_magic_item_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint)','EXECUTE'),'anon cannot stage magic items');
select ok(has_function_privilege('authenticated','public.put_magic_item_document(uuid,uuid,bigint,text,text,bigint,integer,jsonb,text,bigint)','EXECUTE'),'owner can use magic item CAS');
select ok(not has_function_privilege('anon','public.put_magic_item_document(uuid,uuid,bigint,text,text,bigint,integer,jsonb,text,bigint)','EXECUTE'),'anon cannot mutate magic items');
select ok(not has_table_privilege('authenticated','private.campaign_document_versions','SELECT'),'magic item history has no direct browser grant');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

create temporary table magic_workspace as
select public.create_campaign_workspace(
  'c1000000-0000-4000-8000-000000000001','Magic item test','new_workspace',null
) as result;
grant select on magic_workspace to authenticated;

reset role;
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from magic_workspace) and axis='durable_family' and family='magic_item'),'legacy','magic item family starts legacy');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from magic_workspace) and axis='durable_family' and family='calendar'),'legacy','magic item work does not activate calendars');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from magic_workspace) and axis='durable_family' and family='campaign_settings'),'legacy','magic item work does not activate settings');

create temporary table magic_fixture as
select 'magic-a'::text as legacy_id, pg_catalog.jsonb_build_object(
  'name','Staff of Embers','category','Staff','rarity','Rare',
  'description','A charred oak staff that hums with heat.',
  'properties',pg_catalog.jsonb_build_array('Requires attunement'),
  'tags',pg_catalog.jsonb_build_array('fire','staff'),
  'requiresAttunement',true,'isAttuned',false,'isEquipped',false,
  'charges',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','chg-1','label','Ember','max',3,'current',3)),
  'chargePool',pg_catalog.jsonb_build_object('max',5,'current',5,'abilities',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','abl-1','name','Flare','cost',2))),
  'bonusSpellAttack',1,'bonusSpellSaveDc',1,
  'legacyCharges',pg_catalog.jsonb_build_object('max',3,'current',3),
  'createdAt','2026-08-01T00:00:00.000Z','updatedAt','2026-08-02T00:00:00.000Z',
  'group','Arcane','sourceItemId','srd-staff-of-embers'
) as payload
union all
select 'magic-b'::text, pg_catalog.jsonb_build_object(
  'name','Charm of Quiet Steps','category','Wondrous item','rarity','Common',
  'description','A plain charm carved from bone.',
  'properties','[]'::jsonb,'tags','[]'::jsonb,'requiresAttunement',false,
  'createdAt','2026-08-01T00:00:00.000Z','updatedAt','2026-08-01T00:00:00.000Z',
  'group',null
);
alter table magic_fixture add column fingerprint text;
alter table magic_fixture add column bytes integer;
update magic_fixture set fingerprint=private.campaign_document_hash(payload),bytes=pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(payload),'UTF8'));
grant select on magic_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select throws_ok(
  $$select public.begin_magic_item_staging('c2000000-0000-4000-8000-000000000001',(select (result->>'campaignId')::uuid from magic_workspace),'c3000000-0000-4000-8000-000000000001',0,repeat('a',64),repeat('b',64),repeat('b',64),2,(select sum(bytes) from magic_fixture))$$,
  '42501','campaign owner authorization is required','other account cannot stage magic items'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
create temporary table magic_run as
select public.begin_magic_item_staging(
  'c2000000-0000-4000-8000-000000000002',(select (result->>'campaignId')::uuid from magic_workspace),
  'c3000000-0000-4000-8000-000000000001',0,repeat('a',64),repeat('b',64),repeat('b',64),2,(select sum(bytes) from magic_fixture)
) as result;
grant select on magic_run to authenticated;
select is(result->>'state','staging','matching recovery receipt begins magic item staging') from magic_run;
select is(
  public.stage_magic_item_items(
    'c2000000-0000-4000-8000-000000000003',(select (result->>'runId')::uuid from magic_run),
    (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('legacyId',legacy_id,'schemaVersion',1,'payload',payload,'payloadFingerprint',fingerprint,'tombstoned',false) order by legacy_id) from magic_fixture)
  )->>'state','validated','every staged magic item validates against the manifest'
);
create temporary table magic_cutover as
select public.confirm_magic_item_cutover('c2000000-0000-4000-8000-000000000004',(select (result->>'runId')::uuid from magic_run),repeat('a',64),0) as result;
grant select on magic_cutover to authenticated;
select is(result->>'authority','postgres','explicit confirmation activates only magic items') from magic_cutover;
select is(result->>'recordCount','2','cutover reports the whole staged library') from magic_cutover;

reset role;
select is((select count(*) from public.campaign_documents where family='magic_item' and campaign_id=(select (result->>'campaignId')::uuid from magic_workspace)),2::bigint,'magic item current rows created');
select is((select count(*) from private.campaign_document_versions where family='magic_item' and campaign_id=(select (result->>'campaignId')::uuid from magic_workspace)),2::bigint,'magic item version 1 rows created atomically');
select is((select count(*) from private.campaign_document_projection_outbox where family='magic_item'),0::bigint,'magic items never queue projection work');
select throws_ok(
  $$insert into private.campaign_document_projection_outbox(campaign_id,campaign_document_version_id,family,legacy_id,server_version,cutover_epoch,projection_kind,source_fingerprint)
    select v.campaign_id,v.id,'magic_item',v.legacy_id,v.server_version,v.cutover_epoch,'calendar_v1',v.payload_fingerprint
    from private.campaign_document_versions v where v.family='magic_item' limit 1$$,
  '23514',null,'the projection outbox structurally rejects the magic item family'
);
select is((select count(*) from private.campaign_family_device_enrollments where family='magic_item' and device_id='c3000000-0000-4000-8000-000000000001'),1::bigint,'initial magic item device enrolled atomically');

create temporary table magic_v2 as
select pg_catalog.jsonb_set(payload,'{updatedAt}','"2026-08-03T00:00:00.000Z"'::jsonb) as payload
from magic_fixture where legacy_id='magic-a';
alter table magic_v2 add column fingerprint text;
update magic_v2 set fingerprint=private.campaign_document_hash(payload);
grant select on magic_v2 to authenticated;
create temporary table magic_tombstone_fingerprint as
select private.campaign_document_hash(
  pg_catalog.jsonb_build_object('legacyId','magic-a','tombstoned',true)
) as fingerprint;
grant select on magic_tombstone_fingerprint to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select is(
  public.put_magic_item_document('c2000000-0000-4000-8000-000000000005',(select (result->>'campaignId')::uuid from magic_workspace),1,'magic-a','replace',1,1,(select payload from magic_v2),(select fingerprint from magic_v2))->>'serverVersion',
  '2','magic item CAS accepts the expected base version'
);
select is(
  public.put_magic_item_document('c2000000-0000-4000-8000-000000000005',(select (result->>'campaignId')::uuid from magic_workspace),1,'magic-a','replace',1,1,(select payload from magic_v2),(select fingerprint from magic_v2))->>'serverVersion',
  '2','response-loss retry returns the stored magic item receipt'
);
select throws_ok(
  $$select public.put_magic_item_document('c2000000-0000-4000-8000-000000000006',(select (result->>'campaignId')::uuid from magic_workspace),1,'magic-a','replace',1,1,(select payload from magic_v2),(select fingerprint from magic_v2))$$,
  '40001','magic item server version conflict','stale magic item CAS loses without overwrite'
);
select throws_ok(
  $$select public.put_magic_item_document('c2000000-0000-4000-8000-000000000007',(select (result->>'campaignId')::uuid from magic_workspace),1,'magic-c','create',0,1,pg_catalog.jsonb_build_object('name','x','secret',true),repeat('a',64))$$,
  '22023','invalid magic item mutation','unclassified magic item fields are rejected'
);
select is((public.list_magic_item_document_versions((select (result->>'campaignId')::uuid from magic_workspace),'magic-a')->'versions'->0->>'serverVersion'),'2','magic item history metadata is newest first');
select is((public.export_magic_item_document_version((select (result->>'campaignId')::uuid from magic_workspace),'magic-a',1)->'payload'->'charges'->0->>'id'),'chg-1','exact private magic item history export remains owner-only');
select is(
  public.put_magic_item_document('c2000000-0000-4000-8000-000000000008',(select (result->>'campaignId')::uuid from magic_workspace),1,'magic-a','delete',2,1,null,(select fingerprint from magic_tombstone_fingerprint))->>'tombstoned',
  'true','magic item deletion creates an explicit tombstone version'
);
select throws_ok(
  $$select public.put_magic_item_document('c2000000-0000-4000-8000-000000000009',(select (result->>'campaignId')::uuid from magic_workspace),1,'magic-a','replace',3,1,(select payload from magic_fixture where legacy_id='magic-a'),(select fingerprint from magic_fixture where legacy_id='magic-a'))$$,
  '55000','magic item tombstone cannot be resurrected without explicit history restore','ordinary writes cannot resurrect a magic item tombstone'
);
select is(
  public.restore_magic_item_document_version('c2000000-0000-4000-8000-000000000010',(select (result->>'campaignId')::uuid from magic_workspace),1,'magic-a',1,3)->>'serverVersion',
  '4','explicit owner history restore creates a new magic item version after tombstone'
);
select is(
  public.preview_magic_item_device_enrollment((select (result->>'campaignId')::uuid from magic_workspace))->>'recordCount',
  '2','magic item enrollment preview reports the whole library'
);
select matches(
  public.preview_magic_item_device_enrollment((select (result->>'campaignId')::uuid from magic_workspace))->>'previewFingerprint',
  '^[a-f0-9]{64}$','magic item enrollment preview is fingerprinted'
);
select is(public.remove_magic_item_device('c2000000-0000-4000-8000-000000000011',(select (result->>'campaignId')::uuid from magic_workspace),'c3000000-0000-4000-8000-000000000001',1)->>'state','removed','exact magic item device removal succeeds');

reset role;
create temporary table magic_generation as
select private.magic_item_generation((select (result->>'campaignId')::uuid from magic_workspace)) as documents;
grant select on magic_generation to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
create temporary table magic_rollback as
select public.rollback_magic_item_family(
  'c2000000-0000-4000-8000-000000000012',(select (result->>'campaignId')::uuid from magic_workspace),1,
  (select public.preview_magic_item_device_enrollment((select (result->>'campaignId')::uuid from magic_workspace))->>'previewFingerprint'),
  pg_catalog.jsonb_build_object('recordCount',2,'documents',(select documents from magic_generation))
) as result;
grant select on magic_rollback to authenticated;
select is(result->>'authority','legacy','verified magic item rollback restores legacy authority') from magic_rollback;
select is(result->>'epoch','2','magic item rollback advances the family epoch') from magic_rollback;

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.campaign_documents where family='magic_item'),0::bigint,'other accounts see no magic item rows');

reset role;
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from magic_workspace) and axis='durable_family' and family='calendar'),'legacy','magic item mutations never move calendar authority');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from magic_workspace) and axis='durable_family' and family='campaign_settings'),'legacy','magic item mutations never move settings authority');

select * from finish();
rollback;
