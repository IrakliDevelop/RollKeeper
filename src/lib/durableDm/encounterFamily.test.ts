import { describe, expect, it } from 'vitest';

import { sha256Bytes } from '@/lib/indexeddb/migrationCapture';
import type {
  Encounter,
  EncounterEntity,
  MonsterStatBlock,
} from '@/types/encounter';

import {
  buildEncounterManifest,
  buildEncounterWorkingCopyManifest,
  encounterFromPayload,
  encounterPayloadFromEncounter,
  ENCOUNTER_FAMILY_INVENTORY,
  ENCOUNTER_MAX_ITEMS,
  ENCOUNTER_MAX_RECORD_BYTES,
  ENCOUNTER_MAX_TOTAL_BYTES,
  ENCOUNTER_PERSIST_VERSION,
  fingerprintEncounterPayload,
  fingerprintEncounterTombstone,
  registeredDurableDmFamilies,
  sortEncounters,
  validateEncounterPayload,
} from './encounterFamily';

const npcEntity: EncounterEntity = {
  id: 'ent-npc-1',
  type: 'npc',
  name: 'Cultist',
  initiative: 10,
  initiativeModifier: 1,
  currentHp: 30,
  maxHp: 30,
  tempHp: 0,
  armorClass: 14,
  conditions: [],
  npcSourceId: 'npc-9',
  abilities: [
    {
      id: 'ab-1',
      name: 'Dark Devotion',
      description: 'Advantage against charm.',
      usageType: 'unlimited',
      usedUses: 0,
    },
  ],
  resources: [
    {
      id: 'res-1',
      name: 'Channel Divinity',
      icon: 'sun',
      color: 'amber',
      displayStyle: 'pips',
      maxUses: 2,
      usesExpended: 0,
      shortRestReset: 'all',
    },
  ],
  legendaryActions: {
    maxActions: 3,
    usedActions: 0,
    actions: [{ id: 'leg-1', name: 'Attack', cost: 1, description: 'Bite.' }],
  },
  lairActions: [
    {
      id: 'lair-1',
      name: 'Tremor',
      description: 'The ground shakes.',
      usedThisRound: false,
    },
  ],
  monsterStatBlock: {
    str: 11,
    dex: 14,
    con: 12,
    int: 10,
    wis: 13,
    cha: 14,
    saves: 'Wis +3',
    skills: 'Deception +4',
    speed: '30 ft.',
    resistances: '',
    immunities: '',
    vulnerabilities: '',
    conditionImmunities: [],
    senses: 'passive Perception 11',
    passivePerception: 11,
    traits: [
      {
        id: 'entry-t1',
        name: 'Dark Devotion',
        text: 'Advantage against charm.',
      },
    ],
    actions: [{ id: 'entry-a1', name: 'Dagger', text: 'Melee weapon attack.' }],
    reactions: [{ id: 'entry-r1', name: 'Parry', text: 'Add 2 to AC.' }],
    bonusActions: [{ id: 'entry-b1', name: 'Shove', text: 'Push a creature.' }],
    lairActions: [
      { id: 'entry-l1', name: 'Whispers', text: 'The lair speaks.' },
    ],
    cr: '2',
    type: 'humanoid',
    size: 'Medium',
    languages: 'Common',
    alignment: 'neutral evil',
    hpFormula: '6d8 + 6',
  } satisfies MonsterStatBlock,
};

const playerEntity: EncounterEntity = {
  id: 'ent-player-1',
  type: 'player',
  name: 'Aria',
  initiative: 15,
  initiativeModifier: 2,
  currentHp: 20,
  maxHp: 25,
  tempHp: 0,
  armorClass: 16,
  conditions: [{ id: 'cond-1', name: 'Prone', source: 'player-sync' }],
  deathSaves: { successes: 0, failures: 0, isStabilized: false },
  playerCharacterId: 'char-1',
};

