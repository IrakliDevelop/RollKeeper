#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const SEED_VERSION = 1;
const SENTINEL = 'rollkeeper-manual-browser-v1';

function persisted(state, version) {
  return JSON.stringify({ state, version });
}

/**
 * Slice 11F manual gate: `rollkeeper-combat-log` at persist version 2 (the
 * combat log store's `COMBAT_LOG_ARCHIVE_PERSIST_VERSION`), `encounters` keyed
 * by a fixed `archiveId` (Ruling 6) rather than by `encounterId`. Writing v1
 * would be silently migrated to v2 on load with freshly minted UUID archive
 * ids, defeating the fixed ids the checklist's expected counts rely on.
 *
 * Four archives:
 *  - combat-log-archive-seed-001 and -002 share `encounterId`
 *    encounter-seed-001 — two separate, fully ended runs of the same
 *    encounter (Ruling 6: the card must list them as two archives).
 *  - combat-log-archive-seed-003 is a second, distinct encounter.
 *  - combat-log-archive-seed-004 carries no `campaignCode` (an unscoped /
 *    orphan archive), exercising the "not linked to a campaign" path — the
 *    sync card and campaign-scoped manifest both ignore it by design.
 * All four are ended (`endedAt` set): an open archive blocks cutover
 * (`active-combat-log`), which would make the gate's cutover scenarios
 * unreachable.
 */
const COMBAT_LOG_SEED_CAMPAIGN_CODE = 'MANUAL';

