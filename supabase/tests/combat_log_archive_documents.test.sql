begin;

select plan(76);

select ok(has_function_privilege('authenticated','public.begin_combat_log_archive_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint)','EXECUTE'),'owner can begin combat log archive staging');
select ok(not has_function_privilege('anon','public.begin_combat_log_archive_staging(uuid,uuid,uuid,bigint,text,text,text,integer,bigint)','EXECUTE'),'anon cannot stage combat log archives');
select ok(has_function_privilege('authenticated','public.put_combat_log_archive_document(uuid,uuid,bigint,text,text,bigint,integer,jsonb,text,bigint)','EXECUTE'),'owner can use combat log archive CAS');
select ok(not has_function_privilege('anon','public.put_combat_log_archive_document(uuid,uuid,bigint,text,text,bigint,integer,jsonb,text,bigint)','EXECUTE'),'anon cannot mutate combat log archives');
select ok(not has_table_privilege('authenticated','private.campaign_document_versions','SELECT'),'combat log archive history has no direct browser grant');

-- Cross-language pin: the delete case hashes {legacyId, tombstoned:true}, and
-- fingerprintCombatLogArchiveTombstone in
-- src/lib/durableDm/combatLogArchiveFamily.ts hashes the same canonical form
-- {"legacyId":"arc-ghost","tombstoned":true}. The expected value is the
-- SHA-256 of that exact TypeScript canonical string.
select is(
  private.campaign_document_hash(pg_catalog.jsonb_build_object('legacyId','arc-ghost','tombstoned',true)),
  '79075169a66b618652e693a8b20cec19c0ae995aec591ae40d446d1233f12fb8',
  'the combat log archive tombstone hashes identically in Postgres and the browser'
);

-- private.valid_combat_log_archive_payload measures its string bounds with
-- octet_length(text), which counts bytes in the server encoding. That is the
-- same count as octet_length(convert_to(value,'UTF8')) only while the server
-- encoding is UTF8, so the equivalence is pinned here.
select is(current_setting('server_encoding'),'UTF8','combat log archive byte bounds are measured in UTF-8 bytes');

-- Fixture builder for the canonical-size boundary. `p_pad` grows exactly one
-- event's sourceName, so the canonical byte size is a linear function of the
-- event count and the pad and can be driven onto an exact boundary.
create function pg_temp.clog_boundary_payload(p_events integer,p_pad integer) returns jsonb language sql as $fn$
select pg_catalog.jsonb_build_object(
  'encounterId','enc-boundary',
  'startedAt','2026-01-01T00:00:00.000Z',
  'endedAt','2026-01-02T00:00:00.000Z',
  'events',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id','ev-'||lpad(i::text,4,'0'),
    'timestamp','2026-01-01T00:00:00.000Z',
    'round',1,'turn',1,'encounterId','enc-boundary','type','damage',
    'sourceId','s','sourceName',case when i=1 then repeat('a',p_pad) else '' end,
    'targetId','t','targetName','','amount',1,'damageType',''
  ) order by i) from generate_series(1,p_events) i),'[]'::jsonb)
);
$fn$;

create temporary table clog_boundary(kind text,payload jsonb,fingerprint text,bytes integer);
do $$
declare v_b1 integer; v_b2 integer; v_event integer; v_shell integer; v_count integer; v_pad integer;
begin
  v_b1:=pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(pg_temp.clog_boundary_payload(1,0)),'UTF8'));
  v_b2:=pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(pg_temp.clog_boundary_payload(2,0)),'UTF8'));
  v_event:=v_b2-v_b1; v_shell:=v_b1-v_event;
  v_count:=(262145-v_shell)/v_event; v_pad:=262145-v_shell-v_count*v_event;
  if v_pad<1 then v_count:=v_count-1; v_pad:=v_pad+v_event; end if;
  insert into clog_boundary(kind,payload) values
    ('over',pg_temp.clog_boundary_payload(v_count,v_pad)),
    ('exact',pg_temp.clog_boundary_payload(v_count,v_pad-1));
end $$;
update clog_boundary set
  fingerprint=private.campaign_document_hash(payload),
  bytes=pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(payload),'UTF8'));
