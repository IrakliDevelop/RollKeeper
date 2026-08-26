#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const SEED_VERSION = 2;
const SENTINEL = 'rollkeeper-manual-browser-v1';

/**
 * Two campaigns, deliberately. Slice 11G migrates one campaign at a time, and
 * every family's aware storage must rewrite only the selected campaign's slice
 * of a shared `localStorage` envelope. Seeding a second campaign whose records
 * are *interleaved* with the first's (rather than appended after them) is what
 * makes that a real check by hand: if a write reorders, drops or rewrites the
 * other campaign's records, the interleaving is what exposes it.
 */
const SEED_CAMPAIGN_CODE = 'MANUAL';
const SEED_SECOND_CAMPAIGN_CODE = 'SECOND';

/**
 * The NPC group name below is also referenced from
 * `rollkeeper-dm-data` → `dmDashboardUi.npcCollapsedGroupNames`, which the
 * `campaign_settings` family declares as its one cross-family reference. Keep
 * the two in step so the reference resolves against a real NPC group instead
 * of dangling.
 */
const SEED_NPC_GROUP = 'Seeded villains';

/** A 1x1 transparent PNG, inlined so no seeded record fetches a remote asset. */
const INLINE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

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
 * Six archives, in interleaved key order so the two campaigns alternate:
 *  - combat-log-archive-seed-001 and -002 (campaign MANUAL) share
 *    `encounterId` encounter-seed-001 — two separate, fully ended runs of the
 *    same encounter (Ruling 6: the card must list them as two archives).
 *  - combat-log-archive-seed-101 and -102 belong to campaign SECOND and sit
 *    *between* MANUAL's archives, not after them.
 *  - combat-log-archive-seed-003 is a second, distinct MANUAL encounter.
 *  - combat-log-archive-seed-004 carries no `campaignCode` (an unscoped /
 *    orphan archive), exercising the "not linked to a campaign" path — the
 *    sync card and campaign-scoped manifest both ignore it by design.
 * All six are ended (`endedAt` set): an open archive blocks cutover
 * (`active-combat-log`), which would make the gate's cutover scenarios
 * unreachable.
 *
 * Every `encounterId` below also exists in `rollkeeper-encounter-data`, so the
 * card resolves a real encounter name for every row. The 11F gate recorded all
 * of its rows falling back to "Untitled combat" because the seed carried
 * archives with no encounters to name them.
 */
