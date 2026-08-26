begin;

select plan(55);

select ok(has_function_privilege('authenticated','public.begin_encounter_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint)','EXECUTE'),'owner can begin encounter staging');
select ok(not has_function_privilege('anon','public.begin_encounter_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint)','EXECUTE'),'anon cannot stage encounters');
select ok(has_function_privilege('authenticated','public.put_encounter_document(uuid,uuid,bigint,text,text,bigint,integer,jsonb,text,bigint)','EXECUTE'),'owner can use encounter CAS');
select ok(not has_function_privilege('anon','public.put_encounter_document(uuid,uuid,bigint,text,text,bigint,integer,jsonb,text,bigint)','EXECUTE'),'anon cannot mutate encounters');
select ok(not has_table_privilege('authenticated','private.campaign_document_versions','SELECT'),'encounter history has no direct browser grant');

-- Pins 20260824500000: the shared canonicalizer must sort object keys in byte
-- order, the way the TypeScript canonicalizer's Object.keys().sort() does.
-- `requestId`/`requestedAt` differ only by letter case at the deciding
-- position, so the previous default-collation sort produced a different
-- canonical JSON and a different digest. The expected value is the SHA-256 of
-- the TypeScript canonical form {"requestId":"r-1","requestedAt":1}.
select is(
  private.campaign_document_hash(pg_catalog.jsonb_build_object('requestId','r-1','requestedAt',1)),
  '5339b0cf109718bf54ee863b72e7209b9ee3d872c13d5297049bb48a55e12b0b',
  'case-divergent sibling keys hash identically in Postgres and the browser'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

create temporary table encounter_workspace as
select public.create_campaign_workspace(
  'e1000000-0000-4000-8000-000000000001','Encounter test','new_workspace',null
) as result;
grant select on encounter_workspace to authenticated;

reset role;
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from encounter_workspace) and axis='durable_family' and family='encounter_definition'),'legacy','encounter family starts legacy');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from encounter_workspace) and axis='durable_family' and family='npc'),'legacy','encounter work does not activate npcs');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from encounter_workspace) and axis='durable_family' and family='magic_item'),'legacy','encounter work does not activate magic items');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from encounter_workspace) and axis='durable_family' and family='calendar'),'legacy','encounter work does not activate calendars');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from encounter_workspace) and axis='durable_family' and family='campaign_settings'),'legacy','encounter work does not activate settings');

create temporary table encounter_fixture as
select 'enc-a'::text as legacy_id, pg_catalog.jsonb_build_object(
  'name','Ashfall Vault Ambush',
  'entities',pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'id','ent-player-1','type','player','name','Sera Vale',
      'initiative',17,'initiativeModifier',3,
      'currentHp',31,'maxHp',38,'tempHp',0,'armorClass',16,
      'playerCharacterId','char-sera','inspirationCount',1,
      'deathSaves',pg_catalog.jsonb_build_object('successes',0,'failures',0),
      'conditions',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'id','cond-1','name','Blessed','source','player-sync','kind','buff','rounds',3
      ))
    ),
    pg_catalog.jsonb_build_object(
      'id','ent-npc-1','type','npc','name','Ash the Cult Prophet',
      'initiative',12,'initiativeModifier',2,'proficiencyBonus',3,
      'currentHp',78,'maxHp',78,'tempHp',0,'armorClass',16,
      'npcSourceId','npc-a','monsterSourceId','srd-cult-fanatic',
      'avatarUrl','https://assets.invalid/npc/ash.png',
      'conditions',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'id','cond-2','name','Concentrating','source','dm','kind','neutral','rounds',null
      )),
      'abilities',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'id','ability-1','name','Ember Lash','description','Melee weapon attack.',
        'usageType','recharge','rechargeOn',5,'usedUses',0,'source','npc'
      )),
      'resources',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'id','res-1','name','Channel Divinity','icon','flame','color','amber',
        'displayStyle','pips','maxUses',2,'usesExpended',1,'shortRestReset','all'
      )),
      'legendaryActions',pg_catalog.jsonb_build_object(
        'maxActions',3,'usedActions',1,
        'actions',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'id','legendary-1','name','Cinder Step','cost',1,'description','Teleport 30 feet.'
        ))
      ),
      'lairActions',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'id','lair-1','name','Ash Storm','description','Ash chokes the chamber.','usedThisRound',false
      )),
      'monsterStatBlock',pg_catalog.jsonb_build_object(
        'size','Medium','type','humanoid','alignment','lawful evil',
        'traits',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','trait-1','name','Ashen Aura','text','Cinders swirl around the prophet.')),
        'actions',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','action-1','name','Ember Lash','text','Melee weapon attack.')),
        'reactions',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','reaction-1','name','Cinder Ward','text','Reduce damage by 5.')),
        'bonusActions',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','bonus-1','name','Smolder','text','Ignite a nearby creature.')),
        'lairActions',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('name','Ash Storm','text','Ash chokes the chamber.'))
      )
    )
  ),
  'currentTurn',0,'round',1,'isActive',false,'sortOrder','initiative',
  'pendingInitiativeRequest',pg_catalog.jsonb_build_object('requestId','req-1','requestedAt',1756000000000),
  'createdAt','2026-08-01T00:00:00.000Z','updatedAt','2026-08-02T00:00:00.000Z'
) as payload
union all
select 'enc-b'::text, pg_catalog.jsonb_build_object(
  'name','Empty Vault Corridor',
  'entities','[]'::jsonb,
  'currentTurn',0,'round',1,'isActive',false,'sortOrder','manual',
  'pendingInitiativeRequest',null,
  'createdAt','2026-08-01T00:00:00.000Z','updatedAt','2026-08-01T00:00:00.000Z'
);
alter table encounter_fixture add column fingerprint text;
alter table encounter_fixture add column bytes integer;
update encounter_fixture set fingerprint=private.campaign_document_hash(payload),bytes=pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(payload),'UTF8'));
grant select on encounter_fixture to authenticated;