grant select on clog_boundary to authenticated;
select is((select bytes from clog_boundary where kind='over'),262145,'the oversize fixture is exactly one byte over the canonical record limit');
select is((select bytes from clog_boundary where kind='exact'),262144,'the boundary fixture sits exactly on the canonical record limit');
-- ::text::jsonb re-parses the fixture so the measurement sees the same freshly
-- parsed, uncompressed datum PostgREST hands the function; read straight out of
-- the temp table it arrives TOAST-compressed and hides the defect entirely.
select ok(pg_column_size((select payload from clog_boundary where kind='exact')::text::jsonb)>262144,'the boundary fixture''s wire-parsed jsonb datum exceeds the record limit');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

create temporary table clog_workspace as
select public.create_campaign_workspace(
  'c1000000-0000-4000-8000-000000000001','Combat log archive test','new_workspace',null
) as result;
grant select on clog_workspace to authenticated;

reset role;
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from clog_workspace) and axis='durable_family' and family='combat_log_archive'),'legacy','combat log archive family starts legacy');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from clog_workspace) and axis='durable_family' and family='encounter_definition'),'legacy','combat log archive work does not activate encounters');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from clog_workspace) and axis='durable_family' and family='npc'),'legacy','combat log archive work does not activate npcs');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from clog_workspace) and axis='durable_family' and family='magic_item'),'legacy','combat log archive work does not activate magic items');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from clog_workspace) and axis='durable_family' and family='calendar'),'legacy','combat log archive work does not activate calendars');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from clog_workspace) and axis='durable_family' and family='campaign_settings'),'legacy','combat log archive work does not activate settings');

create temporary table clog_fixture as
select 'arc-a'::text as legacy_id, pg_catalog.jsonb_build_object(
  'encounterId','enc-ashfall',
  'startedAt','2026-08-01T18:00:00.000Z',
  'endedAt','2026-08-01T18:42:00.000Z',
  'events',pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'id','ev-1','timestamp','2026-08-01T18:00:05.000Z','round',1,'turn',0,
      'encounterId','enc-ashfall','type','combat_start',
      'participantNames',pg_catalog.jsonb_build_array('Sera Vale','Ash the Cult Prophet')
    ),
    pg_catalog.jsonb_build_object(
      'id','ev-2','timestamp','2026-08-01T18:01:00.000Z','round',1,'turn',1,
      'encounterId','enc-ashfall','type','damage',
      'sourceId','ent-player-1','sourceName','Sera Vale',
      'targetId','ent-npc-1','targetName','Ash the Cult Prophet',
      'amount',12,'damageType','radiant','isCritical',true,'weaponOrSpellName','Sunblade'
    ),
    pg_catalog.jsonb_build_object(
      'id','ev-3','timestamp','2026-08-01T18:02:00.000Z','round',1,'turn',2,
      'encounterId','enc-ashfall','type','condition_applied',
      'targetId','ent-player-1','targetName','Sera Vale','conditionName','Prone'
    ),
    pg_catalog.jsonb_build_object(
      'id','ev-4','timestamp','2026-08-01T18:41:00.000Z','round',4,'turn',0,
      'encounterId','enc-ashfall','type','combat_end',
      'participantNames',pg_catalog.jsonb_build_array('Sera Vale'),'endReason','victory'
    )
  )
) as payload
union all
select 'arc-b'::text, pg_catalog.jsonb_build_object(
  'encounterId','enc-ashfall',
  'startedAt','2026-08-02T18:00:00.000Z',
  'endedAt','2026-08-02T18:05:00.000Z',
  'events','[]'::jsonb
);
alter table clog_fixture add column fingerprint text;
alter table clog_fixture add column bytes integer;
update clog_fixture set fingerprint=private.campaign_document_hash(payload),bytes=pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(payload),'UTF8'));
grant select on clog_fixture to authenticated;