const combatLogSeedArchives = {
  'combat-log-archive-seed-001': {
    encounterId: 'encounter-seed-001',
    campaignCode: COMBAT_LOG_SEED_CAMPAIGN_CODE,
    startedAt: '2000-01-01T00:00:00.000Z',
    endedAt: '2000-01-01T00:30:00.000Z',
    events: [
      {
        id: 'combat-log-archive-seed-001-evt-01',
        type: 'combat_start',
        timestamp: '2000-01-01T00:00:05.000Z',
        round: 1,
        turn: 1,
        encounterId: 'encounter-seed-001',
        participantNames: ['Synthetic Fighter', 'Synthetic Goblin'],
      },
      {
        id: 'combat-log-archive-seed-001-evt-02',
        type: 'damage',
        timestamp: '2000-01-01T00:02:00.000Z',
        round: 1,
        turn: 1,
        encounterId: 'encounter-seed-001',
        sourceId: 'seed-fighter-01',
        sourceName: 'Synthetic Fighter',
        targetId: 'seed-goblin-01',
        targetName: 'Synthetic Goblin',
        amount: 8,
        damageType: 'slashing',
        weaponOrSpellName: 'Longsword',
      },
      {
        id: 'combat-log-archive-seed-001-evt-03',
        type: 'condition_applied',
        timestamp: '2000-01-01T00:04:00.000Z',
        round: 1,
        turn: 2,
        encounterId: 'encounter-seed-001',
        sourceId: 'seed-fighter-01',
        sourceName: 'Synthetic Fighter',
        targetId: 'seed-goblin-01',
        targetName: 'Synthetic Goblin',
        conditionName: 'Prone',
        duration: '1 round',
      },
      {
        id: 'combat-log-archive-seed-001-evt-04',
        type: 'healing',
        timestamp: '2000-01-01T00:10:00.000Z',
        round: 2,
        turn: 1,
        encounterId: 'encounter-seed-001',
        sourceId: 'seed-cleric-01',
        sourceName: 'Synthetic Cleric',
        targetId: 'seed-fighter-01',
        targetName: 'Synthetic Fighter',
        amount: 5,
        actualHealing: 5,
        spellOrAbilityName: 'Cure Wounds',
      },
      {
        id: 'combat-log-archive-seed-001-evt-05',
        type: 'combat_end',
        timestamp: '2000-01-01T00:29:00.000Z',
        round: 3,
        turn: 1,
        encounterId: 'encounter-seed-001',
        participantNames: ['Synthetic Fighter', 'Synthetic Goblin'],
        endReason: 'victory',
      },
    ],
  },
  'combat-log-archive-seed-002': {
    encounterId: 'encounter-seed-001',
    campaignCode: COMBAT_LOG_SEED_CAMPAIGN_CODE,
    startedAt: '2000-01-02T00:00:00.000Z',
    endedAt: '2000-01-02T00:25:00.000Z',
    events: [
      {
        id: 'combat-log-archive-seed-002-evt-01',
        type: 'combat_start',
        timestamp: '2000-01-02T00:00:05.000Z',
        round: 1,
        turn: 1,
        encounterId: 'encounter-seed-001',
        participantNames: ['Synthetic Fighter', 'Synthetic Goblin Chief'],
      },
      {
        id: 'combat-log-archive-seed-002-evt-02',
        type: 'damage',
        timestamp: '2000-01-02T00:03:00.000Z',
        round: 1,
        turn: 1,
        encounterId: 'encounter-seed-001',
        sourceId: 'seed-goblin-chief-01',
        sourceName: 'Synthetic Goblin Chief',
        targetId: 'seed-fighter-01',
        targetName: 'Synthetic Fighter',
        amount: 12,
        damageType: 'piercing',
        isCritical: true,
      },
      {
        id: 'combat-log-archive-seed-002-evt-03',
        type: 'condition_applied',
        timestamp: '2000-01-02T00:05:00.000Z',
        round: 1,
        turn: 2,
        encounterId: 'encounter-seed-001',
        sourceId: 'seed-goblin-chief-01',
        sourceName: 'Synthetic Goblin Chief',
        targetId: 'seed-fighter-01',
        targetName: 'Synthetic Fighter',
        conditionName: 'Bleeding',
      },
      {
        id: 'combat-log-archive-seed-002-evt-04',
        type: 'combat_end',
        timestamp: '2000-01-02T00:24:00.000Z',
        round: 2,
        turn: 1,
        encounterId: 'encounter-seed-001',
        participantNames: ['Synthetic Fighter', 'Synthetic Goblin Chief'],
        endReason: 'defeat',
      },
    ],
  },
  'combat-log-archive-seed-003': {
    encounterId: 'encounter-seed-002',
    campaignCode: COMBAT_LOG_SEED_CAMPAIGN_CODE,
    startedAt: '2000-01-03T00:00:00.000Z',
    endedAt: '2000-01-03T00:40:00.000Z',
    events: [
      {
        id: 'combat-log-archive-seed-003-evt-01',
        type: 'combat_start',
        timestamp: '2000-01-03T00:00:05.000Z',
        round: 1,
        turn: 1,
        encounterId: 'encounter-seed-002',
        participantNames: ['Synthetic Ranger', 'Synthetic Wolf'],
      },
      {
        id: 'combat-log-archive-seed-003-evt-02',
        type: 'spell_cast',
        timestamp: '2000-01-03T00:01:00.000Z',
        round: 1,
        turn: 1,
        encounterId: 'encounter-seed-002',
        casterId: 'seed-ranger-01',
        casterName: 'Synthetic Ranger',
        spellName: "Hunter's Mark",
        spellLevel: 1,
        slotUsed: 1,
        isConcentration: true,
      },
      {
        id: 'combat-log-archive-seed-003-evt-03',
        type: 'damage',
        timestamp: '2000-01-03T00:05:00.000Z',
        round: 1,
        turn: 2,
        encounterId: 'encounter-seed-002',
        sourceId: 'seed-ranger-01',
        sourceName: 'Synthetic Ranger',
        targetId: 'seed-wolf-01',
        targetName: 'Synthetic Wolf',
        amount: 6,
        damageType: 'piercing',
      },
      {
        id: 'combat-log-archive-seed-003-evt-04',
        type: 'death',
        timestamp: '2000-01-03T00:15:00.000Z',
        round: 2,
        turn: 1,
        encounterId: 'encounter-seed-002',
        entityId: 'seed-wolf-01',
        entityName: 'Synthetic Wolf',
      },
      {
        id: 'combat-log-archive-seed-003-evt-05',
        type: 'combat_end',
        timestamp: '2000-01-03T00:39:00.000Z',
        round: 2,
        turn: 2,
        encounterId: 'encounter-seed-002',
        participantNames: ['Synthetic Ranger', 'Synthetic Wolf'],
        endReason: 'victory',
      },
    ],
  },
  // Unscoped / orphan: no campaignCode, so it belongs to no campaign's card.
  'combat-log-archive-seed-004': {
    encounterId: 'encounter-seed-003',
    startedAt: '2000-01-04T00:00:00.000Z',
    endedAt: '2000-01-04T00:10:00.000Z',
    events: [
      {
        id: 'combat-log-archive-seed-004-evt-01',
        type: 'combat_start',
        timestamp: '2000-01-04T00:00:05.000Z',
        round: 1,
        turn: 1,
        encounterId: 'encounter-seed-003',
        participantNames: ['Synthetic Rogue', 'Synthetic Bandit'],
      },
      {
        id: 'combat-log-archive-seed-004-evt-02',
        type: 'damage',
        timestamp: '2000-01-04T00:02:00.000Z',
        round: 1,
        turn: 1,
        encounterId: 'encounter-seed-003',
        sourceId: 'seed-rogue-01',
        sourceName: 'Synthetic Rogue',
        targetId: 'seed-bandit-01',
        targetName: 'Synthetic Bandit',
        amount: 9,
        damageType: 'piercing',
        weaponOrSpellName: 'Shortsword',
      },
      {
        id: 'combat-log-archive-seed-004-evt-03',
        type: 'combat_end',
        timestamp: '2000-01-04T00:09:00.000Z',
        round: 1,
        turn: 2,
        encounterId: 'encounter-seed-003',
        participantNames: ['Synthetic Rogue', 'Synthetic Bandit'],
        endReason: 'victory',
      },
    ],
  },
};

