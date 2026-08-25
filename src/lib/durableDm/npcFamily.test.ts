import { describe, expect, it } from 'vitest';

import { sha256Bytes } from '@/lib/indexeddb/migrationCapture';
import type { MagicItem, Spell } from '@/types/character';
import type { CampaignNPC } from '@/types/encounter';

import {
  buildNpcManifest,
  buildNpcWorkingCopyManifest,
  campaignNpcFromPayload,
  fingerprintNpcPayload,
  fingerprintNpcTombstone,
  NPC_FAMILY_INVENTORY,
  NPC_MAX_ITEMS,
  NPC_MAX_RECORD_BYTES,
  NPC_MAX_TOTAL_BYTES,
  NPC_PERSIST_VERSION,
  NPC_STORAGE_KEY,
  npcPayloadFromCampaignNpc,
  registeredDurableDmFamilies,
  sortNpcs,
  validateNpcPayload,
} from './npcFamily';

const carriedMagicItem: MagicItem = {
  id: 'magic-1',
  name: 'Dagger of Venom',
  category: 'other',
  rarity: 'rare',
  description: 'A blackened blade that weeps poison.',
  properties: ['Finesse'],
  requiresAttunement: true,
  isAttuned: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const preparedSpell: Spell = {
  id: 'spell-1',
  name: 'Fire Bolt',
  level: 0,
  school: 'Evocation',
  castingTime: '1 action',
  range: '120 feet',
  components: { verbal: true, somatic: true, material: false },
  duration: 'Instantaneous',
  description: 'You hurl a mote of fire.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const baseNpc: CampaignNPC = {
  id: 'npc-1',
  campaignCode: 'ABC123',
  name: 'Cult Fanatic',
  description: 'A zealous leader of the coven.',
  armorClass: '16 (natural armor)',
  maxHp: 33,
  currentHp: 22,
  tempHp: 4,
  tempAc: '2 (shield spell)',
  speed: '30 ft.',
  monsterStatBlock: {
    str: 11,
    dex: 14,
    con: 12,
    int: 10,
    wis: 13,
    cha: 14,
    saves: 'Wis +3',
    saveProficiencies: ['wis'],
    skills: 'Deception +4, Persuasion +4',
    speed: '30 ft.',
    resistances: '',
    immunities: '',
    vulnerabilities: '',
    conditionImmunities: [],
    senses: 'passive Perception 11',
    passivePerception: 11,
    traits: [
      {
        id: 'entry-1',
        name: 'Dark Devotion',
        text: 'Advantage against charm.',
      },
    ],
    actions: [
      {
        id: 'entry-2',
        name: 'Dagger',
        text: 'Melee weapon attack: +4 to hit.',
      },
    ],
    reactions: [{ id: 'entry-3', name: 'Parry', text: 'Add 2 to AC.' }],
    bonusActions: [{ id: 'entry-4', name: 'Shove', text: 'Push a creature.' }],
    lairActions: [
      { id: 'entry-5', name: 'Whispers', text: 'The lair speaks.' },
    ],
    cr: '2',
    type: 'humanoid',
    size: 'Medium',
    languages: 'Common',
    alignment: 'neutral evil',
    hpFormula: '6d8 + 6',
  },
  bestiarySourceId: 'srd-cult-fanatic',
  loreHtml: '<p>Leads the coven beneath the chapel.</p>',
  xp: 450,
  avatarUrl: 'https://example.invalid/npc-1.png',
  group: 'Cult',
  tags: ['boss'],
  hitDice: { current: 6, max: 6, dieType: 'd8' },
  deathSaves: { successes: 0, failures: 0 },
  initiativeModifier: 2,
  proficiencyBonus: 2,
  inventory: [
    {
      id: 'npc-item-1',
      name: 'Dagger',
      quantity: 1,
      equipped: true,
      magicItem: carriedMagicItem,
    },
  ],
  currency: { copper: 0, silver: 5, electrum: 0, gold: 25, platinum: 0 },
  spellcasting: {
    casterLevel: 5,
    ability: 'intelligence',
    spellAttackBonus: 5,
    spellSaveDC: 13,
    slotOverrides: { 1: 4 },
    slotsUsed: { 1: 1 },
    spells: [preparedSpell],
  },
  resources: [
    {
      id: 'res-1',
      name: 'Channel Divinity',
      icon: 'sun',
      color: 'amber',
      displayStyle: 'pips',
      maxUses: 2,
      usesExpended: 1,
      shortRestReset: 'all',
    },
  ],
  abilityUsage: { 'entry-1': 1 },
  collapsedSpellSections: ['slotTracker'],
  lastDetailTab: 'stats',
  passivePerception: 11,
  passiveInsight: 11,
  passiveInvestigation: 10,
  abilityScores: { str: 11, dex: 14, con: 12, int: 10, wis: 13, cha: 14 },
  traits: ['Dark Devotion'],
  actions: ['Dagger'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const baseMinimalNpc: CampaignNPC = {
  id: 'npc-2',
  campaignCode: 'ABC123',
  name: 'Cult Acolyte',
  armorClass: '13',
  maxHp: 9,
  speed: '30 ft.',
  createdAt: '2026-01-03T00:00:00.000Z',
  updatedAt: '2026-01-03T00:00:00.000Z',
};

const npc = (overrides: Record<string, unknown> = {}): CampaignNPC =>
  ({ ...structuredClone(baseNpc), ...overrides }) as CampaignNPC;

const minimalNpc = (overrides: Record<string, unknown> = {}): CampaignNPC =>
  ({ ...structuredClone(baseMinimalNpc), ...overrides }) as CampaignNPC;

const envelope = (npcs: unknown[], version = 4) =>
  JSON.stringify({ state: { npcsByCampaign: { ABC123: npcs } }, version });

const build = (npcs: unknown[], version = 4) =>
  buildNpcManifest({
    campaignCode: 'ABC123',
    rawEnvelope: envelope(npcs, version),
  });

const kinds = (manifest: { blockers: Array<{ kind: string }> }) =>
  manifest.blockers.map(blocker => blocker.kind);

describe('Slice 11D NPC family', () => {
  it('registers the canary, calendar, magic item, and NPC families', () => {
    expect(registeredDurableDmFamilies).toEqual([
      'campaign_settings',
      'calendar',
      'magic_item',
      'npc',
    ]);
    expect(NPC_STORAGE_KEY).toBe('rollkeeper-npc-data');
    expect(NPC_PERSIST_VERSION).toBe(4);
    expect(NPC_MAX_RECORD_BYTES).toBe(262_144);
    expect(NPC_MAX_ITEMS).toBe(2_000);
    expect(NPC_MAX_TOTAL_BYTES).toBe(5_242_880);
    expect(NPC_FAMILY_INVENTORY).toMatchObject({
      family: 'npc',
      localStorageKeys: ['rollkeeper-npc-data'],
      persistenceVersions: { 'rollkeeper-npc-data': 4 },
      stableIdentity: 'npcsByCampaign[campaignCode][].id',
      stableChildIdentity: [
        'inventory[].id',
        'resources[].id',
        'spellcasting.spells[].id',
      ],
      completeEnvelopeFields: ['npcsByCampaign'],
      documentFields: [
        'name',
        'description',
        'armorClass',
        'maxHp',
        'currentHp',
        'tempHp',
        'tempAc',
        'speed',
        'monsterStatBlock',
        'bestiarySourceId',
        'loreHtml',
        'xp',
        'avatarUrl',
        'group',
        'tags',
        'hitDice',
        'deathSaves',
        'initiativeModifier',
        'proficiencyBonus',
        'inventory',
        'currency',
        'spellcasting',
        'resources',
        'abilityUsage',
        'collapsedSpellSections',
        'lastDetailTab',
        'passivePerception',
        'passiveInsight',
        'passiveInvestigation',
        'abilityScores',
        'traits',
        'actions',
        'createdAt',
        'updatedAt',
      ],
      privateFields: ['*'],
      publicFields: [],
      discoveredFields: [],
      projection: 'not-applicable',
      typedCrossFamilyReferences: [],
      redisProjectionKinds: [],
      retainedValueCopies: [
        'rollkeeper-encounter-data (encounter entities, npcSourceId)',
        'redis shared:initiative (live combat SharedTurnEntry)',
        'redis transfers (NPC item sent to player)',
      ],
      excludedFamilies: expect.arrayContaining([
        'magic_item',
        'encounter_definition',
        'character',
        'battle_map',
      ]),
    });
    expect(NPC_FAMILY_INVENTORY.excludedFamilies).not.toContain('npc');
  });

  it('captures every NPC as its own sorted record', async () => {
    const manifest = await build([
      minimalNpc({ armorClass: 13, description: null }),
      npc(),
    ]);

    expect(manifest.blockers).toEqual([]);
    expect(manifest.format).toBe('rollkeeper-npc-manifest');
    expect(manifest.version).toBe(1);
    expect(manifest.family).toBe('npc');
    expect(manifest.campaignCode).toBe('ABC123');
    expect(manifest.recordCount).toBe(2);
    expect(manifest.records.map(entry => entry.legacyId)).toEqual([
      'npc-1',
      'npc-2',
    ]);
    expect(manifest.records.some(entry => entry.tombstoned)).toBe(false);
    expect(manifest.records[0].schemaVersion).toBe(4);
    expect(manifest.records[0].payload).not.toHaveProperty('id');
    expect(manifest.records[0].payload).not.toHaveProperty('campaignCode');
    expect(manifest.records[0].payload).toMatchObject({
      name: 'Cult Fanatic',
      armorClass: '16 (natural armor)',
      tags: ['boss'],
      group: 'Cult',
      abilityUsage: { 'entry-1': 1 },
      inventory: [expect.objectContaining({ id: 'npc-item-1' })],
      resources: [expect.objectContaining({ id: 'res-1' })],
      spellcasting: expect.objectContaining({
        casterLevel: 5,
        spells: [expect.objectContaining({ id: 'spell-1' })],
      }),
      monsterStatBlock: expect.objectContaining({
        traits: [expect.objectContaining({ id: 'entry-1' })],
        lairActions: [expect.objectContaining({ id: 'entry-5' })],
      }),
    });
    expect(manifest.records[1].payload).toMatchObject({
      armorClass: 13,
      description: null,
    });
    expect(manifest.totalBytes).toBe(
      manifest.records[0].byteCount + manifest.records[1].byteCount
    );
    expect(manifest.records[0].payloadFingerprint).toBe(
      await fingerprintNpcPayload(manifest.records[0].payload!)
    );
    expect(manifest.rawCandidates).toHaveLength(1);
    expect(manifest.rawCandidates[0].sourceKey).toBe('rollkeeper-npc-data');
  });

  it('fingerprints deterministically and changes when an NPC changes', async () => {
    const first = await build([npc()]);
    const second = await build([npc()]);
    const changed = await build([npc({ name: 'Cult Zealot' })]);

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(changed.fingerprint).not.toBe(first.fingerprint);
  });

  it('treats an empty roster for the campaign as valid', async () => {
    const manifest = await buildNpcManifest({
      campaignCode: 'ABC123',
      rawEnvelope: JSON.stringify({
        state: { npcsByCampaign: { OTHER1: [npc()] } },
        version: 4,
      }),
    });

    expect(manifest.records).toEqual([]);
    expect(manifest.blockers).toEqual([]);
    expect(manifest.recordCount).toBe(0);
    expect(manifest.totalBytes).toBe(0);
  });

  it('blocks an envelope that has never been persisted', async () => {
    const manifest = await buildNpcManifest({
      campaignCode: 'ABC123',
      rawEnvelope: '',
    });

    expect(kinds(manifest)).toEqual(['incomplete-envelope']);
    expect(manifest.blockers[0].detail).toBe(
      'rollkeeper-npc-data has never been persisted on this browser'
    );
    expect(manifest.blockers[0].legacyId).toBeNull();
  });

  it('blocks malformed JSON and incomplete envelopes', async () => {
    const malformed = await buildNpcManifest({
      campaignCode: 'ABC123',
      rawEnvelope: '{not json',
    });
    const incomplete = await buildNpcManifest({
      campaignCode: 'ABC123',
      rawEnvelope: JSON.stringify({ state: {} }),
    });
    const notAnArray = await buildNpcManifest({
      campaignCode: 'ABC123',
      rawEnvelope: JSON.stringify({
        state: { npcsByCampaign: { ABC123: 'nope' } },
        version: 4,
      }),
    });

    expect(kinds(malformed)).toEqual(['malformed-json']);
    expect(kinds(incomplete)).toEqual(['incomplete-envelope']);
    expect(kinds(notAnArray)).toEqual(['incomplete-envelope']);
    expect(notAnArray.records).toEqual([]);
  });

  it('blocks future and legacy persistence versions', async () => {
    const future = await build([npc()], 5);
    const legacy = await build([npc()], 3);
    const missing = await buildNpcManifest({
      campaignCode: 'ABC123',
      rawEnvelope: JSON.stringify({
        state: { npcsByCampaign: { ABC123: [npc()] } },
      }),
    });

    expect(kinds(future)).toEqual(['future-schema']);
    expect(future.blockers[0].detail).toContain('5');
    expect(future.records).toEqual([]);
    expect(kinds(legacy)).toEqual(['legacy-schema']);
    expect(legacy.blockers[0].detail).toBe(
      'rollkeeper-npc-data is persisted at version 3; the NPC store migration must upgrade it to version 4 before preview'
    );
    expect(legacy.records).toEqual([]);
    expect(kinds(missing)).toEqual(['legacy-schema']);
    expect(missing.records).toEqual([]);
  });

  it('quarantines duplicate, mismatched, and unidentified NPCs', async () => {
    const duplicate = await build([npc(), npc({ name: 'Copy' })]);
    const mismatched = await build([npc({ campaignCode: 'OTHER1' })]);
    const unidentified = await build([npc({ id: undefined })]);

    expect(kinds(duplicate)).toEqual(['duplicate-id']);
    expect(duplicate.records).toHaveLength(1);
    expect(kinds(mismatched)).toEqual(['id-mismatch']);
    expect(mismatched.records).toEqual([]);
    expect(kinds(unidentified)).toEqual(['invalid-npc-id']);
    expect(unidentified.blockers[0].legacyId).toBeNull();
    expect(unidentified.records).toEqual([]);
  });

  it('quarantines unclassified fields and invalid NPC shapes', async () => {
    const unclassified = await build([npc({ secretPlan: 'burn the town' })]);
    const emptyName = await build([npc({ name: '' })]);
    const stringMaxHp = await build([npc({ maxHp: '10' })]);

    expect(kinds(unclassified)).toEqual(['unclassified-field']);
    expect(unclassified.blockers[0].detail).toContain('secretPlan');
    expect(unclassified.blockers[0].legacyId).toBe('npc-1');
    expect(unclassified.records).toEqual([]);
    expect(kinds(emptyName)).toEqual(['invalid-npc']);
    expect(emptyName.records).toEqual([]);
    expect(kinds(stringMaxHp)).toEqual(['invalid-npc']);
    expect(stringMaxHp.records).toEqual([]);
  });

  it('quarantines invalid and duplicated child identities', async () => {
    const invalidChild = await build([npc({ inventory: [{ id: '' }] })]);
    const duplicateResource = await build([
      npc({
        resources: [
          { id: 'res-1', name: 'One' },
          { id: 'res-1', name: 'Two' },
        ],
      }),
    ]);
    const duplicateSpell = await build([
      npc({ spellcasting: { spells: [{ id: 's' }, { id: 's' }] } }),
    ]);

    expect(kinds(invalidChild)).toEqual(['invalid-child-id']);
    expect(kinds(duplicateResource)).toEqual(['duplicate-child-id']);
    expect(duplicateResource.blockers[0].detail).toContain('res-1');
    expect(kinds(duplicateSpell)).toEqual(['duplicate-child-id']);
    expect(duplicateSpell.blockers[0].detail).toContain('spellcasting.spells');
  });

  it('quarantines stat block sections that are not arrays of objects', async () => {
    const badTraits = await build([npc({ monsterStatBlock: { traits: 'x' } })]);
    const badActionEntry = await build([
      npc({ monsterStatBlock: { actions: ['Dagger'] } }),
    ]);

    expect(kinds(badTraits)).toEqual(['invalid-npc']);
    expect(badTraits.blockers[0].detail).toBe(
      'monsterStatBlock.traits must be an array of objects'
    );
    expect(kinds(badActionEntry)).toEqual(['invalid-npc']);
    expect(badActionEntry.blockers[0].detail).toBe(
      'monsterStatBlock.actions must be an array of objects'
    );
  });

  it('reports oversized records and oversized families', async () => {
    const oversizedRecord = await build([
      npc({ loreHtml: 'x'.repeat(300_000) }),
    ]);
    const tooManyNpcs = await build(
      Array.from({ length: NPC_MAX_ITEMS + 1 }, (_unused, index) =>
        minimalNpc({ id: `npc-${index}` })
      )
    );
    const tooManyBytes = await build(
      Array.from({ length: 22 }, (_unused, index) =>
        minimalNpc({ id: `npc-${index}`, loreHtml: 'x'.repeat(250_000) })
      )
    );

    expect(kinds(oversizedRecord)).toEqual(['oversized-record']);
    expect(oversizedRecord.records).toHaveLength(1);
    expect(oversizedRecord.records[0].byteCount).toBeGreaterThan(
      NPC_MAX_RECORD_BYTES
    );
    expect(kinds(tooManyNpcs)).toEqual(['oversized-family']);
    expect(tooManyNpcs.blockers[0].legacyId).toBeNull();
    expect(tooManyNpcs.recordCount).toBe(NPC_MAX_ITEMS + 1);
    expect(kinds(tooManyBytes)).toEqual(['oversized-family']);
    expect(tooManyBytes.totalBytes).toBeGreaterThan(NPC_MAX_TOTAL_BYTES);
  });

  it('accepts legacy numeric armour values and absent optionals', async () => {
    const manifest = await build([
      npc({ group: null, tempAc: 2, armorClass: 13 }),
    ]);

    expect(manifest.blockers).toEqual([]);
    expect(manifest.records[0].payload).toMatchObject({
      group: null,
      tempAc: 2,
      armorClass: 13,
    });

    const minimal = validateNpcPayload({
      name: 'Village Elder',
      armorClass: '10',
      maxHp: 4,
      speed: '30 ft.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(minimal).toMatchObject({ ok: true });

    const rejected = validateNpcPayload({ name: 'Nameless' });
    expect(rejected).toMatchObject({ ok: false, kind: 'invalid-npc' });
    expect(validateNpcPayload('not an object')).toMatchObject({
      ok: false,
      kind: 'invalid-npc',
    });
  });

  it('round-trips payloads to and from campaign NPCs', () => {
    const source = npc();
    const payload = npcPayloadFromCampaignNpc(source);

    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('campaignCode');
    expect(campaignNpcFromPayload('ABC123', 'npc-1', payload)).toEqual(source);
  });

  it('sorts NPCs by creation time and then by id', () => {
    const unsorted = [
      { id: 'b', createdAt: '2026-01-02T00:00:00.000Z' },
      { id: 'c', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'a', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    expect(sortNpcs(unsorted).map(entry => entry.id)).toEqual(['a', 'c', 'b']);
    expect(unsorted[0].id).toBe('b');
  });

  it('fingerprints tombstones over the canonical tombstone document', async () => {
    expect(await fingerprintNpcTombstone('npc-1')).toBe(
      await sha256Bytes('{"legacyId":"npc-1","tombstoned":true}')
    );
  });

  it('builds a working copy manifest with tombstoned documents', async () => {
    const source = await build([npc(), minimalNpc()]);
    const payload = npcPayloadFromCampaignNpc(npc({ name: 'Cult Zealot' }));
    const working = await buildNpcWorkingCopyManifest({
      source,
      documents: [
        { legacyId: 'npc-1', payload, schemaVersion: 4, tombstoned: false },
        {
          legacyId: 'npc-2',
          payload: null,
          schemaVersion: 4,
          tombstoned: true,
        },
      ],
    });

    expect(working.blockers).toEqual([]);
    expect(working.recordCount).toBe(2);
    expect(working.records[0]).toMatchObject({
      legacyId: 'npc-1',
      tombstoned: false,
    });
    expect(working.records[0].payload).toMatchObject({ name: 'Cult Zealot' });
    expect(working.records[1]).toMatchObject({
      legacyId: 'npc-2',
      tombstoned: true,
      payload: null,
    });
    expect(working.records[1].payloadFingerprint).toBe(
      await fingerprintNpcTombstone('npc-2')
    );
    expect(working.records[1].byteCount).toBe(
      new TextEncoder().encode('{"legacyId":"npc-2","tombstoned":true}')
        .byteLength
    );
    expect(working.rawCandidates).toEqual(source.rawCandidates);
    expect(working.fingerprint).not.toBe(source.fingerprint);
  });

  it('refuses working copies built from unvalidated sources or documents', async () => {
    const blocked = await buildNpcManifest({
      campaignCode: 'ABC123',
      rawEnvelope: '',
    });
    const source = await build([npc()]);
    const payload = npcPayloadFromCampaignNpc(npc());

    await expect(
      buildNpcWorkingCopyManifest({
        source: blocked,
        documents: [
          { legacyId: 'npc-1', payload, schemaVersion: 4, tombstoned: false },
        ],
      })
    ).rejects.toThrow('A validated NPC source manifest is required');

    await expect(
      buildNpcWorkingCopyManifest({
        source,
        documents: [
          { legacyId: 'npc-1', payload, schemaVersion: 1, tombstoned: false },
        ],
      })
    ).rejects.toThrow('schema version 4');

    await expect(
      buildNpcWorkingCopyManifest({
        source,
        documents: [
          {
            legacyId: 'npc-1',
            payload: { ...payload, name: '' },
            schemaVersion: 4,
            tombstoned: false,
          },
        ],
      })
    ).rejects.toThrow('npc-1');
  });

  const payloadWith = (overrides: Record<string, unknown>) => ({
    ...npcPayloadFromCampaignNpc(npc()),
    ...overrides,
  });

  const invalidNpcCases: Array<[string, Record<string, unknown>]> = [
    ['a name over 1000 characters', { name: 'x'.repeat(1001) }],
    ['a non-string name', { name: 42 }],
    ['an absent name', { name: undefined }],
    ['an armour class over 100 characters', { armorClass: 'a'.repeat(101) }],
    ['a non-finite armour class', { armorClass: Number.NaN }],
    ['a boolean armour class', { armorClass: true }],
    ['an absent maxHp', { maxHp: undefined }],
    ['a non-finite maxHp', { maxHp: Number.POSITIVE_INFINITY }],
    ['a speed over 100 characters', { speed: 's'.repeat(101) }],
    ['a numeric speed', { speed: 30 }],
    ['a non-string createdAt', { createdAt: 1_700_000_000 }],
    ['a non-string updatedAt', { updatedAt: [] }],
    ['a numeric description', { description: 7 }],
    ['a numeric bestiarySourceId', { bestiarySourceId: 7 }],
    ['a numeric loreHtml', { loreHtml: 7 }],
    ['a numeric avatarUrl', { avatarUrl: 7 }],
    ['a numeric group', { group: 7 }],
    ['a lastDetailTab over 100 characters', { lastDetailTab: 't'.repeat(101) }],
    ['a boolean tempAc', { tempAc: false }],
    ['a tempAc over 100 characters', { tempAc: 'a'.repeat(101) }],
    ['a string currentHp', { currentHp: '10' }],
    ['a string tempHp', { tempHp: '2' }],
    ['a string xp', { xp: '450' }],
    ['a string initiativeModifier', { initiativeModifier: '2' }],
    ['a string proficiencyBonus', { proficiencyBonus: '2' }],
    ['a string passivePerception', { passivePerception: '11' }],
    ['a string passiveInsight', { passiveInsight: '11' }],
    ['a string passiveInvestigation', { passiveInvestigation: '10' }],
    ['tags that are not an array', { tags: 'boss' }],
    ['tags with a non-string entry', { tags: ['boss', 7] }],
    [
      'collapsedSpellSections that are not an array',
      {
        collapsedSpellSections: 'stats',
      },
    ],
    ['traits with a non-string entry', { traits: [7] }],
    ['actions that are not an array', { actions: 'Dagger' }],
    ['hitDice that are not an object', { hitDice: 'd8' }],
    ['deathSaves that are not an object', { deathSaves: [] }],
    ['currency that is not an object', { currency: 25 }],
    ['abilityScores that are not an object', { abilityScores: 'str 11' }],
    ['abilityUsage that is not an object', { abilityUsage: 1 }],
    ['a monsterStatBlock that is not an object', { monsterStatBlock: 'cr 2' }],
    [
      'a stat block reaction section that is not an array',
      { monsterStatBlock: { reactions: 'Parry' } },
    ],
    [
      'a stat block bonus action entry that is not an object',
      { monsterStatBlock: { bonusActions: [null] } },
    ],
    [
      'a stat block lair action section that is not an array',
      { monsterStatBlock: { lairActions: 3 } },
    ],
    ['inventory that is not an array', { inventory: 'Dagger' }],
    ['an inventory entry that is not an object', { inventory: [42] }],
    ['resources that are not an array', { resources: 'Channel Divinity' }],
    ['a spellcasting block that is not an object', { spellcasting: 'wizard' }],
    ['spellcasting without spells', { spellcasting: { casterLevel: 5 } }],
    [
      'spellcasting spells that are not an array',
      { spellcasting: { spells: 'Fire Bolt' } },
    ],
  ];

  it.each(invalidNpcCases)(
    'rejects %s as an invalid NPC',
    (_label, overrides) => {
      expect(validateNpcPayload(payloadWith(overrides))).toMatchObject({
        ok: false,
        kind: 'invalid-npc',
      });
    }
  );

  const invalidChildCases: Array<[string, Record<string, unknown>, string]> = [
    [
      'an inventory row without an id',
      { inventory: [{ name: 'Dagger' }] },
      'invalid-child-id',
    ],
    [
      'an inventory id over 255 characters',
      { inventory: [{ id: 'i'.repeat(256) }] },
      'invalid-child-id',
    ],
    [
      'a resource id that is not a string',
      { resources: [{ id: 9 }] },
      'invalid-child-id',
    ],
    [
      'repeated inventory ids',
      { inventory: [{ id: 'npc-item-1' }, { id: 'npc-item-1' }] },
      'duplicate-child-id',
    ],
    [
      'a spell without an id',
      { spellcasting: { spells: [{ name: 'Fire Bolt' }] } },
      'invalid-child-id',
    ],
  ];

  it.each(invalidChildCases)('rejects %s', (_label, overrides, kind) => {
    expect(validateNpcPayload(payloadWith(overrides))).toMatchObject({
      ok: false,
      kind,
    });
  });

  const acceptedCases: Array<[string, Record<string, unknown>]> = [
    ['null grouping metadata', { group: null, tags: null }],
    [
      'null optional numbers',
      { currentHp: null, tempHp: null, xp: null, tempAc: null },
    ],
    [
      'null child collections',
      { inventory: null, resources: null, spellcasting: null },
    ],
    ['a null stat block', { monsterStatBlock: null }],
    [
      'a stat block with null sections',
      {
        monsterStatBlock: {
          traits: null,
          actions: null,
          reactions: null,
          bonusActions: null,
          lairActions: null,
        },
      },
    ],
    [
      'a legacy numeric armour class and temp AC',
      { armorClass: 13, tempAc: 2 },
    ],
    ['empty stat block sections', { monsterStatBlock: {} }],
    [
      'boundary-length labels',
      {
        name: 'n'.repeat(1000),
        armorClass: 'a'.repeat(100),
        speed: 's'.repeat(100),
        lastDetailTab: 't'.repeat(100),
        tempAc: 'a'.repeat(100),
      },
    ],
    [
      'an empty inventory and no spellcasting',
      { inventory: [], resources: [] },
    ],
  ];

  it.each(acceptedCases)('accepts %s', (_label, overrides) => {
    expect(validateNpcPayload(payloadWith(overrides))).toMatchObject({
      ok: true,
    });
  });

  it('sorts blockers deterministically by canonical JSON', async () => {
    // Discovery order is unclassified-field then duplicate-id; canonical JSON
    // sorting compares `detail` first, so the emitted order is the reverse.
    const manifest = await build([npc({ secretPlan: 'hidden' }), npc()]);

    expect(kinds(manifest)).toEqual(['duplicate-id', 'unclassified-field']);
    const details = manifest.blockers.map(blocker => blocker.detail);
    expect(details).toEqual([
      'Duplicate NPC ID npc-1',
      'NPC field secretPlan is not classified in Slice 11D',
    ]);
    expect(details).toEqual([...details].sort());
  });
});