-- Ruling 3: an archive that is still open carries no endedAt at all.
create temporary table clog_open_fixture as
select legacy_id, payload - 'endedAt' as payload from clog_fixture where legacy_id='arc-a';
alter table clog_open_fixture add column fingerprint text;
update clog_open_fixture set fingerprint=private.campaign_document_hash(payload);
grant select on clog_open_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select throws_ok(
  $$select public.begin_combat_log_archive_staging('c2000000-0000-4000-8000-000000000001',(select (result->>'campaignId')::uuid from clog_workspace),'c3000000-0000-4000-8000-000000000001',0,repeat('a',64),repeat('b',64),repeat('b',64),2,(select sum(bytes) from clog_fixture))$$,
  '42501','campaign owner authorization is required','other account cannot stage combat log archives'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select throws_ok(
  $$select public.begin_combat_log_archive_staging('c2000000-0000-4000-8000-000000000070',(select (result->>'campaignId')::uuid from clog_workspace),'c3000000-0000-4000-8000-000000000001',7,repeat('a',64),repeat('b',64),repeat('b',64),2,(select sum(bytes) from clog_fixture))$$,
  '40001','stale combat log archive epoch','a stale epoch cannot begin combat log archive staging'
);
create temporary table clog_run as
select public.begin_combat_log_archive_staging(
  'c2000000-0000-4000-8000-000000000002',(select (result->>'campaignId')::uuid from clog_workspace),
  'c3000000-0000-4000-8000-000000000001',0,repeat('a',64),repeat('b',64),repeat('b',64),2,(select sum(bytes) from clog_fixture)
) as result;
grant select on clog_run to authenticated;
select is(result->>'state','staging','matching recovery receipt begins combat log archive staging') from clog_run;
select is(
  public.stage_combat_log_archive_items(
    'c2000000-0000-4000-8000-000000000003',(select (result->>'runId')::uuid from clog_run),
    (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('legacyId',legacy_id,'schemaVersion',2,'payload',payload,'payloadFingerprint',fingerprint,'tombstoned',false) order by legacy_id) from clog_fixture)
  )->>'state','validated','every staged combat log archive validates against the manifest'
);

-- Ruling 3: an open archive raises the manifest's active-combat-log blocker and
-- can never be staged, even though CAS accepts an open archive freely.
select throws_ok(
  $$select public.stage_combat_log_archive_items(
    'c2000000-0000-4000-8000-000000000040',(select (result->>'runId')::uuid from clog_run),
    (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'legacyId',legacy_id,'schemaVersion',2,'payload',payload,
      'payloadFingerprint',fingerprint,'tombstoned',false
    ) order by legacy_id) from clog_open_fixture)
  )$$,
  '22023','open combat log archive blocks cutover','an open combat log archive cannot be staged for cutover'
);

create temporary table clog_cutover as
select public.confirm_combat_log_archive_cutover('c2000000-0000-4000-8000-000000000004',(select (result->>'runId')::uuid from clog_run),repeat('a',64),0) as result;
grant select on clog_cutover to authenticated;
select is(result->>'authority','postgres','explicit confirmation activates only combat log archives') from clog_cutover;
select is(result->>'recordCount','2','cutover reports the whole staged generation') from clog_cutover;

reset role;
select is((select count(*) from public.campaign_documents where family='combat_log_archive' and campaign_id=(select (result->>'campaignId')::uuid from clog_workspace)),2::bigint,'combat log archive current rows created');
select is((select count(*) from private.campaign_document_versions where family='combat_log_archive' and campaign_id=(select (result->>'campaignId')::uuid from clog_workspace)),2::bigint,'combat log archive version 1 rows created atomically');
select is((select count(*) from private.campaign_document_projection_outbox where family='combat_log_archive'),0::bigint,'combat log archives never queue projection work');
select throws_ok(
  $$insert into private.campaign_document_projection_outbox(campaign_id,campaign_document_version_id,family,legacy_id,server_version,cutover_epoch,projection_kind,source_fingerprint)
    select v.campaign_id,v.id,'combat_log_archive',v.legacy_id,v.server_version,v.cutover_epoch,'calendar_v1',v.payload_fingerprint
    from private.campaign_document_versions v where v.family='combat_log_archive' limit 1$$,
  '23514',
  'new row for relation "campaign_document_projection_outbox" violates check constraint "campaign_document_projection_outbox_family_check"',
  'the projection outbox structurally rejects the combat log archive family'
);
select is((select count(*) from private.campaign_family_device_enrollments where family='combat_log_archive' and device_id='c3000000-0000-4000-8000-000000000001'),1::bigint,'initial combat log archive device enrolled atomically');

