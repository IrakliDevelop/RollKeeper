begin;

select plan(45);

select ok(has_function_privilege('authenticated','public.begin_npc_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint)','EXECUTE'),'owner can begin npc staging');
select ok(not has_function_privilege('anon','public.begin_npc_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint)','EXECUTE'),'anon cannot stage npcs');
select ok(has_function_privilege('authenticated','public.put_npc_document(uuid,uuid,bigint,text,text,bigint,integer,jsonb,text,bigint)','EXECUTE'),'owner can use npc CAS');
select ok(not has_function_privilege('anon','public.put_npc_document(uuid,uuid,bigint,text,text,bigint,integer,jsonb,text,bigint)','EXECUTE'),'anon cannot mutate npcs');
select ok(not has_table_privilege('authenticated','private.campaign_document_versions','SELECT'),'npc history has no direct browser grant');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

create temporary table npc_workspace as
select public.create_campaign_workspace(
  'd1000000-0000-4000-8000-000000000001','NPC test','new_workspace',null
) as result;
grant select on npc_workspace to authenticated;

reset role;
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from npc_workspace) and axis='durable_family' and family='npc'),'legacy','npc family starts legacy');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from npc_workspace) and axis='durable_family' and family='magic_item'),'legacy','npc work does not activate magic items');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from npc_workspace) and axis='durable_family' and family='calendar'),'legacy','npc work does not activate calendars');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from npc_workspace) and axis='durable_family' and family='campaign_settings'),'legacy','npc work does not activate settings');

create temporary table npc_fixture as
select 'npc-a'::text as legacy_id, pg_catalog.jsonb_build_object(
  'name','Ash the Cult Prophet',
  'description','A hollow-eyed prophet wreathed in cinders.',
  'armorClass','16 (natural armor)',
  'maxHp',78,'currentHp',78,'tempHp',0,'tempAc',2,
  'speed','30 ft., fly 60 ft.',
  'monsterStatBlock',pg_catalog.jsonb_build_object(
    'size','Medium','type','humanoid','alignment','lawful evil',
    'traits',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','trait-1','name','Ashen Aura','description','Cinders swirl around the prophet.')),
    'actions',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','action-1','name','Ember Lash','description','Melee weapon attack.')),
    'reactions',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','reaction-1','name','Cinder Ward','description','Reduce damage by 5.')),
    'bonusActions',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','bonus-1','name','Smolder','description','Ignite a nearby creature.')),
    'lairActions',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','lair-1','name','Ash Storm','description','Ash chokes the chamber.'))
  ),
  'bestiarySourceId','srd-cult-fanatic',
  'loreHtml','<p>Preaches the coming of the ember dawn.</p>',
  'xp',1800,
  'avatarUrl','https://assets.invalid/npc/ash.png',
  'group','Cult',
  'tags',pg_catalog.jsonb_build_array('boss','fire'),
  'hitDice',pg_catalog.jsonb_build_object('total',12,'used',2,'dieType',8),
  'deathSaves',pg_catalog.jsonb_build_object('successes',0,'failures',0),
  'initiativeModifier',2,'proficiencyBonus',3,
  'inventory',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'id','npc-item-1','name','Ember Dagger','quantity',1,
    'magicItem',pg_catalog.jsonb_build_object('name','Staff of Embers','rarity','Rare','charges',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','chg-1','current',3,'max',3)))
  )),
  'currency',pg_catalog.jsonb_build_object('cp',0,'sp',0,'ep',0,'gp',120,'pp',0),
  'spellcasting',pg_catalog.jsonb_build_object(
    'casterLevel',5,'ability','intelligence','slotsUsed',pg_catalog.jsonb_build_object('1',1),
    'spells',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','spell-1','name','Fire Bolt','level',0))
  ),
  'resources',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','res-1','name','Channel Divinity','maxUses',2,'usesExpended',1,'shortRestReset','all')),
  'abilityUsage',pg_catalog.jsonb_build_object('action-1',1),
  'collapsedSpellSections',pg_catalog.jsonb_build_array('cantrips'),
  'lastDetailTab','stats',
  'passivePerception',13,'passiveInsight',11,'passiveInvestigation',12,
  'abilityScores',pg_catalog.jsonb_build_object('strength',11,'dexterity',14,'constitution',12,'intelligence',10,'wisdom',13,'charisma',14),
  'traits',pg_catalog.jsonb_build_array('Fanatical devotion'),
  'actions',pg_catalog.jsonb_build_array('Multiattack'),
  'createdAt','2026-08-01T00:00:00.000Z','updatedAt','2026-08-02T00:00:00.000Z'
) as payload
union all
select 'npc-b'::text, pg_catalog.jsonb_build_object(
  'name','Cult Acolyte','description',null,
  'armorClass',13,'maxHp',22,'speed','30 ft.',
  'group',null,
  'createdAt','2026-08-01T00:00:00.000Z','updatedAt','2026-08-01T00:00:00.000Z'
);
alter table npc_fixture add column fingerprint text;
alter table npc_fixture add column bytes integer;
update npc_fixture set fingerprint=private.campaign_document_hash(payload),bytes=pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(payload),'UTF8'));
grant select on npc_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select throws_ok(
  $$select public.begin_npc_staging('d2000000-0000-4000-8000-000000000001',(select (result->>'campaignId')::uuid from npc_workspace),'d3000000-0000-4000-8000-000000000001',0,repeat('a',64),repeat('b',64),repeat('b',64),2,(select sum(bytes) from npc_fixture))$$,
  '42501','campaign owner authorization is required','other account cannot stage npcs'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
create temporary table npc_run as
select public.begin_npc_staging(
  'd2000000-0000-4000-8000-000000000002',(select (result->>'campaignId')::uuid from npc_workspace),
  'd3000000-0000-4000-8000-000000000001',0,repeat('a',64),repeat('b',64),repeat('b',64),2,(select sum(bytes) from npc_fixture)
) as result;
grant select on npc_run to authenticated;
select is(result->>'state','staging','matching recovery receipt begins npc staging') from npc_run;
select is(
  public.stage_npc_items(
    'd2000000-0000-4000-8000-000000000003',(select (result->>'runId')::uuid from npc_run),
    (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('legacyId',legacy_id,'schemaVersion',4,'payload',payload,'payloadFingerprint',fingerprint,'tombstoned',false) order by legacy_id) from npc_fixture)
  )->>'state','validated','every staged npc validates against the manifest'
);
create temporary table npc_cutover as
select public.confirm_npc_cutover('d2000000-0000-4000-8000-000000000004',(select (result->>'runId')::uuid from npc_run),repeat('a',64),0) as result;
grant select on npc_cutover to authenticated;
select is(result->>'authority','postgres','explicit confirmation activates only npcs') from npc_cutover;
select is(result->>'recordCount','2','cutover reports the whole staged roster') from npc_cutover;