export function buildFakeSeedBundle() {
  const localStorageEntries = {
    'rollkeeper-dm-data': persisted(
      {
        dmId: 'dm-manual-browser',
        campaigns: [
          {
            code: 'MANUAL',
            name: 'Synthetic Acceptance Campaign',
            createdAt: '2000-01-01T00:00:00.000Z',
          },
        ],
      },
      1
    ),
    'rollkeeper-encounter-data': persisted(
      {
        encounters: [],
        activeEncounterId: null,
        encounterTombstones: {},
        acceptanceSentinel: SENTINEL,
      },
      2
    ),
    'rollkeeper-npc-data': persisted(
      { npcsByCampaign: {}, acceptanceSentinel: SENTINEL },
      4
    ),
    'rollkeeper-calendar-data': persisted(
      { calendars: [], acceptanceSentinel: SENTINEL },
      3
    ),
    'rollkeeper-location-data': persisted(
      { locations: {}, acceptanceSentinel: SENTINEL },
      0
    ),
    'rollkeeper-battlemap-data': persisted(
      { battleMaps: {}, acceptanceSentinel: SENTINEL },
      0
    ),
    'rollkeeper-combat-log': persisted(
      {
        encounters: combatLogSeedArchives,
        combatLogTombstones: {},
        activeArchiveId: null,
      },
      2
    ),
    'rollkeeper-dm-magic-item-library': persisted(
      { itemsByCampaign: {}, acceptanceSentinel: SENTINEL },
      1
    ),
    'rollkeeper-manual-acceptance-sentinel': SENTINEL,
  };

  const entries = Object.entries(localStorageEntries).map(
    ([key, rawValue]) => ({
      key,
      rawValue,
      utf8Bytes: Buffer.byteLength(rawValue, 'utf8'),
      sha256: createHash('sha256').update(rawValue, 'utf8').digest('hex'),
    })
  );
  const manifestInput = entries
    .map(({ key, utf8Bytes, sha256 }) => `${key}\0${utf8Bytes}\0${sha256}`)
    .join('\n');

  return {
    format: 'rollkeeper-manual-browser-seed',
    seedVersion: SEED_VERSION,
    characterDraft: {
      name: 'Mira Vale — Synthetic Acceptance',
      creationRoute: '/player/characters/new',
    },
    localStorageEntries,
    manifest: {
      entryCount: entries.length,
      totalUtf8Bytes: entries.reduce((sum, entry) => sum + entry.utf8Bytes, 0),
      sha256: createHash('sha256').update(manifestInput, 'utf8').digest('hex'),
      entries: entries.map(({ key, utf8Bytes, sha256 }) => ({
        key,
        utf8Bytes,
        sha256,
      })),
    },
  };
}

function printBundle() {
  const bundle = buildFakeSeedBundle();
  const summaryOnly = process.argv.includes('--summary');
  process.stdout.write(
    `${JSON.stringify(
      summaryOnly
        ? {
            format: bundle.format,
            seedVersion: bundle.seedVersion,
            characterDraft: bundle.characterDraft,
            manifest: bundle.manifest,
          }
        : bundle,
      null,
      2
    )}\n`
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  printBundle();
}