const baseEncounterA: Encounter = {
  id: 'enc-a',
  name: 'Ambush',
  campaignCode: 'ABC123',
  entities: [playerEntity, npcEntity],
  currentTurn: 0,
  round: 1,
  isActive: false,
  sortOrder: 'initiative',
  pendingInitiativeRequest: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const baseEncounterBMinimal: Encounter = {
  id: 'enc-b',
  name: 'Skirmish',
  campaignCode: 'ABC123',
  entities: [],
  currentTurn: 0,
  round: 1,
  isActive: false,
  sortOrder: 'manual',
  createdAt: '2026-01-03T00:00:00.000Z',
  updatedAt: '2026-01-03T00:00:00.000Z',
};

const encounterA = (overrides: Record<string, unknown> = {}): Encounter =>
  ({ ...structuredClone(baseEncounterA), ...overrides }) as Encounter;

const encounterB = (overrides: Record<string, unknown> = {}): Encounter =>
  ({ ...structuredClone(baseEncounterBMinimal), ...overrides }) as Encounter;

const otherCampaignEncounter: Encounter = {
  id: 'enc-other',
  name: 'Other Camp',
  campaignCode: 'OTHER1',
  entities: [],
  currentTurn: 0,
  round: 1,
  isActive: false,
  sortOrder: 'manual',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const unscopedEncounter: Record<string, unknown> = {
  id: 'enc-unscoped',
  name: 'Unscoped',
  entities: [],
  currentTurn: 0,
  round: 1,
  isActive: false,
  sortOrder: 'manual',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const deletedTombstone = {
  id: 'enc-deleted',
  deletedAt: '2026-01-05T00:00:00.000Z',
  beforeImage: {
    id: 'enc-deleted',
    name: 'Deleted',
    campaignCode: 'ABC123',
    entities: [],
    currentTurn: 0,
    round: 1,
    isActive: false,
    sortOrder: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

const otherCampaignTombstone = {
  id: 'enc-other-deleted',
  deletedAt: '2026-01-05T00:00:00.000Z',
  beforeImage: {
    id: 'enc-other-deleted',
    name: 'OtherDeleted',
    campaignCode: 'OTHER1',
    entities: [],
    currentTurn: 0,
    round: 1,
    isActive: false,
    sortOrder: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

const envelope = (
  encounters: unknown[],
  tombstones: Record<string, unknown> = {},
  version = 2
) =>
  JSON.stringify({
    state: {
      encounters,
      encounterTombstones: tombstones,
      combatConfig: {
        enemyHpDisplay: 'bar',
        hpStateBands: [],
        enemyConditionsDisplay: 'on',
      },
      activeEncounterId: 'enc-a',
    },
    version,
  });

const build = (
  encounters: unknown[],
  tombstones: Record<string, unknown> = {},
  version = 2
) =>
  buildEncounterManifest({
    campaignCode: 'ABC123',
    rawEnvelope: envelope(encounters, tombstones, version),
  });

const kinds = (manifest: { blockers: Array<{ kind: string }> }) =>
  manifest.blockers.map(blocker => blocker.kind);

describe('Slice 11E encounter family', () => {
  it('registers the five families and inventory constants', () => {
    expect(registeredDurableDmFamilies).toEqual([
      'campaign_settings',
      'calendar',
      'magic_item',
      'npc',
      'encounter_definition',
    ]);
    expect(ENCOUNTER_PERSIST_VERSION).toBe(2);
    expect(ENCOUNTER_MAX_RECORD_BYTES).toBe(262_144);
    expect(ENCOUNTER_MAX_ITEMS).toBe(2_000);
    expect(ENCOUNTER_MAX_TOTAL_BYTES).toBe(5_242_880);
    expect(ENCOUNTER_FAMILY_INVENTORY).toMatchObject({
      family: 'encounter_definition',
      localStorageKeys: ['rollkeeper-encounter-data'],
      persistenceVersions: { 'rollkeeper-encounter-data': 2 },
      projection: 'not-applicable',
      typedCrossFamilyReferences: [],
      excludedEnvelopeFields: ['combatConfig', 'activeEncounterId'],
      excludedFamilies: expect.arrayContaining([
        'npc',
        'magic_item',
        'combat_log_archive',
        'battle_map',
      ]),
    });
    expect(ENCOUNTER_FAMILY_INVENTORY.excludedFamilies).not.toContain(
      'encounter_definition'
    );
  });

  it('captures the campaign slice as sorted records, ignoring unscoped and other-campaign data', async () => {
    const manifest = await build(
      [encounterA(), encounterB(), otherCampaignEncounter, unscopedEncounter],
      {
        [deletedTombstone.id]: deletedTombstone,
        [otherCampaignTombstone.id]: otherCampaignTombstone,
      }
    );

    expect(manifest.blockers).toEqual([]);
    expect(manifest.format).toBe('rollkeeper-encounter-manifest');
    expect(manifest.version).toBe(1);
    expect(manifest.family).toBe('encounter_definition');
    expect(manifest.campaignCode).toBe('ABC123');
    expect(manifest.recordCount).toBe(3);
    expect(manifest.records.map(entry => entry.legacyId)).toEqual([
      'enc-a',
      'enc-b',
      'enc-deleted',
    ]);
    expect(manifest.records[0].payload).not.toHaveProperty('id');
    expect(manifest.records[0].payload).not.toHaveProperty('campaignCode');
    expect(manifest.records[0].payload).toMatchObject({
      name: 'Ambush',
      entities: [
        expect.objectContaining({ id: 'ent-player-1', type: 'player' }),
        expect.objectContaining({
          id: 'ent-npc-1',
          npcSourceId: 'npc-9',
          abilities: [expect.objectContaining({ id: 'ab-1' })],
          resources: [expect.objectContaining({ id: 'res-1' })],
          legendaryActions: expect.objectContaining({
            actions: [expect.objectContaining({ id: 'leg-1' })],
          }),
          lairActions: [expect.objectContaining({ id: 'lair-1' })],
          monsterStatBlock: expect.objectContaining({
            traits: [expect.objectContaining({ id: 'entry-t1' })],
            actions: [expect.objectContaining({ id: 'entry-a1' })],
            reactions: [expect.objectContaining({ id: 'entry-r1' })],
            bonusActions: [expect.objectContaining({ id: 'entry-b1' })],
            lairActions: [expect.objectContaining({ id: 'entry-l1' })],
          }),
        }),
      ],
    });
    const tombstoneRecord = manifest.records[2];
    expect(tombstoneRecord.tombstoned).toBe(true);
    expect(tombstoneRecord.payload).toBeNull();
    expect(tombstoneRecord.payloadFingerprint).toBe(
      await fingerprintEncounterTombstone('enc-deleted')
    );
    expect(manifest.records[0].payloadFingerprint).toBe(
      await fingerprintEncounterPayload(manifest.records[0].payload!)
    );
    expect(manifest.totalBytes).toBe(
      manifest.records.reduce((total, entry) => total + entry.byteCount, 0)
    );
    expect(manifest.rawCandidates).toHaveLength(1);
    expect(manifest.rawCandidates[0].sourceKey).toBe(
      'rollkeeper-encounter-data'
    );
  });

  it('fingerprints deterministically and changes when an entity changes', async () => {
    const first = await build([encounterA(), encounterB()]);
    const second = await build([encounterA(), encounterB()]);
    const changedEntities = [
      { ...playerEntity },
      { ...npcEntity, currentHp: 5 },
    ];
    const changed = await build([
      encounterA({ entities: changedEntities }),
      encounterB(),
    ]);

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(changed.fingerprint).not.toBe(first.fingerprint);
  });

  it('treats an absent campaign as valid with zero records', async () => {
    const manifest = await buildEncounterManifest({
      campaignCode: 'ZZZ999',
      rawEnvelope: envelope([encounterA(), encounterB()]),
    });

    expect(manifest.records).toEqual([]);
    expect(manifest.blockers).toEqual([]);
    expect(manifest.recordCount).toBe(0);
    expect(manifest.totalBytes).toBe(0);
  });

  it('blocks an envelope that has never been persisted', async () => {
    const manifest = await buildEncounterManifest({
      campaignCode: 'ABC123',
      rawEnvelope: '',
    });

    expect(kinds(manifest)).toEqual(['incomplete-envelope']);
    expect(manifest.blockers[0].detail).toBe(
      'rollkeeper-encounter-data has never been persisted on this device'
    );
    expect(manifest.blockers[0].legacyId).toBeNull();
  });

  it('blocks malformed JSON and incomplete envelopes', async () => {
    const malformed = await buildEncounterManifest({
      campaignCode: 'ABC123',
      rawEnvelope: '{not json',
    });
    const incomplete = await buildEncounterManifest({
      campaignCode: 'ABC123',
      rawEnvelope: JSON.stringify({ state: {} }),
    });
    const notAnArray = await buildEncounterManifest({
      campaignCode: 'ABC123',
      rawEnvelope: JSON.stringify({
        state: { encounters: 'nope' },
        version: 2,
      }),
    });
    const badTombstones = await buildEncounterManifest({
      campaignCode: 'ABC123',
      rawEnvelope: JSON.stringify({
        state: { encounters: [], encounterTombstones: 'nope' },
        version: 2,
      }),
    });

    expect(kinds(malformed)).toEqual(['malformed-json']);
    expect(kinds(incomplete)).toEqual(['incomplete-envelope']);
    expect(kinds(notAnArray)).toEqual(['incomplete-envelope']);
    expect(notAnArray.records).toEqual([]);
    expect(kinds(badTombstones)).toEqual(['incomplete-envelope']);
  });

  it('blocks future and legacy persistence versions', async () => {
    const future = await build([encounterA()], {}, 3);
    const legacy = await build([encounterA()], {}, 1);
    const missing = await buildEncounterManifest({
      campaignCode: 'ABC123',
      rawEnvelope: JSON.stringify({ state: { encounters: [encounterA()] } }),
    });

    expect(kinds(future)).toEqual(['future-schema']);
    expect(future.blockers[0].detail).toContain('3');
    expect(future.records).toEqual([]);
    expect(kinds(legacy)).toEqual(['legacy-schema']);
    expect(legacy.blockers[0].detail).toBe(
      'rollkeeper-encounter-data is persisted at version 1; the encounter store migration must upgrade it to version 2 before preview'
    );
    expect(legacy.records).toEqual([]);
    expect(kinds(missing)).toEqual(['legacy-schema']);
    expect(missing.records).toEqual([]);
  });

  it('quarantines duplicate and unidentified encounters', async () => {
    const duplicate = await build([encounterA(), encounterA({ name: 'Copy' })]);
    const unidentified = await build([encounterA({ id: undefined })]);

    expect(kinds(duplicate)).toEqual(['duplicate-id']);
    expect(duplicate.records).toHaveLength(1);
    expect(kinds(unidentified)).toEqual(['invalid-encounter-id']);
    expect(unidentified.blockers[0].legacyId).toBeNull();
    expect(unidentified.records).toEqual([]);
  });

  it('flags an id shared across two different campaigns as id-mismatch', async () => {
    const sharedId = 'enc-shared';
    const manifest = await build([
      encounterA({ id: sharedId }),
      { ...otherCampaignEncounter, id: sharedId },
    ]);

    expect(kinds(manifest)).toEqual(['id-mismatch']);
    expect(manifest.blockers[0].legacyId).toBe(sharedId);
    expect(manifest.records).toEqual([]);
  });

  it('quarantines unclassified fields and invalid encounter shapes', async () => {
    const unclassified = await build([
      encounterA({ secretPlan: 'burn the town' }),
    ]);
    expect(kinds(unclassified)).toEqual(['unclassified-field']);
    expect(unclassified.blockers[0].detail).toContain('secretPlan');
    expect(unclassified.blockers[0].legacyId).toBe('enc-a');
    expect(unclassified.records).toEqual([]);

    const invalidCases: Array<Record<string, unknown>> = [
      { name: '' },
      { round: '1' },
      { sortOrder: 'random' },
      { isActive: 'yes' },
      { entities: {} },
      { pendingInitiativeRequest: { requestId: '', requestedAt: 1 } },
    ];
    for (const overrides of invalidCases) {
      const manifest = await build([encounterA(overrides)]);
      expect(kinds(manifest)).toEqual(['invalid-encounter']);
      expect(manifest.records).toEqual([]);
    }
  });

  it('accepts an absent or null pendingInitiativeRequest', async () => {
    const nullRequest = await build([
      encounterA({ pendingInitiativeRequest: null }),
    ]);
    const { pendingInitiativeRequest: omittedRequest, ...withoutPending } =
      encounterA();
    void omittedRequest;
    const absentRequest = await build([withoutPending]);

    expect(nullRequest.blockers).toEqual([]);
    expect(absentRequest.blockers).toEqual([]);
  });

  it('quarantines duplicate and invalid child identities', async () => {
    const duplicateEntities = await build([
      encounterA({
        entities: [
          { ...playerEntity, id: 'same' },
          { ...npcEntity, id: 'same' },
        ],
      }),
    ]);
    const invalidCondition = await build([
      encounterA({
        entities: [
          { ...playerEntity, conditions: [{ id: '', name: 'Prone' }] },
        ],
      }),
    ]);

    expect(kinds(duplicateEntities)).toEqual(['duplicate-child-id']);
    expect(kinds(invalidCondition)).toEqual(['invalid-child-id']);
  });

  it('reports active-encounter but still emits the record', async () => {
    const manifest = await build([encounterA({ isActive: true })]);

    expect(kinds(manifest)).toEqual(['active-encounter']);
    expect(manifest.blockers[0].legacyId).toBe('enc-a');
    expect(manifest.blockers[0].detail).toBe(
      'Encounter "Ambush" is in active combat; end combat before cutover'
    );
    expect(manifest.records).toHaveLength(1);
    expect(manifest.records[0].payload).toMatchObject({ isActive: true });
  });

  it('quarantines invalid tombstones and flags a tombstone that is also live', async () => {
    const invalidTombstone = await build([], {
      'enc-x': { id: 'enc-x', deletedAt: '2026-01-01T00:00:00.000Z' },
    });
    const tombstonedAndLive = await build([encounterA()], {
      [encounterA().id]: {
        id: 'enc-a',
        deletedAt: '2026-01-01T00:00:00.000Z',
        beforeImage: { ...encounterA(), campaignCode: 'ABC123' },
      },
    });

    expect(kinds(invalidTombstone)).toEqual(['invalid-tombstone']);
    expect(invalidTombstone.blockers[0].legacyId).toBe('enc-x');
    expect(kinds(tombstonedAndLive)).toEqual(['tombstoned-and-live']);
  });

  it('reports oversized records and oversized families', async () => {
    const oversizedEntities = [{ ...playerEntity, name: 'x'.repeat(300_000) }];
    const oversizedRecord = await build([
      encounterA({ entities: oversizedEntities }),
    ]);
    const tooManyEncounters = await build(
      Array.from({ length: ENCOUNTER_MAX_ITEMS + 1 }, (_unused, index) =>
        encounterB({ id: `enc-${index}` })
      )
    );

    expect(kinds(oversizedRecord)).toEqual(['oversized-record']);
    expect(oversizedRecord.records).toHaveLength(1);
    expect(oversizedRecord.records[0].byteCount).toBeGreaterThan(
      ENCOUNTER_MAX_RECORD_BYTES
    );
    expect(kinds(tooManyEncounters)).toEqual(['oversized-family']);
    expect(tooManyEncounters.blockers[0].legacyId).toBeNull();
    expect(tooManyEncounters.recordCount).toBe(ENCOUNTER_MAX_ITEMS + 1);
  });

  it('round-trips payloads to and from encounters', () => {
    const source = encounterA();
    const payload = encounterPayloadFromEncounter(source);

    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('campaignCode');
    expect(encounterFromPayload('ABC123', 'enc-a', payload)).toEqual(source);
  });

  it('sorts encounters by creation time and then by id', () => {
    const unsorted = [
      { id: 'b', createdAt: '2026-01-02T00:00:00.000Z' },
      { id: 'c', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'a', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    expect(sortEncounters(unsorted).map(entry => entry.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
    expect(unsorted[0].id).toBe('b');
  });

  it('fingerprints tombstones over the canonical tombstone document', async () => {
    expect(await fingerprintEncounterTombstone('enc-1')).toBe(
      await sha256Bytes('{"legacyId":"enc-1","tombstoned":true}')
    );
  });

  it('builds a working copy manifest with tombstoned documents', async () => {
    const source = await build([encounterA(), encounterB()]);
    const payload = encounterPayloadFromEncounter(
      encounterA({ name: 'Ambush Renewed' })
    );
    const working = await buildEncounterWorkingCopyManifest({
      source,
      documents: [
        { legacyId: 'enc-a', payload, schemaVersion: 2, tombstoned: false },
        {
          legacyId: 'enc-b',
          payload: null,
          schemaVersion: 2,
          tombstoned: true,
        },
      ],
    });

    expect(working.blockers).toEqual([]);
    expect(working.recordCount).toBe(2);
    expect(working.records[0]).toMatchObject({
      legacyId: 'enc-a',
      tombstoned: false,
    });
    expect(working.records[0].payload).toMatchObject({
      name: 'Ambush Renewed',
    });
    expect(working.records[1]).toMatchObject({
      legacyId: 'enc-b',
      tombstoned: true,
      payload: null,
    });
    expect(working.records[1].payloadFingerprint).toBe(
      await fingerprintEncounterTombstone('enc-b')
    );
    expect(working.rawCandidates).toEqual(source.rawCandidates);
    expect(working.fingerprint).not.toBe(source.fingerprint);
  });

  it('refuses working copies built from unvalidated sources or documents', async () => {
    const blocked = await buildEncounterManifest({
      campaignCode: 'ABC123',
      rawEnvelope: '',
    });
    const source = await build([encounterA()]);
    const payload = encounterPayloadFromEncounter(encounterA());

    await expect(
      buildEncounterWorkingCopyManifest({
        source: blocked,
        documents: [
          { legacyId: 'enc-a', payload, schemaVersion: 2, tombstoned: false },
        ],
      })
    ).rejects.toThrow('A validated encounter source manifest is required');

    await expect(
      buildEncounterWorkingCopyManifest({
        source,
        documents: [
          { legacyId: 'enc-a', payload, schemaVersion: 1, tombstoned: false },
        ],
      })
    ).rejects.toThrow('schema version 2');

    await expect(
      buildEncounterWorkingCopyManifest({
        source,
        documents: [
          {
            legacyId: 'enc-a',
            payload: { ...payload, name: '' },
            schemaVersion: 2,
            tombstoned: false,
          },
        ],
      })
    ).rejects.toThrow('enc-a');
  });

  const payloadWith = (overrides: Record<string, unknown>) => ({
    ...encounterPayloadFromEncounter(encounterA()),
    ...overrides,
  });

  const invalidEncounterCases: Array<[string, Record<string, unknown>]> = [
    ['a name over 1000 characters', { name: 'x'.repeat(1001) }],
    ['a non-string name', { name: 42 }],
    ['an absent name', { name: undefined }],
    ['a non-finite currentTurn', { currentTurn: Number.NaN }],
    ['a string currentTurn', { currentTurn: '0' }],
    ['a non-finite round', { round: Number.POSITIVE_INFINITY }],
    ['a string round', { round: '1' }],
    ['a non-boolean isActive', { isActive: 'yes' }],
    ['an invalid sortOrder', { sortOrder: 'random' }],
    ['a non-string createdAt', { createdAt: 1_700_000_000 }],
    ['a non-string updatedAt', { updatedAt: [] }],
    ['entities that are not an array', { entities: {} }],
    [
      'a pendingInitiativeRequest missing requestId',
      { pendingInitiativeRequest: { requestedAt: 1 } },
    ],
    [
      'a pendingInitiativeRequest with an empty requestId',
      { pendingInitiativeRequest: { requestId: '', requestedAt: 1 } },
    ],
    [
      'a pendingInitiativeRequest with a non-numeric requestedAt',
      { pendingInitiativeRequest: { requestId: 'r1', requestedAt: '1' } },
    ],
  ];

  it.each(invalidEncounterCases)(
    'rejects %s as an invalid encounter',
    (_label, overrides) => {
      expect(validateEncounterPayload(payloadWith(overrides))).toMatchObject({
        ok: false,
        kind: 'invalid-encounter',
      });
    }
  );

  const invalidChildCases: Array<[string, Record<string, unknown>, string]> = [
    [
      'an entity without an id',
      { entities: [{ name: 'Nameless' }] },
      'invalid-child-id',
    ],
    [
      'repeated entity ids',
      {
        entities: [
          { ...playerEntity, id: 'dup' },
          { ...npcEntity, id: 'dup' },
        ],
      },
      'duplicate-child-id',
    ],
    [
      'a condition without an id',
      { entities: [{ ...playerEntity, conditions: [{ name: 'Prone' }] }] },
      'invalid-child-id',
    ],
    [
      'repeated ability ids',
      {
        entities: [
          {
            ...npcEntity,
            abilities: [
              { ...npcEntity.abilities![0], id: 'ab-x' },
              { ...npcEntity.abilities![0], id: 'ab-x' },
            ],
          },
        ],
      },
      'duplicate-child-id',
    ],
    [
      'repeated resource ids',
      {
        entities: [
          {
            ...npcEntity,
            resources: [
              { ...npcEntity.resources![0], id: 'res-x' },
              { ...npcEntity.resources![0], id: 'res-x' },
            ],
          },
        ],
      },
      'duplicate-child-id',
    ],
    [
      'repeated legendary action ids',
      {
        entities: [
          {
            ...npcEntity,
            legendaryActions: {
              maxActions: 3,
              usedActions: 0,
              actions: [
                { id: 'leg-x', name: 'A', cost: 1, description: 'd' },
                { id: 'leg-x', name: 'B', cost: 1, description: 'd' },
              ],
            },
          },
        ],
      },
      'duplicate-child-id',
    ],
    [
      'repeated lair action ids',
      {
        entities: [
          {
            ...npcEntity,
            lairActions: [
              {
                id: 'lair-x',
                name: 'A',
                description: 'd',
                usedThisRound: false,
              },
              {
                id: 'lair-x',
                name: 'B',
                description: 'd',
                usedThisRound: false,
              },
            ],
          },
        ],
      },
      'duplicate-child-id',
    ],
    [
      'a stat block trait entry id that is not a string',
      {
        entities: [
          {
            ...npcEntity,
            monsterStatBlock: {
              ...npcEntity.monsterStatBlock,
              traits: [{ id: 9, name: 'x', text: 'y' }],
            },
          },
        ],
      },
      'invalid-child-id',
    ],
    [
      'repeated stat block action entry ids',
      {
        entities: [
          {
            ...npcEntity,
            monsterStatBlock: {
              ...npcEntity.monsterStatBlock,
              actions: [
                { id: 'dup-entry', name: 'A', text: 'x' },
                { id: 'dup-entry', name: 'B', text: 'y' },
              ],
            },
          },
        ],
      },
      'duplicate-child-id',
    ],
  ];

  it.each(invalidChildCases)('rejects %s', (_label, overrides, kind) => {
    expect(validateEncounterPayload(payloadWith(overrides))).toMatchObject({
      ok: false,
      kind,
    });
  });

  const acceptedCases: Array<[string, Record<string, unknown>]> = [
    ['a null pendingInitiativeRequest', { pendingInitiativeRequest: null }],
    ['an empty entities array', { entities: [] }],
    [
      'stat block entries without ids',
      {
        entities: [
          {
            ...npcEntity,
            monsterStatBlock: {
              ...npcEntity.monsterStatBlock,
              traits: [{ name: 'No id', text: 'x' }],
            },
          },
        ],
      },
    ],
    ['a boundary-length name', { name: 'n'.repeat(1000) }],
  ];

  it.each(acceptedCases)('accepts %s', (_label, overrides) => {
    expect(validateEncounterPayload(payloadWith(overrides))).toMatchObject({
      ok: true,
    });
  });

  it('sorts blockers deterministically by canonical JSON', async () => {
    const manifest = await build([
      encounterA({ secretPlan: 'hidden' }),
      encounterA(),
    ]);

    expect(kinds(manifest)).toEqual(['duplicate-id', 'unclassified-field']);
    const details = manifest.blockers.map(blocker => blocker.detail);
    expect(details).toEqual([...details].sort());
  });
});