const combatLogSeedArchives = {
  'combat-log-archive-seed-001': {
    encounterId: 'encounter-seed-001',
    campaignCode: SEED_CAMPAIGN_CODE,
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
  // Campaign SECOND, deliberately between MANUAL's first and second archive.
  'combat-log-archive-seed-101': {
    encounterId: 'encounter-seed-101',
    campaignCode: SEED_SECOND_CAMPAIGN_CODE,
    startedAt: '2000-02-01T00:00:00.000Z',
    endedAt: '2000-02-01T00:20:00.000Z',
    events: [
      {
        id: 'combat-log-archive-seed-101-evt-01',
        type: 'combat_start',
        timestamp: '2000-02-01T00:00:05.000Z',
        round: 1,
        turn: 1,
        encounterId: 'encounter-seed-101',
        participantNames: ['Synthetic Paladin', 'Synthetic Cultist'],
      },
      {
        id: 'combat-log-archive-seed-101-evt-02',
        type: 'damage',
        timestamp: '2000-02-01T00:03:00.000Z',
        round: 1,
        turn: 1,
        encounterId: 'encounter-seed-101',
        sourceId: 'seed-paladin-01',
        sourceName: 'Synthetic Paladin',
        targetId: 'seed-cultist-01',
        targetName: 'Synthetic Cultist',
        amount: 11,
        damageType: 'radiant',
        weaponOrSpellName: 'Divine Smite',
      },
      {
        id: 'combat-log-archive-seed-101-evt-03',
        type: 'combat_end',
        timestamp: '2000-02-01T00:19:00.000Z',
        round: 2,
        turn: 1,
        encounterId: 'encounter-seed-101',
        participantNames: ['Synthetic Paladin', 'Synthetic Cultist'],
        endReason: 'victory',
      },
    ],
  },
  'combat-log-archive-seed-002': {
    encounterId: 'encounter-seed-001',
    campaignCode: SEED_CAMPAIGN_CODE,
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
  'combat-log-archive-seed-102': {
    encounterId: 'encounter-seed-102',
    campaignCode: SEED_SECOND_CAMPAIGN_CODE,
    startedAt: '2000-02-02T00:00:00.000Z',
    endedAt: '2000-02-02T00:15:00.000Z',
    events: [
      {
        id: 'combat-log-archive-seed-102-evt-01',
        type: 'combat_start',
        timestamp: '2000-02-02T00:00:05.000Z',
        round: 1,
        turn: 1,
        encounterId: 'encounter-seed-102',
        participantNames: ['Synthetic Paladin', 'Synthetic Ooze'],
      },
      {
        id: 'combat-log-archive-seed-102-evt-02',
        type: 'damage',
        timestamp: '2000-02-02T00:04:00.000Z',
        round: 1,
        turn: 2,
        encounterId: 'encounter-seed-102',
        sourceId: 'seed-ooze-01',
        sourceName: 'Synthetic Ooze',
        targetId: 'seed-paladin-01',
        targetName: 'Synthetic Paladin',
        amount: 7,
        damageType: 'acid',
      },
      {
        id: 'combat-log-archive-seed-102-evt-03',
        type: 'combat_end',
        timestamp: '2000-02-02T00:14:00.000Z',
        round: 2,
        turn: 2,
        encounterId: 'encounter-seed-102',
        participantNames: ['Synthetic Paladin', 'Synthetic Ooze'],
        endReason: 'victory',
      },
    ],
  },
  'combat-log-archive-seed-003': {
    encounterId: 'encounter-seed-002',
    campaignCode: SEED_CAMPAIGN_CODE,
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

/**
 * Slice 11G `encounter_definition` seed. Every encounter is ended
 * (`isActive: false`, `activeEncounterId: null`): a live encounter raises the
 * `active-encounter` blocker and would make the wizard's cutover scenarios
 * unreachable.
 *
 * Only the nine fields `ENCOUNTER_FAMILY_INVENTORY.documentFields` classifies
 * appear on each record (plus `id` and `campaignCode`, which the manifest
 * strips) — any other field raises `unclassified-field`.
 *
 * Order is interleaved MANUAL / SECOND / MANUAL / SECOND, then the unscoped
 * one. `encounter-seed-003` deliberately carries no `campaignCode`: it names
 * the unscoped combat log archive (the card's name map is global) while the
 * campaign-scoped encounter manifest ignores it, exactly like the archive.
 */
const encounterSeedList = [
  {
    id: 'encounter-seed-001',
    campaignCode: SEED_CAMPAIGN_CODE,
    name: 'Goblin Ambush at the Ford',
    entities: [
      {
        id: 'seed-fighter-01',
        type: 'player',
        name: 'Synthetic Fighter',
        initiative: 17,
        initiativeModifier: 2,
        currentHp: 24,
        maxHp: 32,
        tempHp: 0,
        armorClass: 18,
        conditions: [],
      },
      {
        id: 'seed-goblin-01',
        type: 'monster',
        name: 'Synthetic Goblin',
        initiative: 11,
        initiativeModifier: 2,
        currentHp: 0,
        maxHp: 7,
        tempHp: 0,
        armorClass: 15,
        conditions: [],
      },
    ],
    currentTurn: 0,
    round: 3,
    isActive: false,
    sortOrder: 'initiative',
    createdAt: '2000-01-01T00:00:00.000Z',
    updatedAt: '2000-01-01T00:30:00.000Z',
  },
  {
    id: 'encounter-seed-101',
    campaignCode: SEED_SECOND_CAMPAIGN_CODE,
    name: 'Cultists in the Undercroft',
    entities: [
      {
        id: 'seed-paladin-01',
        type: 'player',
        name: 'Synthetic Paladin',
        initiative: 14,
        initiativeModifier: 1,
        currentHp: 30,
        maxHp: 38,
        tempHp: 0,
        armorClass: 19,
        conditions: [],
      },
      {
        id: 'seed-cultist-01',
        type: 'npc',
        name: 'Synthetic Cultist',
        initiative: 9,
        initiativeModifier: 1,
        currentHp: 0,
        maxHp: 9,
        tempHp: 0,
        armorClass: 12,
        conditions: [],
        npcSourceId: 'npc-seed-201',
      },
    ],
    currentTurn: 0,
    round: 2,
    isActive: false,
    sortOrder: 'initiative',
    createdAt: '2000-02-01T00:00:00.000Z',
    updatedAt: '2000-02-01T00:20:00.000Z',
  },
  {
    id: 'encounter-seed-002',
    campaignCode: SEED_CAMPAIGN_CODE,
    name: 'Wolves on the Ridge',
    entities: [
      {
        id: 'seed-ranger-01',
        type: 'player',
        name: 'Synthetic Ranger',
        initiative: 16,
        initiativeModifier: 3,
        currentHp: 21,
        maxHp: 26,
        tempHp: 0,
        armorClass: 15,
        conditions: [],
      },
      {
        id: 'seed-wolf-01',
        type: 'npc',
        name: 'Synthetic Wolf',
        initiative: 12,
        initiativeModifier: 2,
        currentHp: 0,
        maxHp: 11,
        tempHp: 0,
        armorClass: 13,
        conditions: [],
        npcSourceId: 'npc-seed-002',
      },
    ],
    currentTurn: 1,
    round: 2,
    isActive: false,
    sortOrder: 'initiative',
    createdAt: '2000-01-03T00:00:00.000Z',
    updatedAt: '2000-01-03T00:40:00.000Z',
  },
  {
    id: 'encounter-seed-102',
    campaignCode: SEED_SECOND_CAMPAIGN_CODE,
    name: 'Ooze in the Cistern',
    entities: [
      {
        id: 'seed-ooze-01',
        type: 'monster',
        name: 'Synthetic Ooze',
        initiative: 6,
        initiativeModifier: -1,
        currentHp: 0,
        maxHp: 22,
        tempHp: 0,
        armorClass: 8,
        conditions: [],
      },
    ],
    currentTurn: 0,
    round: 2,
    isActive: false,
    sortOrder: 'manual',
    createdAt: '2000-02-02T00:00:00.000Z',
    updatedAt: '2000-02-02T00:15:00.000Z',
  },
  // Unscoped: names the unscoped archive, belongs to no campaign's manifest.
  {
    id: 'encounter-seed-003',
    name: 'Bandits in the Alley',
    entities: [
      {
        id: 'seed-rogue-01',
        type: 'player',
        name: 'Synthetic Rogue',
        initiative: 19,
        initiativeModifier: 4,
        currentHp: 18,
        maxHp: 22,
        tempHp: 0,
        armorClass: 14,
        conditions: [],
      },
    ],
    currentTurn: 0,
    round: 1,
    isActive: false,
    sortOrder: 'initiative',
    createdAt: '2000-01-04T00:00:00.000Z',
    updatedAt: '2000-01-04T00:10:00.000Z',
  },
];

/**
 * A small but complete `CalendarConfig`: 7 weekdays, 4 months of 30 days,
 * 2 seasons covering all 120 days of the year, 1 moon. The shipped presets are
 * TypeScript and cannot be imported here, and a 12-month preset would triple
 * the seeded bytes for no extra coverage.
 */
function seedCalendarConfig(yearOffset) {
  return {
    clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
    weekDays: [
      { name: 'Sunday' },
      { name: 'Monday' },
      { name: 'Tuesday' },
      { name: 'Wednesday' },
      { name: 'Thursday' },
      { name: 'Friday' },
      { name: 'Saturday' },
    ],
    months: [
      { name: 'Firstmonth', days: 30 },
      { name: 'Secondmonth', days: 30 },
      { name: 'Thirdmonth', days: 30 },
      { name: 'Fourthmonth', days: 30 },
    ],
    seasons: [
      { name: 'Warm', startDay: 0, endDay: 59, sunriseHour: 6, sunsetHour: 20 },
      {
        name: 'Cold',
        startDay: 60,
        endDay: 119,
        sunriseHour: 7,
        sunsetHour: 17,
      },
    ],
    moons: [{ name: 'Seedmoon', color: '#cbd5e1', phaseOffset: 0, period: 30 }],
    namedYears: [],
    eras: [],
    yearOffset,
    yearStartWeekdayOffset: 0,
    weekStartsOn: 0,
    mechanics: {
      hoursPerLongRest: 8,
      minutesPerShortRest: 60,
      secondsPerRound: 6,
    },
  };
}

/**
 * `calendars` is a flat array keyed by `campaignCode`, so the two campaigns'
 * records sit side by side in one envelope. The MANUAL calendar carries the
 * family's one typed cross-family reference — an event pointing at
 * `encounter-seed-001`, which really exists above, so it resolves rather than
 * dangles.
 */
const calendarSeedList = [
  {
    campaignCode: SEED_CAMPAIGN_CODE,
    config: seedCalendarConfig(1490),
    currentTime: 7_776_000_000,
    startTime: 0,
    weather: 'clear',
    events: [
      {
        id: 'evt-seed-001',
        title: 'Ambush at the ford',
        description: '<p>The party is jumped crossing the river.</p>',
        year: 1490,
        month: 2,
        day: 11,
        createdAt: 946_684_800_000,
        emoji: '⚔️',
        visibility: 'private',
        references: [
          { family: 'encounter_definition', legacyId: 'encounter-seed-001' },
        ],
      },
      {
        id: 'evt-seed-002',
        title: 'Harvest fair',
        description: '<p>Open to the whole table.</p>',
        year: 1490,
        month: 3,
        day: 4,
        createdAt: 946_771_200_000,
        color: '#f59e0b',
        visibility: 'public',
      },
    ],
  },
  {
    campaignCode: SEED_SECOND_CAMPAIGN_CODE,
    config: seedCalendarConfig(870),
    currentTime: 2_592_000_000,
    startTime: 0,
    weather: 'rain',
    events: [
      {
        id: 'evt-seed-101',
        title: 'Undercroft rites',
        description: '<p>The cult meets at dusk.</p>',
        year: 870,
        month: 1,
        day: 20,
        createdAt: 949_363_200_000,
        visibility: 'private',
      },
    ],
  },
];

/**
 * `npcsByCampaign` is keyed by campaign, so the two campaigns cannot interleave
 * inside one array the way the encounter and combat log envelopes do; both
 * campaigns' slices simply share the envelope. `npc-seed-001` carries the group
 * named in `campaign_settings`' cross-family reference.
 */
const npcSeedByCampaign = {
  [SEED_CAMPAIGN_CODE]: [
    {
      id: 'npc-seed-001',
      campaignCode: SEED_CAMPAIGN_CODE,
      name: 'Synthetic Goblin Chief',
      description: 'Leads the ford ambush.',
      armorClass: '15 (hide armor, shield)',
      maxHp: 21,
      currentHp: 21,
      tempHp: 0,
      speed: '30 ft.',
      group: SEED_NPC_GROUP,
      tags: ['humanoid', 'seed'],
      xp: 200,
      initiativeModifier: 2,
      proficiencyBonus: 2,
      createdAt: '2000-01-01T00:00:00.000Z',
      updatedAt: '2000-01-01T00:00:00.000Z',
    },
    {
      id: 'npc-seed-002',
      campaignCode: SEED_CAMPAIGN_CODE,
      name: 'Synthetic Wolf',
      armorClass: '13 (natural armor)',
      maxHp: 11,
      currentHp: 11,
      tempHp: 0,
      speed: '40 ft.',
      tags: ['beast'],
      xp: 50,
      initiativeModifier: 2,
      proficiencyBonus: 2,
      createdAt: '2000-01-03T00:00:00.000Z',
      updatedAt: '2000-01-03T00:00:00.000Z',
    },
  ],
  [SEED_SECOND_CAMPAIGN_CODE]: [
    {
      id: 'npc-seed-201',
      campaignCode: SEED_SECOND_CAMPAIGN_CODE,
      name: 'Synthetic Cultist',
      armorClass: '12 (leather armor)',
      maxHp: 9,
      currentHp: 9,
      tempHp: 0,
      speed: '30 ft.',
      tags: ['humanoid'],
      xp: 25,
      initiativeModifier: 1,
      proficiencyBonus: 2,
      createdAt: '2000-02-01T00:00:00.000Z',
      updatedAt: '2000-02-01T00:00:00.000Z',
    },
  ],
};

/**
 * `itemsByCampaign`, like the NPC envelope, is keyed by campaign. Only the
 * fields `MAGIC_ITEM_FAMILY_INVENTORY.documentFields` classifies appear, plus
 * `id` and `campaignCode`; `properties` and `tags` must both be string arrays
 * or the record is rejected as `invalid-item`.
 */
const magicItemSeedByCampaign = {
  [SEED_CAMPAIGN_CODE]: [
    {
      id: 'magic-seed-001',
      campaignCode: SEED_CAMPAIGN_CODE,
      name: 'Synthetic Lantern of Quiet Rooms',
      category: 'wondrous',
      rarity: 'uncommon',
      description: 'Sheds dim light and muffles footsteps within 10 feet.',
      properties: ['Dim light 10 ft.', 'Muffles footsteps'],
      tags: ['utility', 'seed'],
      group: 'Ford hoard',
      requiresAttunement: true,
      isAttuned: false,
      isEquipped: false,
      createdAt: '2000-01-01T00:00:00.000Z',
      updatedAt: '2000-01-01T00:00:00.000Z',
    },
    {
      id: 'magic-seed-002',
      campaignCode: SEED_CAMPAIGN_CODE,
      name: 'Synthetic Whetstone',
      category: 'other',
      rarity: 'common',
      description: 'One use: a weapon deals +1 damage until the next dawn.',
      properties: ['Single use'],
      tags: ['consumable'],
      requiresAttunement: false,
      isAttuned: false,
      createdAt: '2000-01-02T00:00:00.000Z',
      updatedAt: '2000-01-02T00:00:00.000Z',
    },
  ],
  [SEED_SECOND_CAMPAIGN_CODE]: [
    {
      id: 'magic-seed-201',
      campaignCode: SEED_SECOND_CAMPAIGN_CODE,
      name: 'Synthetic Censer of Still Air',
      category: 'wondrous',
      rarity: 'rare',
      description: 'Smoke from this censer never drifts.',
      properties: ['Smoke stays put'],
      tags: ['ritual'],
      requiresAttunement: true,
      isAttuned: true,
      createdAt: '2000-02-01T00:00:00.000Z',
      updatedAt: '2000-02-01T00:00:00.000Z',
    },
  ],
};

/**
 * The two campaigns' `campaign_settings` payloads. `dmDashboardUi`,
 * `playerColors` and `bannerUrl` are the family's private fields;
 * `stackableInspiration`, `customCounterLabel` and `playerCounters` are the
 * ones projected to players. `bannerUrl` is left unset on purpose so no seeded
 * record points at object storage.
 */
const campaignSeedList = [
  {
    code: SEED_CAMPAIGN_CODE,
    name: 'Synthetic Acceptance Campaign',
    createdAt: '2000-01-01T00:00:00.000Z',
    customCounterLabel: 'Rations',
    playerCounters: { 'player-seed-01': 3, 'player-seed-02': 0 },
    playerColors: { 'character-seed-01': '#3b82f6' },
    stackableInspiration: false,
    dmDashboardUi: {
      playersSectionOpen: true,
      houseRulesSectionOpen: false,
      npcSectionOpen: true,
      magicItemLibrarySectionOpen: false,
      npcCollapsedGroupNames: [SEED_NPC_GROUP],
      npcInlineSpellSlots: false,
      npcSeparateSpellSlotTracker: true,
    },
  },
  {
    code: SEED_SECOND_CAMPAIGN_CODE,
    name: 'Synthetic Interleave Campaign',
    createdAt: '2000-02-01T00:00:00.000Z',
    customCounterLabel: 'Torches',
    playerCounters: { 'player-seed-03': 1 },
    stackableInspiration: true,
    dmDashboardUi: { playersSectionOpen: false },
  },
];

/**
 * Keys no registered 11G family owns. They must come back **byte-identical**
 * after every migration, rollback and reload, so at least one carries a real
 * payload — an empty container would witness nothing.
 *
 * - `rollkeeper-location-data` belongs to Locations, which the wizard lists as
 *   not yet available. Its store declares no `version` and no `migrate`, so
 *   hydration never rewrites it, and the seeded map image is an inline data
 *   URI so nothing fetches a remote asset.
 * - `rollkeeper-manual-acceptance-sentinel` is owned by no store at all, which
 *   makes it the cleanest witness of a stray broad write.
 */
const UNRELATED_LOCAL_STORAGE_KEYS = [
  'rollkeeper-location-data',
  'rollkeeper-battlemap-data',
  'rollkeeper-manual-acceptance-sentinel',
];

const locationSeed = {
  [SEED_CAMPAIGN_CODE]: {
    'location-seed-001': {
      id: 'location-seed-001',
      campaignCode: SEED_CAMPAIGN_CODE,
      name: 'Synthetic Ford Crossing',
      mapImageUrl: INLINE_PNG,
      mapImageSize: { w: 1, h: 1 },
      canvasState: '{"version":"seed","objects":[]}',
      dmOnlyElements: {},
      gridEnabled: true,
      createdAt: '2000-01-01T00:00:00.000Z',
      updatedAt: '2000-01-01T00:00:00.000Z',
    },
  },
};

export function buildFakeSeedBundle() {
  const localStorageEntries = {
    'rollkeeper-dm-data': persisted(
      { dmId: 'dm-manual-browser', campaigns: campaignSeedList },
      1
    ),
    'rollkeeper-encounter-data': persisted(
      {
        encounters: encounterSeedList,
        activeEncounterId: null,
        encounterTombstones: {},
        acceptanceSentinel: SENTINEL,
      },
      2
    ),
    'rollkeeper-npc-data': persisted(
      { npcsByCampaign: npcSeedByCampaign, acceptanceSentinel: SENTINEL },
      4
    ),
    'rollkeeper-calendar-data': persisted(
      { calendars: calendarSeedList, acceptanceSentinel: SENTINEL },
      3
    ),
    'rollkeeper-location-data': persisted({ locations: locationSeed }, 0),
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
      {
        itemsByCampaign: magicItemSeedByCampaign,
        acceptanceSentinel: SENTINEL,
      },
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
  const manifestSha256 = createHash('sha256')
    .update(manifestInput, 'utf8')
    .digest('hex');

  return {
    format: 'rollkeeper-manual-browser-seed',
    seedVersion: SEED_VERSION,
    characterDraft: {
      name: 'Mira Vale — Synthetic Acceptance',
      creationRoute: '/player/characters/new',
    },
    /** Campaign A first, then the campaign whose records interleave with it. */
    campaignCodes: [SEED_CAMPAIGN_CODE, SEED_SECOND_CAMPAIGN_CODE],
    /**
     * One `localStorage` key per registered durable DM family, so a single
     * profile carries legacy data for all six at once.
     */
    familyLocalStorageKeys: {
      campaign_settings: 'rollkeeper-dm-data',
      calendar: 'rollkeeper-calendar-data',
      magic_item: 'rollkeeper-dm-magic-item-library',
      npc: 'rollkeeper-npc-data',
      encounter_definition: 'rollkeeper-encounter-data',
      combat_log_archive: 'rollkeeper-combat-log',
    },
    unrelatedLocalStorageKeys: UNRELATED_LOCAL_STORAGE_KEYS,
    localStorageEntries,
    manifest: {
      entryCount: entries.length,
      totalUtf8Bytes: entries.reduce((sum, entry) => sum + entry.utf8Bytes, 0),
      sha256: manifestSha256,
      sha256Prefix: manifestSha256.slice(0, 12),
      entries: entries.map(({ key, utf8Bytes, sha256 }) => ({
        key,
        utf8Bytes,
        sha256,
      })),
    },
  };
}

/**
 * The three numbers the gate quotes, plus a per-entry line, in a shape that
 * diffs cleanly between two runs. Every value is derived from literals in this
 * file, so two runs on any machine print byte-identical output.
 */
function printManifestReport(bundle) {
  const { manifest } = bundle;
  const lines = [
    `seedVersion ${bundle.seedVersion}`,
    `entryCount ${manifest.entryCount}`,
    `totalUtf8Bytes ${manifest.totalUtf8Bytes}`,
    `manifestSha256Prefix ${manifest.sha256Prefix}`,
    `campaignCodes ${bundle.campaignCodes.join(',')}`,
  ];
  const familyOf = new Map(
    Object.entries(bundle.familyLocalStorageKeys).map(([family, key]) => [
      key,
      family,
    ])
  );
  const unrelated = new Set(bundle.unrelatedLocalStorageKeys);
  for (const entry of manifest.entries) {
    const role =
      familyOf.get(entry.key) ?? (unrelated.has(entry.key) ? 'unrelated' : '-');
    lines.push(
      `entry ${entry.key} ${entry.utf8Bytes} ${entry.sha256.slice(0, 12)} ${role}`
    );
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}

function printBundle() {
  const bundle = buildFakeSeedBundle();
  if (process.argv.includes('--manifest')) {
    printManifestReport(bundle);
    return;
  }
  const summaryOnly = process.argv.includes('--summary');
  process.stdout.write(
    `${JSON.stringify(
      summaryOnly
        ? {
            format: bundle.format,
            seedVersion: bundle.seedVersion,
            characterDraft: bundle.characterDraft,
            campaignCodes: bundle.campaignCodes,
            familyLocalStorageKeys: bundle.familyLocalStorageKeys,
            unrelatedLocalStorageKeys: bundle.unrelatedLocalStorageKeys,
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