reset role;
select is((select count(*) from public.campaign_documents where family='npc' and campaign_id=(select (result->>'campaignId')::uuid from npc_workspace)),2::bigint,'npc current rows created');
select is((select count(*) from private.campaign_document_versions where family='npc' and campaign_id=(select (result->>'campaignId')::uuid from npc_workspace)),2::bigint,'npc version 1 rows created atomically');
select is((select count(*) from private.campaign_document_projection_outbox where family='npc'),0::bigint,'npcs never queue projection work');
select throws_ok(
  $$insert into private.campaign_document_projection_outbox(campaign_id,campaign_document_version_id,family,legacy_id,server_version,cutover_epoch,projection_kind,source_fingerprint)
    select v.campaign_id,v.id,'npc',v.legacy_id,v.server_version,v.cutover_epoch,'calendar_v1',v.payload_fingerprint
    from private.campaign_document_versions v where v.family='npc' limit 1$$,
  '23514',null,'the projection outbox structurally rejects the npc family'
);
select is((select count(*) from private.campaign_family_device_enrollments where family='npc' and device_id='d3000000-0000-4000-8000-000000000001'),1::bigint,'initial npc device enrolled atomically');

create temporary table npc_v2 as
select pg_catalog.jsonb_set(payload,'{updatedAt}','"2026-08-03T00:00:00.000Z"'::jsonb) as payload
from npc_fixture where legacy_id='npc-a';
alter table npc_v2 add column fingerprint text;
update npc_v2 set fingerprint=private.campaign_document_hash(payload);
grant select on npc_v2 to authenticated;
create temporary table npc_tombstone_fingerprint as
select private.campaign_document_hash(
  pg_catalog.jsonb_build_object('legacyId','npc-a','tombstoned',true)
) as fingerprint;
grant select on npc_tombstone_fingerprint to authenticated;
create temporary table npc_duplicate_child as
select pg_catalog.jsonb_set(payload,'{inventory}',pg_catalog.jsonb_build_array(
  pg_catalog.jsonb_build_object('id','npc-item-1','name','Ember Dagger','quantity',1),
  pg_catalog.jsonb_build_object('id','npc-item-1','name','Ash Censer','quantity',1)
)) as payload
from npc_fixture where legacy_id='npc-a';
grant select on npc_duplicate_child to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select is(
  public.put_npc_document('d2000000-0000-4000-8000-000000000005',(select (result->>'campaignId')::uuid from npc_workspace),1,'npc-a','replace',1,4,(select payload from npc_v2),(select fingerprint from npc_v2))->>'serverVersion',
  '2','npc CAS accepts the expected base version'
);
select is(
  public.put_npc_document('d2000000-0000-4000-8000-000000000005',(select (result->>'campaignId')::uuid from npc_workspace),1,'npc-a','replace',1,4,(select payload from npc_v2),(select fingerprint from npc_v2))->>'serverVersion',
  '2','response-loss retry returns the stored npc receipt'
);
select throws_ok(
  $$select public.put_npc_document('d2000000-0000-4000-8000-000000000006',(select (result->>'campaignId')::uuid from npc_workspace),1,'npc-a','replace',1,4,(select payload from npc_v2),(select fingerprint from npc_v2))$$,
  '40001','npc server version conflict','stale npc CAS loses without overwrite'
);
select throws_ok(
  $$select public.put_npc_document('d2000000-0000-4000-8000-000000000007',(select (result->>'campaignId')::uuid from npc_workspace),1,'npc-c','create',0,4,pg_catalog.jsonb_build_object('name','x','maxHp',1,'armorClass',10,'speed','30 ft.','createdAt','2026-08-01T00:00:00.000Z','updatedAt','2026-08-01T00:00:00.000Z','secretPlan',true),repeat('a',64))$$,
  '22023','invalid npc mutation','unclassified npc fields are rejected'
);
select throws_ok(
  $$select public.put_npc_document('d2000000-0000-4000-8000-000000000013',(select (result->>'campaignId')::uuid from npc_workspace),1,'npc-d','create',0,4,(select payload from npc_duplicate_child),repeat('a',64))$$,
  '22023','invalid npc mutation','duplicate npc inventory ids are rejected'
);
select is((public.list_npc_document_versions((select (result->>'campaignId')::uuid from npc_workspace),'npc-a')->'versions'->0->>'serverVersion'),'2','npc history metadata is newest first');
select is((public.export_npc_document_version((select (result->>'campaignId')::uuid from npc_workspace),'npc-a',1)->'payload'->'monsterStatBlock'->'actions'->0->>'id'),'action-1','exact private npc history export remains owner-only');
select is(
  public.put_npc_document('d2000000-0000-4000-8000-000000000008',(select (result->>'campaignId')::uuid from npc_workspace),1,'npc-a','delete',2,4,null,(select fingerprint from npc_tombstone_fingerprint))->>'tombstoned',
  'true','npc deletion creates an explicit tombstone version'
);
select throws_ok(
  $$select public.put_npc_document('d2000000-0000-4000-8000-000000000009',(select (result->>'campaignId')::uuid from npc_workspace),1,'npc-a','replace',3,4,(select payload from npc_fixture where legacy_id='npc-a'),(select fingerprint from npc_fixture where legacy_id='npc-a'))$$,
  '55000','npc tombstone cannot be resurrected without explicit history restore','ordinary writes cannot resurrect an npc tombstone'
);
select is(
  public.restore_npc_document_version('d2000000-0000-4000-8000-000000000010',(select (result->>'campaignId')::uuid from npc_workspace),1,'npc-a',1,3)->>'serverVersion',
  '4','explicit owner history restore creates a new npc version after tombstone'
);
select is(
  public.preview_npc_device_enrollment((select (result->>'campaignId')::uuid from npc_workspace))->>'recordCount',
  '2','npc enrollment preview reports the whole roster'
);
select matches(
  public.preview_npc_device_enrollment((select (result->>'campaignId')::uuid from npc_workspace))->>'previewFingerprint',
  '^[a-f0-9]{64}$','npc enrollment preview is fingerprinted'
);
select is(public.remove_npc_device('d2000000-0000-4000-8000-000000000011',(select (result->>'campaignId')::uuid from npc_workspace),'d3000000-0000-4000-8000-000000000001',1)->>'state','removed','exact npc device removal succeeds');