create temporary table clog_v2 as
select pg_catalog.jsonb_set(payload,'{events,3,endReason}','"dm_ended"'::jsonb) as payload
from clog_fixture where legacy_id='arc-a';
alter table clog_v2 add column fingerprint text;
update clog_v2 set fingerprint=private.campaign_document_hash(payload);
grant select on clog_v2 to authenticated;
create temporary table clog_tombstone_fingerprint as
select private.campaign_document_hash(
  pg_catalog.jsonb_build_object('legacyId','arc-a','tombstoned',true)
) as fingerprint;
grant select on clog_tombstone_fingerprint to authenticated;
create temporary table clog_duplicate_child as
select pg_catalog.jsonb_set(payload,'{events}',pg_catalog.jsonb_build_array(
  pg_catalog.jsonb_build_object('id','ev-1','timestamp','t','round',1,'turn',0,'encounterId','enc-ashfall','type','turn_start','entityId','e1','entityName','Sera Vale'),
  pg_catalog.jsonb_build_object('id','ev-1','timestamp','t','round',1,'turn',1,'encounterId','enc-ashfall','type','turn_end','entityId','e1','entityName','Sera Vale')
)) as payload
from clog_fixture where legacy_id='arc-a';
grant select on clog_duplicate_child to authenticated;
-- The per-discriminator allowlist: a damage event may not carry spellName.
create temporary table clog_foreign_field as
select pg_catalog.jsonb_set(payload,'{events}',pg_catalog.jsonb_build_array(
  pg_catalog.jsonb_build_object('id','ev-1','timestamp','t','round',1,'turn',0,'encounterId','enc-ashfall','type','damage',
    'sourceId','s','sourceName','Sera Vale','targetId','t','targetName','Ash',
    'amount',3,'damageType','radiant','spellName','Fireball')
)) as payload
from clog_fixture where legacy_id='arc-a';
grant select on clog_foreign_field to authenticated;
-- Byte bounds, not code-unit bounds: 128 two-byte characters are 128 code
-- points but 256 UTF-8 bytes, one over the 255-byte stable-ID bound, and the
-- TypeScript validator rejects them. SQL length() would accept this document.
create temporary table clog_multibyte as
select pg_catalog.jsonb_build_object(
  'encounterId',repeat(U&'\00E9',128),'startedAt','2026-08-01T00:00:00.000Z','events','[]'::jsonb
) as payload;
grant select on clog_multibyte to authenticated;
create temporary table clog_foreign_event as
select pg_catalog.jsonb_set(payload,'{events}',pg_catalog.jsonb_build_array(
  pg_catalog.jsonb_build_object('id','ev-1','timestamp','t','round',1,'turn',0,'encounterId','enc-somewhere-else','type','turn_start','entityId','e1','entityName','Sera Vale')
)) as payload
from clog_fixture where legacy_id='arc-a';
grant select on clog_foreign_event to authenticated;
-- A non-finite number must never reach a stored archive. PostgreSQL renders
-- to_jsonb('NaN'::numeric) as the JSON *string* "NaN", so the closest a caller
-- can get to a non-finite number is caught by the number-kind rule; the
-- validator's explicit 'NaN'/'Infinity'/'-Infinity' guard backs that up.
create temporary table clog_non_finite as
select pg_catalog.jsonb_set(payload,'{events}',pg_catalog.jsonb_build_array(
  pg_catalog.jsonb_build_object('id','ev-1','timestamp','t','round',1,'turn',0,'encounterId','enc-ashfall','type','damage',
    'sourceId','s','sourceName','Sera Vale','targetId','t','targetName','Ash',
    'amount',pg_catalog.to_jsonb('NaN'::numeric),'damageType','radiant')
)) as payload
from clog_fixture where legacy_id='arc-a';
grant select on clog_non_finite to authenticated;
-- The TypeScript isAbsent helper treats an explicit null as absent, and
-- canonicalJson preserves the key, so {"endedAt":null} is a document the
-- browser validates and hands to the server exactly as spelled.
create temporary table clog_null_ended as
select pg_catalog.jsonb_build_object(
  'encounterId','enc-null','startedAt','2026-08-04T18:00:00.000Z','events','[]'::jsonb,'endedAt',null
) as payload;
alter table clog_null_ended add column fingerprint text;
update clog_null_ended set fingerprint=private.campaign_document_hash(payload);
grant select on clog_null_ended to authenticated;
-- Ruling 3: an archive that is still open is a fully valid durable document.
create temporary table clog_open_document as
select pg_catalog.jsonb_build_object(
  'encounterId','enc-open','startedAt','2026-08-03T18:00:00.000Z','events','[]'::jsonb
) as payload;
alter table clog_open_document add column fingerprint text;
update clog_open_document set fingerprint=private.campaign_document_hash(payload);
grant select on clog_open_document to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select is(
  public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000005',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-a','replace',1,2,(select payload from clog_v2),(select fingerprint from clog_v2))->>'serverVersion',
  '2','combat log archive CAS accepts a replace on the expected base version'
);
select is(
  public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000005',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-a','replace',1,2,(select payload from clog_v2),(select fingerprint from clog_v2))->>'serverVersion',
  '2','response-loss retry returns the stored combat log archive receipt'
);
select throws_ok(
  $$select public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000006',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-a','replace',1,2,(select payload from clog_v2),(select fingerprint from clog_v2))$$,
  '40001','combat log archive server version conflict','stale combat log archive CAS loses without overwrite'
);
select throws_ok(
  $$select public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000071',(select (result->>'campaignId')::uuid from clog_workspace),9,'arc-a','replace',2,2,(select payload from clog_v2),(select fingerprint from clog_v2))$$,
  '40001','stale combat log archive epoch','a stale epoch cannot write a combat log archive'
);