create temporary table encounter_active_fixture as
select legacy_id, pg_catalog.jsonb_set(payload,'{isActive}','true'::jsonb) as payload
from encounter_fixture where legacy_id='enc-a';
alter table encounter_active_fixture add column fingerprint text;
update encounter_active_fixture set fingerprint=private.campaign_document_hash(payload);
grant select on encounter_active_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select throws_ok(
  $$select public.begin_encounter_staging('e2000000-0000-4000-8000-000000000001',(select (result->>'campaignId')::uuid from encounter_workspace),'e3000000-0000-4000-8000-000000000001',0,repeat('a',64),repeat('b',64),repeat('b',64),2,(select sum(bytes) from encounter_fixture))$$,
  '42501','campaign owner authorization is required','other account cannot stage encounters'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
create temporary table encounter_run as
select public.begin_encounter_staging(
  'e2000000-0000-4000-8000-000000000002',(select (result->>'campaignId')::uuid from encounter_workspace),
  'e3000000-0000-4000-8000-000000000001',0,repeat('a',64),repeat('b',64),repeat('b',64),2,(select sum(bytes) from encounter_fixture)
) as result;
grant select on encounter_run to authenticated;
select is(result->>'state','staging','matching recovery receipt begins encounter staging') from encounter_run;
select is(
  public.stage_encounter_items(
    'e2000000-0000-4000-8000-000000000003',(select (result->>'runId')::uuid from encounter_run),
    (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('legacyId',legacy_id,'schemaVersion',2,'payload',payload,'payloadFingerprint',fingerprint,'tombstoned',false) order by legacy_id) from encounter_fixture)
  )->>'state','validated','every staged encounter validates against the manifest'
);

-- Ruling 1b: combat started between local cutover and cloud activation can
-- never be staged, even though put_encounter_document accepts isActive freely.
select throws_ok(
  $$select public.stage_encounter_items(
    'e2000000-0000-4000-8000-000000000040',(select (result->>'runId')::uuid from encounter_run),
    (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'legacyId',legacy_id,'schemaVersion',2,'payload',payload,
      'payloadFingerprint',fingerprint,'tombstoned',false
    ) order by legacy_id) from encounter_active_fixture)
  )$$,
  '22023','active encounter blocks cutover','an active encounter cannot be staged for cutover'
);

create temporary table encounter_cutover as
select public.confirm_encounter_cutover('e2000000-0000-4000-8000-000000000004',(select (result->>'runId')::uuid from encounter_run),repeat('a',64),0) as result;
grant select on encounter_cutover to authenticated;
select is(result->>'authority','postgres','explicit confirmation activates only encounters') from encounter_cutover;
select is(result->>'recordCount','2','cutover reports the whole staged generation') from encounter_cutover;