reset role;
create temporary table npc_generation as
select private.npc_generation((select (result->>'campaignId')::uuid from npc_workspace)) as documents;
grant select on npc_generation to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
create temporary table npc_rollback as
select public.rollback_npc_family(
  'd2000000-0000-4000-8000-000000000012',(select (result->>'campaignId')::uuid from npc_workspace),1,
  (select public.preview_npc_device_enrollment((select (result->>'campaignId')::uuid from npc_workspace))->>'previewFingerprint'),
  pg_catalog.jsonb_build_object('recordCount',2,'documents',(select documents from npc_generation))
) as result;
grant select on npc_rollback to authenticated;
select is(result->>'authority','legacy','verified npc rollback restores legacy authority') from npc_rollback;
select is(result->>'epoch','2','npc rollback advances the family epoch') from npc_rollback;

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.campaign_documents where family='npc'),0::bigint,'other accounts see no npc rows');

reset role;
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from npc_workspace) and axis='durable_family' and family='magic_item'),'legacy','npc mutations never move magic item authority');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from npc_workspace) and axis='durable_family' and family='calendar'),'legacy','npc mutations never move calendar authority');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from npc_workspace) and axis='durable_family' and family='campaign_settings'),'legacy','npc mutations never move settings authority');

-- A local deletion made between local cutover and cloud activation must reach
-- the cloud as an explicit version-1 tombstone during the very first staging.
reset role;
create temporary table npc_tombstone_stage as
select 'npc-ghost'::text as legacy_id,
  private.campaign_document_hash(pg_catalog.jsonb_build_object('legacyId','npc-ghost','tombstoned',true)) as fingerprint,
  pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(pg_catalog.jsonb_build_object('legacyId','npc-ghost','tombstoned',true)),'UTF8')) as bytes;