reset role;
-- The version row is appended in the same transaction as the current-row
-- update, so the current server version and its immutable version row always
-- agree.
select is((select server_version from public.campaign_documents where family='combat_log_archive' and legacy_id='arc-a' and campaign_id=(select (result->>'campaignId')::uuid from clog_workspace)),2::bigint,'the accepted combat log archive write advances the current row');
select is((select count(*) from private.campaign_document_versions where family='combat_log_archive' and legacy_id='arc-a' and campaign_id=(select (result->>'campaignId')::uuid from clog_workspace)),2::bigint,'the accepted write appended exactly one new combat log archive version row');
select is((select base_server_version from private.campaign_document_versions where family='combat_log_archive' and legacy_id='arc-a' and server_version=2 and campaign_id=(select (result->>'campaignId')::uuid from clog_workspace)),1::bigint,'the appended combat log archive version records its CAS base version');
select is((select v.payload_fingerprint from private.campaign_document_versions v join public.campaign_documents d on d.id=v.campaign_document_id where v.family='combat_log_archive' and v.legacy_id='arc-a' and v.server_version=d.server_version and d.campaign_id=(select (result->>'campaignId')::uuid from clog_workspace)),(select fingerprint from clog_v2),'the newest combat log archive version matches the current row fingerprint');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select throws_ok(
  $$select public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000007',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-c','create',0,2,pg_catalog.jsonb_build_object('encounterId','enc-x','startedAt','2026-08-01T00:00:00.000Z','events','[]'::jsonb,'secretPlan',true),repeat('a',64))$$,
  '22023','invalid combat log archive mutation','unclassified combat log archive fields are rejected'
);
select throws_ok(
  $$select public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000013',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-d','create',0,2,(select payload from clog_duplicate_child),repeat('a',64))$$,
  '22023','invalid combat log archive mutation','duplicate combat log archive event ids are rejected'
);
select throws_ok(
  $$select public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000014',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-e','create',0,2,(select payload from clog_foreign_event),repeat('a',64))$$,
  '22023','invalid combat log archive mutation','an event belonging to another encounter is rejected'
);
select throws_ok(
  $$select public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000015',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-f','create',0,2,(select payload from clog_non_finite),repeat('a',64))$$,
  '22023','invalid combat log archive mutation','a non-finite combat log archive number is rejected'
);
select throws_ok(
  $$select public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000072',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-i','create',0,2,(select payload from clog_foreign_field),repeat('a',64))$$,
  '22023','invalid combat log archive mutation','a field that does not belong to the event discriminator is rejected'
);
select throws_ok(
  $$select public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000073',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-j','create',0,2,(select payload from clog_multibyte),repeat('a',64))$$,
  '22023','invalid combat log archive mutation','a 256-byte multibyte encounterId is rejected on its byte length'
);
select throws_ok(
  $$select public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000016',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-g','create',0,2,pg_catalog.jsonb_build_object('encounterId','enc-x','startedAt','2026-08-01T00:00:00.000Z','events','[]'::jsonb),repeat('a',64))$$,
  '22023','combat log archive fingerprint mismatch','a combat log archive fingerprint mismatch is rejected'
);
select throws_ok(
  $$select public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000017',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-h','create',0,3,(select payload from clog_open_document),(select fingerprint from clog_open_document))$$,
  '22023','invalid combat log archive mutation','only schema version 2 combat log archives are accepted'
);
select throws_ok(
  $$select public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000018',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-over','create',0,2,(select payload from clog_boundary where kind='over')::text::jsonb,(select fingerprint from clog_boundary where kind='over'))$$,
  '22023','invalid combat log archive mutation','a combat log archive one byte over the canonical limit is rejected'
);
-- Ruling 3: an archive that is still open commits like any other edit.
select is(
  public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000019',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-open','create',0,2,(select payload from clog_open_document),(select fingerprint from clog_open_document))->>'serverVersion',
  '1','a combat log archive with no endedAt is accepted through CAS'
);
select is(
  public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000074',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-null','create',0,2,(select payload from clog_null_ended),(select fingerprint from clog_null_ended))->>'serverVersion',
  '1','an explicit endedAt null counts as absent exactly as it does in the browser'
);
select is(
  public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000019',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-open','create',0,2,(select payload from clog_open_document),(select fingerprint from clog_open_document))->>'playerView',
  'not-applicable','a combat log archive write never produces a player view'
);
-- The same record staging measures is always writable through CAS: measuring
-- pg_column_size here instead of the canonical UTF-8 bytes would reject it.
select is(
  public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000020',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-boundary','create',0,2,(select payload from clog_boundary where kind='exact')::text::jsonb,(select fingerprint from clog_boundary where kind='exact'))->>'serverVersion',
  '1','a record that staging would accept is always writable through combat log archive CAS'
);
select is((public.list_combat_log_archive_document_versions((select (result->>'campaignId')::uuid from clog_workspace),'arc-a')->'versions'->0->>'serverVersion'),'2','combat log archive history metadata is newest first');
select is((public.export_combat_log_archive_document_version((select (result->>'campaignId')::uuid from clog_workspace),'arc-a',1)->'payload'->'events'->1->>'weaponOrSpellName'),'Sunblade','exact private combat log archive history export remains owner-only');
select is((public.compare_combat_log_archive_document_versions((select (result->>'campaignId')::uuid from clog_workspace),'arc-a',1,2)->>'identical'),'false','two distinct combat log archive versions compare as different');
select is(
  public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000008',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-a','delete',2,2,null,(select fingerprint from clog_tombstone_fingerprint))->>'tombstoned',
  'true','combat log archive deletion creates an explicit tombstone version'
);
select throws_ok(
  $$select public.put_combat_log_archive_document('c2000000-0000-4000-8000-000000000009',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-a','replace',3,2,(select payload from clog_fixture where legacy_id='arc-a'),(select fingerprint from clog_fixture where legacy_id='arc-a'))$$,
  '55000','combat log archive tombstone cannot be resurrected without explicit history restore','ordinary writes cannot resurrect a combat log archive tombstone'
);
select is(
  public.restore_combat_log_archive_document_version('c2000000-0000-4000-8000-000000000010',(select (result->>'campaignId')::uuid from clog_workspace),1,'arc-a',1,3)->>'serverVersion',
  '4','explicit owner history restore creates a new combat log archive version after tombstone'
);
select is(
  public.preview_combat_log_archive_device_enrollment((select (result->>'campaignId')::uuid from clog_workspace))->>'recordCount',
  '5','combat log archive enrollment preview reports the whole generation'
);
select matches(
  public.preview_combat_log_archive_device_enrollment((select (result->>'campaignId')::uuid from clog_workspace))->>'previewFingerprint',
  '^[a-f0-9]{64}$','combat log archive enrollment preview is fingerprinted'
);
select is(public.remove_combat_log_archive_device('c2000000-0000-4000-8000-000000000011',(select (result->>'campaignId')::uuid from clog_workspace),'c3000000-0000-4000-8000-000000000001',1)->>'state','removed','exact combat log archive device removal succeeds');

reset role;
create temporary table clog_generation as
select private.combat_log_archive_generation((select (result->>'campaignId')::uuid from clog_workspace)) as documents;
grant select on clog_generation to authenticated;
create temporary table clog_mutated_generation as
select pg_catalog.jsonb_set(documents,'{0,serverVersion}','99'::jsonb) as documents from clog_generation;
grant select on clog_mutated_generation to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

-- The positive rollback below hands the server back its own generation, so on
-- its own it can never exercise the compare. These three cases do.
select throws_ok(
  $$select public.enroll_combat_log_archive_device('c2000000-0000-4000-8000-000000000050',(select (result->>'campaignId')::uuid from clog_workspace),'c3000000-0000-4000-8000-000000000004',1,repeat('a',64),null)$$,
  '40001','combat log archive enrollment preview changed','a stale combat log archive enrollment preview cannot enroll a device'
);
select throws_ok(
  $$select public.rollback_combat_log_archive_family(
    'c2000000-0000-4000-8000-000000000051',(select (result->>'campaignId')::uuid from clog_workspace),1,
    (select public.preview_combat_log_archive_device_enrollment((select (result->>'campaignId')::uuid from clog_workspace))->>'previewFingerprint'),
    pg_catalog.jsonb_build_object('recordCount',5,'documents',(select documents from clog_mutated_generation))
  )$$,
  '40001','verified combat log archive generation changed','a mutated combat log archive generation cannot authorize rollback'
);
select throws_ok(
  $$select public.rollback_combat_log_archive_family(
    'c2000000-0000-4000-8000-000000000052',(select (result->>'campaignId')::uuid from clog_workspace),1,
    (select public.preview_combat_log_archive_device_enrollment((select (result->>'campaignId')::uuid from clog_workspace))->>'previewFingerprint'),
    '[]'::jsonb
  )$$,
  '55000','verified current combat log archive generation required','an empty combat log archive generation cannot authorize rollback'
);

create temporary table clog_rollback as
select public.rollback_combat_log_archive_family(
  'c2000000-0000-4000-8000-000000000012',(select (result->>'campaignId')::uuid from clog_workspace),1,
  (select public.preview_combat_log_archive_device_enrollment((select (result->>'campaignId')::uuid from clog_workspace))->>'previewFingerprint'),
  pg_catalog.jsonb_build_object('recordCount',5,'documents',(select documents from clog_generation))
) as result;
grant select on clog_rollback to authenticated;
select is(result->>'authority','legacy','verified combat log archive rollback restores legacy authority') from clog_rollback;
select is(result->>'epoch','2','combat log archive rollback advances the family epoch') from clog_rollback;

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.campaign_documents where family='combat_log_archive' and campaign_id=(select (result->>'campaignId')::uuid from clog_workspace)),0::bigint,'other accounts see no combat log archive rows');