reset role;
select is((select count(*) from public.campaign_documents where family='encounter_definition' and campaign_id=(select (result->>'campaignId')::uuid from encounter_workspace)),2::bigint,'encounter current rows created');
select is((select count(*) from private.campaign_document_versions where family='encounter_definition' and campaign_id=(select (result->>'campaignId')::uuid from encounter_workspace)),2::bigint,'encounter version 1 rows created atomically');
select is((select count(*) from private.campaign_document_projection_outbox where family='encounter_definition'),0::bigint,'encounters never queue projection work');
select throws_ok(
  $$insert into private.campaign_document_projection_outbox(campaign_id,campaign_document_version_id,family,legacy_id,server_version,cutover_epoch,projection_kind,source_fingerprint)
    select v.campaign_id,v.id,'encounter_definition',v.legacy_id,v.server_version,v.cutover_epoch,'calendar_v1',v.payload_fingerprint
    from private.campaign_document_versions v where v.family='encounter_definition' limit 1$$,
  '23514',
  'new row for relation "campaign_document_projection_outbox" violates check constraint "campaign_document_projection_outbox_family_check"',
  'the projection outbox structurally rejects the encounter family'
);
select is((select count(*) from private.campaign_family_device_enrollments where family='encounter_definition' and device_id='e3000000-0000-4000-8000-000000000001'),1::bigint,'initial encounter device enrolled atomically');

create temporary table encounter_v2 as
select pg_catalog.jsonb_set(
  pg_catalog.jsonb_set(payload,'{updatedAt}','"2026-08-03T00:00:00.000Z"'::jsonb),
  '{isActive}','true'::jsonb
) as payload
from encounter_fixture where legacy_id='enc-a';
alter table encounter_v2 add column fingerprint text;
update encounter_v2 set fingerprint=private.campaign_document_hash(payload);
grant select on encounter_v2 to authenticated;
create temporary table encounter_tombstone_fingerprint as
select private.campaign_document_hash(
  pg_catalog.jsonb_build_object('legacyId','enc-a','tombstoned',true)
) as fingerprint;
grant select on encounter_tombstone_fingerprint to authenticated;
create temporary table encounter_duplicate_child as
select pg_catalog.jsonb_set(payload,'{entities}',pg_catalog.jsonb_build_array(
  pg_catalog.jsonb_build_object('id','ent-npc-1','type','npc','name','Ash the Cult Prophet'),
  pg_catalog.jsonb_build_object('id','ent-npc-1','type','npc','name','Ash the Cult Echo')
)) as payload
from encounter_fixture where legacy_id='enc-a';
grant select on encounter_duplicate_child to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select is(
  public.put_encounter_document('e2000000-0000-4000-8000-000000000005',(select (result->>'campaignId')::uuid from encounter_workspace),1,'enc-a','replace',1,2,(select payload from encounter_v2),(select fingerprint from encounter_v2))->>'serverVersion',
  '2','encounter CAS accepts an active combat on the expected base version'
);
select is(
  public.put_encounter_document('e2000000-0000-4000-8000-000000000005',(select (result->>'campaignId')::uuid from encounter_workspace),1,'enc-a','replace',1,2,(select payload from encounter_v2),(select fingerprint from encounter_v2))->>'serverVersion',
  '2','response-loss retry returns the stored encounter receipt'
);
select throws_ok(
  $$select public.put_encounter_document('e2000000-0000-4000-8000-000000000006',(select (result->>'campaignId')::uuid from encounter_workspace),1,'enc-a','replace',1,2,(select payload from encounter_v2),(select fingerprint from encounter_v2))$$,
  '40001','encounter server version conflict','stale encounter CAS loses without overwrite'
);
select throws_ok(
  $$select public.put_encounter_document('e2000000-0000-4000-8000-000000000007',(select (result->>'campaignId')::uuid from encounter_workspace),1,'enc-c','create',0,2,pg_catalog.jsonb_build_object('name','Secret','entities','[]'::jsonb,'currentTurn',0,'round',1,'isActive',false,'sortOrder','manual','createdAt','2026-08-01T00:00:00.000Z','updatedAt','2026-08-01T00:00:00.000Z','secretPlan',true),repeat('a',64))$$,
  '22023','invalid encounter mutation','unclassified encounter fields are rejected'
);
select throws_ok(
  $$select public.put_encounter_document('e2000000-0000-4000-8000-000000000013',(select (result->>'campaignId')::uuid from encounter_workspace),1,'enc-d','create',0,2,(select payload from encounter_duplicate_child),repeat('a',64))$$,
  '22023','invalid encounter mutation','duplicate encounter entity ids are rejected'
);
select is((public.list_encounter_document_versions((select (result->>'campaignId')::uuid from encounter_workspace),'enc-a')->'versions'->0->>'serverVersion'),'2','encounter history metadata is newest first');
select is((public.export_encounter_document_version((select (result->>'campaignId')::uuid from encounter_workspace),'enc-a',1)->'payload'->'entities'->1->'monsterStatBlock'->'actions'->0->>'id'),'action-1','exact private encounter history export remains owner-only');
select is(
  public.put_encounter_document('e2000000-0000-4000-8000-000000000008',(select (result->>'campaignId')::uuid from encounter_workspace),1,'enc-a','delete',2,2,null,(select fingerprint from encounter_tombstone_fingerprint))->>'tombstoned',
  'true','encounter deletion creates an explicit tombstone version'
);
select throws_ok(
  $$select public.put_encounter_document('e2000000-0000-4000-8000-000000000009',(select (result->>'campaignId')::uuid from encounter_workspace),1,'enc-a','replace',3,2,(select payload from encounter_fixture where legacy_id='enc-a'),(select fingerprint from encounter_fixture where legacy_id='enc-a'))$$,
  '55000','encounter tombstone cannot be resurrected without explicit history restore','ordinary writes cannot resurrect an encounter tombstone'
);
select is(
  public.restore_encounter_document_version('e2000000-0000-4000-8000-000000000010',(select (result->>'campaignId')::uuid from encounter_workspace),1,'enc-a',1,3)->>'serverVersion',
  '4','explicit owner history restore creates a new encounter version after tombstone'
);
select is(
  public.preview_encounter_device_enrollment((select (result->>'campaignId')::uuid from encounter_workspace))->>'recordCount',
  '2','encounter enrollment preview reports the whole generation'
);
select matches(
  public.preview_encounter_device_enrollment((select (result->>'campaignId')::uuid from encounter_workspace))->>'previewFingerprint',
  '^[a-f0-9]{64}$','encounter enrollment preview is fingerprinted'
);
select is(public.remove_encounter_device('e2000000-0000-4000-8000-000000000011',(select (result->>'campaignId')::uuid from encounter_workspace),'e3000000-0000-4000-8000-000000000001',1)->>'state','removed','exact encounter device removal succeeds');