grant select on npc_tombstone_stage to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
create temporary table npc_tombstone_workspace as
select public.create_campaign_workspace(
  'd1000000-0000-4000-8000-000000000002','NPC tombstone staging','new_workspace',null
) as result;
grant select on npc_tombstone_workspace to authenticated;
create temporary table npc_tombstone_run as
select public.begin_npc_staging(
  'd2000000-0000-4000-8000-000000000020',(select (result->>'campaignId')::uuid from npc_tombstone_workspace),
  'd3000000-0000-4000-8000-000000000002',0,repeat('c',64),repeat('d',64),repeat('d',64),1,(select bytes from npc_tombstone_stage)
) as result;
grant select on npc_tombstone_run to authenticated;
select is(
  public.stage_npc_items(
    'd2000000-0000-4000-8000-000000000021',(select (result->>'runId')::uuid from npc_tombstone_run),
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'legacyId',(select legacy_id from npc_tombstone_stage),'schemaVersion',4,'payload',null,
      'payloadFingerprint',(select fingerprint from npc_tombstone_stage),'tombstoned',true
    ))
  )->>'state','validated','a staged npc tombstone validates against its tombstone fingerprint'
);
select is(
  public.confirm_npc_cutover('d2000000-0000-4000-8000-000000000022',(select (result->>'runId')::uuid from npc_tombstone_run),repeat('c',64),0)->>'recordCount',
  '1','a tombstone-only manifest confirms its whole staged generation'
);

reset role;
select is(
  (select tombstoned from public.campaign_documents where family='npc' and legacy_id='npc-ghost' and campaign_id=(select (result->>'campaignId')::uuid from npc_tombstone_workspace)),
  true,'the staged npc tombstone reaches the cloud as a tombstoned current row'
);
select is(
  (select server_version from private.campaign_document_versions where family='npc' and legacy_id='npc-ghost' and campaign_id=(select (result->>'campaignId')::uuid from npc_tombstone_workspace)),
  1::bigint,'the staged npc tombstone is durable as an immutable version 1'
);

-- An owner whose roster is empty must still be able to activate the family.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
create temporary table npc_empty_workspace as
select public.create_campaign_workspace(
  'd1000000-0000-4000-8000-000000000003','NPC empty staging','new_workspace',null
) as result;
grant select on npc_empty_workspace to authenticated;
create temporary table npc_empty_run as
select public.begin_npc_staging(
  'd2000000-0000-4000-8000-000000000030',(select (result->>'campaignId')::uuid from npc_empty_workspace),
  'd3000000-0000-4000-8000-000000000003',0,repeat('e',64),repeat('f',64),repeat('f',64),0,0
) as result;
grant select on npc_empty_run to authenticated;
select is(
  public.stage_npc_items('d2000000-0000-4000-8000-000000000031',(select (result->>'runId')::uuid from npc_empty_run),'[]'::jsonb)->>'state',
  'validated','an empty npc roster stages as a complete zero-record generation'
);
create temporary table npc_empty_cutover as
select public.confirm_npc_cutover('d2000000-0000-4000-8000-000000000032',(select (result->>'runId')::uuid from npc_empty_run),repeat('e',64),0) as result;
grant select on npc_empty_cutover to authenticated;
select is(result->>'recordCount','0','a zero-record run confirms without any staged document') from npc_empty_cutover;
select is(result->>'authority','postgres','a zero-record cutover still activates only npc authority') from npc_empty_cutover;

reset role;

select * from finish();
rollback;