reset role;
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from clog_workspace) and axis='durable_family' and family='encounter_definition'),'legacy','combat log archive mutations never move encounter authority');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from clog_workspace) and axis='durable_family' and family='npc'),'legacy','combat log archive mutations never move npc authority');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from clog_workspace) and axis='durable_family' and family='magic_item'),'legacy','combat log archive mutations never move magic item authority');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from clog_workspace) and axis='durable_family' and family='calendar'),'legacy','combat log archive mutations never move calendar authority');
select is((select authority from public.campaign_authority_records where campaign_id=(select (result->>'campaignId')::uuid from clog_workspace) and axis='durable_family' and family='campaign_settings'),'legacy','combat log archive mutations never move settings authority');

-- A local deletion made between local cutover and cloud activation must reach
-- the cloud as an explicit version-1 tombstone during the very first staging,
-- and it must be accounted for by the canonical bytes of its tombstone object,
-- exactly the byteCount the TypeScript manifest sums into the family total.
reset role;
create temporary table clog_tombstone_stage as
select 'arc-ghost'::text as legacy_id,
  private.campaign_document_hash(pg_catalog.jsonb_build_object('legacyId','arc-ghost','tombstoned',true)) as fingerprint,
  pg_catalog.octet_length(pg_catalog.convert_to(private.canonical_campaign_document_json(pg_catalog.jsonb_build_object('legacyId','arc-ghost','tombstoned',true)),'UTF8')) as bytes;