reset role;
create temporary table encounter_generation as
select private.encounter_generation((select (result->>'campaignId')::uuid from encounter_workspace)) as documents;
grant select on encounter_generation to authenticated;
create temporary table encounter_mutated_generation as
select pg_catalog.jsonb_set(documents,'{0,serverVersion}','99'::jsonb) as documents from encounter_generation;
grant select on encounter_mutated_generation to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

-- The positive rollback below hands the server back its own generation, so on
-- its own it can never exercise the compare. These three cases do.
select throws_ok(
  $$select public.enroll_encounter_device('e2000000-0000-4000-8000-000000000050',(select (result->>'campaignId')::uuid from encounter_workspace),'e3000000-0000-4000-8000-000000000004',1,repeat('a',64),null)$$,
  '40001','encounter enrollment preview changed','a stale encounter enrollment preview cannot enroll a device'
);
select throws_ok(
  $$select public.rollback_encounter_family(
    'e2000000-0000-4000-8000-000000000051',(select (result->>'campaignId')::uuid from encounter_workspace),1,
    (select public.preview_encounter_device_enrollment((select (result->>'campaignId')::uuid from encounter_workspace))->>'previewFingerprint'),
    pg_catalog.jsonb_build_object('recordCount',2,'documents',(select documents from encounter_mutated_generation))
  )$$,
  '40001','verified encounter generation changed','a mutated encounter generation cannot authorize rollback'
);
select throws_ok(
  $$select public.rollback_encounter_family(
    'e2000000-0000-4000-8000-000000000052',(select (result->>'campaignId')::uuid from encounter_workspace),1,
    (select public.preview_encounter_device_enrollment((select (result->>'campaignId')::uuid from encounter_workspace))->>'previewFingerprint'),
    '[]'::jsonb
  )$$,
  '55000','verified current encounter generation required','an empty encounter generation cannot authorize rollback'
);

create temporary table encounter_rollback as
select public.rollback_encounter_family(
  'e2000000-0000-4000-8000-000000000012',(select (result->>'campaignId')::uuid from encounter_workspace),1,
  (select public.preview_encounter_device_enrollment((select (result->>'campaignId')::uuid from encounter_workspace))->>'previewFingerprint'),
  pg_catalog.jsonb_build_object('recordCount',2,'documents',(select documents from encounter_generation))
) as result;
grant select on encounter_rollback to authenticated;
select is(result->>'authority','legacy','verified encounter rollback restores legacy authority') from encounter_rollback;
select is(result->>'epoch','2','encounter rollback advances the family epoch') from encounter_rollback;

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.campaign_documents where family='encounter_definition'),0::bigint,'other accounts see no encounter rows');

reset role;
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from encounter_workspace) and axis='durable_family' and family='npc'),'legacy','encounter mutations never move npc authority');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from encounter_workspace) and axis='durable_family' and family='magic_item'),'legacy','encounter mutations never move magic item authority');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from encounter_workspace) and axis='durable_family' and family='calendar'),'legacy','encounter mutations never move calendar authority');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from encounter_workspace) and axis='durable_family' and family='campaign_settings'),'legacy','encounter mutations never move settings authority');

-- A local deletion made between local cutover and cloud activation must reach
-- the cloud as an explicit version-1 tombstone during the very first staging.
reset role;
create temporary table encounter_tombstone_stage as
select 'enc-ghost'::text as legacy_id,
  private.campaign_document_hash(pg_catalog.jsonb_build_object('legacyId','enc-ghost','tombstoned',true)) as fingerprint,
  pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(pg_catalog.jsonb_build_object('legacyId','enc-ghost','tombstoned',true)),'UTF8')) as bytes;
grant select on encounter_tombstone_stage to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
create temporary table encounter_tombstone_workspace as
select public.create_campaign_workspace(
  'e1000000-0000-4000-8000-000000000002','Encounter tombstone staging','new_workspace',null
) as result;
grant select on encounter_tombstone_workspace to authenticated;
create temporary table encounter_tombstone_run as
select public.begin_encounter_staging(
  'e2000000-0000-4000-8000-000000000020',(select (result->>'campaignId')::uuid from encounter_tombstone_workspace),
  'e3000000-0000-4000-8000-000000000002',0,repeat('c',64),repeat('d',64),repeat('d',64),1,(select bytes from encounter_tombstone_stage)
) as result;
grant select on encounter_tombstone_run to authenticated;
select is(
  public.stage_encounter_items(
    'e2000000-0000-4000-8000-000000000021',(select (result->>'runId')::uuid from encounter_tombstone_run),
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'legacyId',(select legacy_id from encounter_tombstone_stage),'schemaVersion',2,'payload',null,
      'payloadFingerprint',(select fingerprint from encounter_tombstone_stage),'tombstoned',true
    ))
  )->>'state','validated','a staged encounter tombstone validates against its tombstone fingerprint'
);
select is(
  public.confirm_encounter_cutover('e2000000-0000-4000-8000-000000000022',(select (result->>'runId')::uuid from encounter_tombstone_run),repeat('c',64),0)->>'recordCount',
  '1','a tombstone-only manifest confirms its whole staged generation'
);

reset role;
select is(
  (select tombstoned from public.campaign_documents where family='encounter_definition' and legacy_id='enc-ghost' and campaign_id=(select (result->>'campaignId')::uuid from encounter_tombstone_workspace)),
  true,'the staged encounter tombstone reaches the cloud as a tombstoned current row'
);
select is(
  (select server_version from private.campaign_document_versions where family='encounter_definition' and legacy_id='enc-ghost' and campaign_id=(select (result->>'campaignId')::uuid from encounter_tombstone_workspace)),
  1::bigint,'the staged encounter tombstone is durable as an immutable version 1'
);