grant select on clog_tombstone_stage to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
create temporary table clog_tombstone_workspace as
select public.create_campaign_workspace(
  'c1000000-0000-4000-8000-000000000002','Combat log archive tombstone staging','new_workspace',null
) as result;
grant select on clog_tombstone_workspace to authenticated;
create temporary table clog_tombstone_run as
select public.begin_combat_log_archive_staging(
  'c2000000-0000-4000-8000-000000000021',(select (result->>'campaignId')::uuid from clog_tombstone_workspace),
  'c3000000-0000-4000-8000-000000000002',0,repeat('c',64),repeat('d',64),repeat('d',64),1,(select bytes from clog_tombstone_stage)
) as result;
grant select on clog_tombstone_run to authenticated;
select is(
  public.stage_combat_log_archive_items(
    'c2000000-0000-4000-8000-000000000022',(select (result->>'runId')::uuid from clog_tombstone_run),
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'legacyId',(select legacy_id from clog_tombstone_stage),'schemaVersion',2,'payload',null,
      'payloadFingerprint',(select fingerprint from clog_tombstone_stage),'tombstoned',true
    ))
  )->>'totalBytes',(select bytes from clog_tombstone_stage)::text,
  'a staged combat log archive tombstone is accounted for by its own canonical tombstone bytes'
);
select is(
  public.confirm_combat_log_archive_cutover('c2000000-0000-4000-8000-000000000023',(select (result->>'runId')::uuid from clog_tombstone_run),repeat('c',64),0)->>'recordCount',
  '1','a tombstone-only manifest confirms its whole staged generation'
);