-- An owner with no encounters must still be able to activate the family.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
create temporary table encounter_empty_workspace as
select public.create_campaign_workspace(
  'e1000000-0000-4000-8000-000000000003','Encounter empty staging','new_workspace',null
) as result;
grant select on encounter_empty_workspace to authenticated;
create temporary table encounter_empty_run as
select public.begin_encounter_staging(
  'e2000000-0000-4000-8000-000000000030',(select (result->>'campaignId')::uuid from encounter_empty_workspace),
  'e3000000-0000-4000-8000-000000000003',0,repeat('e',64),repeat('f',64),repeat('f',64),0,0
) as result;
grant select on encounter_empty_run to authenticated;
select is(
  public.stage_encounter_items('e2000000-0000-4000-8000-000000000031',(select (result->>'runId')::uuid from encounter_empty_run),'[]'::jsonb)->>'state',
  'validated','an empty encounter roster stages as a complete zero-record generation'
);
create temporary table encounter_empty_cutover as
select public.confirm_encounter_cutover('e2000000-0000-4000-8000-000000000032',(select (result->>'runId')::uuid from encounter_empty_run),repeat('e',64),0) as result;
grant select on encounter_empty_cutover to authenticated;
select is(result->>'recordCount','0','a zero-record run confirms without any staged document') from encounter_empty_cutover;
select is(result->>'authority','postgres','a zero-record cutover still activates only encounter authority') from encounter_empty_cutover;

-- Regression for the put/stage size-measure mismatch: an entity-heavy encounter
-- whose canonical UTF-8 form is legally sized (<= 262,144, so the manifest
-- raises no oversized-record blocker and staging accepts it) while its jsonb
-- binary datum is far larger. Measuring pg_column_size in put_encounter_document
-- would reject this payload, so a campaign could cut over and then fail every
-- later autosave with 'invalid encounter mutation'.
reset role;
create temporary table encounter_gap_fixture as
select pg_catalog.jsonb_build_object(
  'name','Gap Regression Encounter',
  'entities',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id','ent-'||i,'type','monster','name','Cinder Warden '||i,
    'initiative',i,'initiativeModifier',2,'proficiencyBonus',3,
    'currentHp',104,'maxHp',104,'tempHp',0,'armorClass',17,'tempAc',0,
    'conditions','[]'::jsonb,
    'monsterStatBlock',pg_catalog.jsonb_build_object(
      'str',18,'dex',12,'con',16,'int',10,'wis',13,'cha',9,
      'passivePerception',13,'cr','5','size','Large','type','elemental',
      'traits',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id','t-'||i||'-'||j,'name','Trait '||j,'text',repeat('ash ',12),'uses',j
      )) from generate_series(1,5) j),
      'actions',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id','a-'||i||'-'||j,'name','Action '||j,'text',repeat('ember ',10),'uses',j
      )) from generate_series(1,5) j)
    )
  )) from generate_series(1,175) i),
  'currentTurn',0,'round',1,'isActive',false,'sortOrder','initiative',
  'createdAt','2026-08-01T00:00:00.000Z','updatedAt','2026-08-02T00:00:00.000Z'
) as payload;
alter table encounter_gap_fixture add column fingerprint text;
alter table encounter_gap_fixture add column canonical_bytes integer;
update encounter_gap_fixture set
  fingerprint=private.campaign_document_hash(payload),
  canonical_bytes=pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(payload),'UTF8'));
grant select on encounter_gap_fixture to authenticated;
select ok((select canonical_bytes from encounter_gap_fixture) between 175000 and 262144,'the gap fixture is a legally sized encounter record');
-- ::text::jsonb re-parses the fixture so the measurement (and the CAS call
-- below) sees the same freshly parsed, uncompressed datum PostgREST hands the
-- function. Read straight out of the temp table the value arrives as a
-- TOAST-compressed datum of about 12 KB, which would hide the defect entirely.
select ok(pg_column_size((select payload from encounter_gap_fixture)::text::jsonb) > 262144,'the gap fixture''s wire-parsed jsonb datum exceeds the record limit');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select is(
  public.put_encounter_document(
    'e2000000-0000-4000-8000-000000000060',(select (result->>'campaignId')::uuid from encounter_empty_workspace),1,
    'enc-gap','create',0,2,
    (select payload from encounter_gap_fixture)::text::jsonb,
    (select fingerprint from encounter_gap_fixture)
  )->>'serverVersion',
  '1','a record that staging would accept is always writable through encounter CAS'
);

reset role;

select * from finish();
rollback;