reset role;
select is(
  (select tombstoned from public.campaign_documents where family='combat_log_archive' and legacy_id='arc-ghost' and campaign_id=(select (result->>'campaignId')::uuid from clog_tombstone_workspace)),
  true,'the staged combat log archive tombstone reaches the cloud as a tombstoned current row'
);
select is(
  (select server_version from private.campaign_document_versions where family='combat_log_archive' and legacy_id='arc-ghost' and campaign_id=(select (result->>'campaignId')::uuid from clog_tombstone_workspace)),
  1::bigint,'the staged combat log archive tombstone is durable as an immutable version 1'
);

-- An owner with no combat log archives must still be able to activate the family.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
create temporary table clog_empty_workspace as
select public.create_campaign_workspace(
  'c1000000-0000-4000-8000-000000000003','Combat log archive empty staging','new_workspace',null
) as result;
grant select on clog_empty_workspace to authenticated;
create temporary table clog_empty_run as
select public.begin_combat_log_archive_staging(
  'c2000000-0000-4000-8000-000000000030',(select (result->>'campaignId')::uuid from clog_empty_workspace),
  'c3000000-0000-4000-8000-000000000003',0,repeat('e',64),repeat('f',64),repeat('f',64),0,0
) as result;
grant select on clog_empty_run to authenticated;
select is(
  public.stage_combat_log_archive_items('c2000000-0000-4000-8000-000000000031',(select (result->>'runId')::uuid from clog_empty_run),'[]'::jsonb)->>'state',
  'validated','an empty combat log archive roster stages as a complete zero-record generation'
);
create temporary table clog_empty_cutover as
select public.confirm_combat_log_archive_cutover('c2000000-0000-4000-8000-000000000032',(select (result->>'runId')::uuid from clog_empty_run),repeat('e',64),0) as result;
grant select on clog_empty_cutover to authenticated;
select is(result->>'recordCount','0','a zero-record run confirms without any staged document') from clog_empty_cutover;
select is(result->>'authority','postgres','a zero-record cutover still activates only combat log archive authority') from clog_empty_cutover;

reset role;

select * from finish();
rollback;
