import { describe, expect, it } from 'vitest';

import { sha256Bytes } from '@/lib/indexeddb/migrationCapture';
import type { CustomMagicItem } from '@/types/magicItemLibrary';

import {
  buildMagicItemManifest,
  buildMagicItemWorkingCopyManifest,
  customMagicItemFromPayload,
  fingerprintMagicItemPayload,
  fingerprintMagicItemTombstone,
  MAGIC_ITEM_FAMILY_INVENTORY,
  MAGIC_ITEM_MAX_ITEMS,
  MAGIC_ITEM_MAX_RECORD_BYTES,
  MAGIC_ITEM_MAX_TOTAL_BYTES,
  MAGIC_ITEM_STORAGE_KEY,
  magicItemPayloadFromCustomItem,
  registeredDurableDmFamilies,
  sortMagicItems,
  validateMagicItemPayload,
} from './magicItemFamily';

const item = (overrides: Record<string, unknown> = {}): CustomMagicItem =>
  ({
    id: 'magic-1',
    campaignCode: 'ABC123',
    name: 'Bag of Holding',
    category: 'wondrous',
    rarity: 'uncommon',
    description: 'A capacious extradimensional bag.',
    properties: ['Extradimensional'],
    requiresAttunement: false,
    isAttuned: false,
    isEquipped: true,
    charges: [
      {
        id: 'charge-1',
        name: 'Reach Inside',
        description: 'Retrieve a stored item.',
        maxCharges: 3,
        usedCharges: 1,
        restType: 'dawn',
        scaleWithProficiency: false,
        proficiencyMultiplier: 1,
      },
    ],
    chargePool: {
      maxCharges: 5,
      usedCharges: 2,
      rechargeType: 'long',
      rechargeAmount: '1d4',
      abilities: [
        {
          id: 'ability-1',
          name: 'Summon Satchel',
          description: 'Call the bag to hand.',
          cost: 2,
          isSpell: false,
        },
      ],
    },
    bonusSpellAttack: 1,
    bonusSpellSaveDc: 2,
    legacyCharges: { current: 1, max: 2, rechargeRule: 'dawn' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    tags: ['wondrous'],
    group: 'Relics',
    sourceItemId: 'srd-bag',
    ...overrides,
  }) as CustomMagicItem;

const envelope = (items: unknown[], version = 1) =>
  JSON.stringify({ state: { itemsByCampaign: { ABC123: items } }, version });

const build = (items: unknown[], version = 1) =>
  buildMagicItemManifest({
    campaignCode: 'ABC123',
    rawEnvelope: envelope(items, version),
  });

const kinds = (manifest: { blockers: Array<{ kind: string }> }) =>
  manifest.blockers.map(blocker => blocker.kind);

describe('Slice 11C magic item family', () => {
  it('registers the canary, calendar, and magic item families', () => {
    expect(registeredDurableDmFamilies).toEqual([
      'campaign_settings',
      'calendar',
      'magic_item',
    ]);
    expect(MAGIC_ITEM_STORAGE_KEY).toBe('rollkeeper-dm-magic-item-library');
    expect(MAGIC_ITEM_MAX_RECORD_BYTES).toBe(262_144);
    expect(MAGIC_ITEM_MAX_ITEMS).toBe(2_000);
    expect(MAGIC_ITEM_MAX_TOTAL_BYTES).toBe(5_242_880);
    expect(MAGIC_ITEM_FAMILY_INVENTORY).toMatchObject({
      family: 'magic_item',
      localStorageKeys: ['rollkeeper-dm-magic-item-library'],
      persistenceVersions: { 'rollkeeper-dm-magic-item-library': 1 },
      stableIdentity: 'itemsByCampaign[campaignCode][].id',
      stableChildIdentity: ['charges[].id', 'chargePool.abilities[].id'],
      completeEnvelopeFields: ['itemsByCampaign'],
      documentFields: [
        'name',
        'category',
        'rarity',
        'description',
        'properties',
        'requiresAttunement',
        'isAttuned',
        'isEquipped',
        'charges',
        'chargePool',
        'bonusSpellAttack',
        'bonusSpellSaveDc',
        'legacyCharges',
        'createdAt',
        'updatedAt',
        'tags',
        'group',
        'sourceItemId',
      ],
      privateFields: ['*'],
      publicFields: [],
      discoveredFields: [],
      projection: 'not-applicable',
      typedCrossFamilyReferences: [],
      redisProjectionKinds: [],
      excludedFamilies: expect.arrayContaining([
        'calendar',
        'npc',
        'character',
        'battle_map',
      ]),
    });
  });

  it('captures every custom item as its own sorted record', async () => {
    const manifest = await build([
      item({ id: 'magic-2', name: 'Cloak of Elvenkind' }),
      item(),
    ]);

    expect(manifest.blockers).toEqual([]);
    expect(manifest.format).toBe('rollkeeper-magic-item-manifest');
    expect(manifest.family).toBe('magic_item');
    expect(manifest.campaignCode).toBe('ABC123');
    expect(manifest.recordCount).toBe(2);
    expect(manifest.records.map(entry => entry.legacyId)).toEqual([
      'magic-1',
      'magic-2',
    ]);
    expect(manifest.records.some(entry => entry.tombstoned)).toBe(false);
    expect(manifest.records[0].schemaVersion).toBe(1);
    expect(manifest.records[0].payload).not.toHaveProperty('id');
    expect(manifest.records[0].payload).not.toHaveProperty('campaignCode');
    expect(manifest.records[0].payload).toMatchObject({
      name: 'Bag of Holding',
      charges: [expect.objectContaining({ id: 'charge-1' })],
      chargePool: expect.objectContaining({
        abilities: [expect.objectContaining({ id: 'ability-1' })],
      }),
      tags: ['wondrous'],
      group: 'Relics',
      sourceItemId: 'srd-bag',
    });
    expect(manifest.totalBytes).toBe(
      manifest.records[0].byteCount + manifest.records[1].byteCount
    );
    expect(manifest.records[0].payloadFingerprint).toBe(
      await fingerprintMagicItemPayload(manifest.records[0].payload!)
    );
    expect(manifest.rawCandidates).toHaveLength(1);
    expect(manifest.rawCandidates[0].sourceKey).toBe(
      'rollkeeper-dm-magic-item-library'
    );
  });

  it('fingerprints deterministically and changes when an item changes', async () => {
    const first = await build([item()]);
    const second = await build([item()]);
    const changed = await build([item({ name: 'Bag of Hoarding' })]);

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(changed.fingerprint).not.toBe(first.fingerprint);
  });

  it('treats an empty library for the campaign as valid', async () => {
    const manifest = await buildMagicItemManifest({
      campaignCode: 'ABC123',
      rawEnvelope: JSON.stringify({
        state: { itemsByCampaign: { OTHER1: [item()] } },
        version: 1,
      }),
    });

    expect(manifest.records).toEqual([]);
    expect(manifest.blockers).toEqual([]);
    expect(manifest.recordCount).toBe(0);
    expect(manifest.totalBytes).toBe(0);
  });

  it('blocks an envelope that has never been persisted', async () => {
    const manifest = await buildMagicItemManifest({
      campaignCode: 'ABC123',
      rawEnvelope: '',
    });

    expect(kinds(manifest)).toEqual(['incomplete-envelope']);
    expect(manifest.blockers[0].detail).toBe(
      'rollkeeper-dm-magic-item-library has never been persisted on this device'
    );
    expect(manifest.blockers[0].legacyId).toBeNull();
  });

  it('blocks malformed JSON, incomplete envelopes, and future schemas', async () => {
    const malformed = await buildMagicItemManifest({
      campaignCode: 'ABC123',
      rawEnvelope: '{not json',
    });
    const incomplete = await buildMagicItemManifest({
      campaignCode: 'ABC123',
      rawEnvelope: JSON.stringify({ state: {} }),
    });
    const notAnArray = await buildMagicItemManifest({
      campaignCode: 'ABC123',
      rawEnvelope: JSON.stringify({
        state: { itemsByCampaign: { ABC123: 'nope' } },
        version: 1,
      }),
    });
    const future = await build([item()], 2);

    expect(kinds(malformed)).toEqual(['malformed-json']);
    expect(kinds(incomplete)).toEqual(['incomplete-envelope']);
    expect(kinds(notAnArray)).toEqual(['incomplete-envelope']);
    expect(kinds(future)).toEqual(['future-schema']);
    expect(future.blockers[0].detail).toContain('2');
    expect(future.records).toEqual([]);
  });

  it('quarantines duplicate, mismatched, and unidentified items', async () => {
    const duplicate = await build([item(), item({ name: 'Copy' })]);
    const mismatched = await build([item({ campaignCode: 'OTHER1' })]);
    const unidentified = await build([item({ id: undefined })]);

    expect(kinds(duplicate)).toEqual(['duplicate-id']);
    expect(duplicate.records).toHaveLength(1);
    expect(kinds(mismatched)).toEqual(['id-mismatch']);
    expect(mismatched.records).toEqual([]);
    expect(kinds(unidentified)).toEqual(['invalid-item-id']);
    expect(unidentified.blockers[0].legacyId).toBeNull();
    expect(unidentified.records).toEqual([]);
  });

  it('quarantines unclassified fields and invalid item shapes', async () => {
    const unclassified = await build([item({ secretNotes: 'hidden' })]);
    const invalid = await build([item({ name: '' })]);

    expect(kinds(unclassified)).toEqual(['unclassified-field']);
    expect(unclassified.blockers[0].detail).toContain('secretNotes');
    expect(unclassified.blockers[0].legacyId).toBe('magic-1');
    expect(unclassified.records).toEqual([]);
    expect(kinds(invalid)).toEqual(['invalid-item']);
    expect(invalid.records).toEqual([]);
  });

  it('quarantines invalid and duplicated child identities', async () => {
    const invalidChild = await build([item({ charges: [{ id: '' }] })]);
    const duplicateChild = await build([
      item({
        chargePool: {
          maxCharges: 5,
          usedCharges: 0,
          rechargeType: 'dawn',
          abilities: [
            { id: 'ability-1', name: 'One', cost: 1 },
            { id: 'ability-1', name: 'Two', cost: 2 },
          ],
        },
      }),
    ]);

    expect(kinds(invalidChild)).toEqual(['invalid-child-id']);
    expect(kinds(duplicateChild)).toEqual(['duplicate-child-id']);
    expect(duplicateChild.blockers[0].detail).toContain('ability-1');
  });

  it('reports oversized records and oversized families', async () => {
    const oversizedRecord = await build([
      item({ description: 'x'.repeat(300_000) }),
    ]);
    const tooManyItems = await build(
      Array.from({ length: MAGIC_ITEM_MAX_ITEMS + 1 }, (_unused, index) =>
        item({ id: `magic-${index}` })
      )
    );
    const tooManyBytes = await build(
      Array.from({ length: 22 }, (_unused, index) =>
        item({ id: `magic-${index}`, description: 'x'.repeat(250_000) })
      )
    );

    expect(kinds(oversizedRecord)).toEqual(['oversized-record']);
    expect(oversizedRecord.records).toHaveLength(1);
    expect(oversizedRecord.records[0].byteCount).toBeGreaterThan(
      MAGIC_ITEM_MAX_RECORD_BYTES
    );
    expect(kinds(tooManyItems)).toEqual(['oversized-family']);
    expect(tooManyItems.blockers[0].legacyId).toBeNull();
    expect(tooManyItems.recordCount).toBe(MAGIC_ITEM_MAX_ITEMS + 1);
    expect(kinds(tooManyBytes)).toEqual(['oversized-family']);
    expect(tooManyBytes.totalBytes).toBeGreaterThan(MAGIC_ITEM_MAX_TOTAL_BYTES);
  });

  it('accepts explicit null grouping metadata and absent optionals', async () => {
    const manifest = await build([item({ group: null, sourceItemId: null })]);
    expect(manifest.blockers).toEqual([]);
    expect(manifest.records[0].payload).toMatchObject({
      group: null,
      sourceItemId: null,
    });

    const minimal = validateMagicItemPayload({
      name: 'Plain Ring',
      category: 'ring',
      rarity: 'common',
      description: '',
      properties: [],
      requiresAttunement: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      tags: [],
    });
    expect(minimal.ok).toBe(true);

    const rejected = validateMagicItemPayload({ name: 'Nameless' });
    expect(rejected).toMatchObject({ ok: false, kind: 'invalid-item' });
  });

  it('round-trips payloads to and from custom magic items', () => {
    const source = item();
    const payload = magicItemPayloadFromCustomItem(source);

    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('campaignCode');
    expect(customMagicItemFromPayload('ABC123', 'magic-1', payload)).toEqual(
      source
    );
  });

  it('sorts items by creation time and then by id', () => {
    const unsorted = [
      { id: 'b', createdAt: '2026-01-02T00:00:00.000Z' },
      { id: 'c', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'a', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    expect(sortMagicItems(unsorted).map(entry => entry.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
    expect(unsorted[0].id).toBe('b');
  });

  it('fingerprints tombstones over the canonical tombstone document', async () => {
    expect(await fingerprintMagicItemTombstone('magic-1')).toBe(
      await sha256Bytes('{"legacyId":"magic-1","tombstoned":true}')
    );
  });

  it('builds a working copy manifest with tombstoned documents', async () => {
    const source = await build([item(), item({ id: 'magic-2' })]);
    const payload = magicItemPayloadFromCustomItem(
      item({ name: 'Bag of Devouring' })
    );
    const working = await buildMagicItemWorkingCopyManifest({
      source,
      documents: [
        { legacyId: 'magic-1', payload, schemaVersion: 1, tombstoned: false },
        {
          legacyId: 'magic-2',
          payload: null,
          schemaVersion: 1,
          tombstoned: true,
        },
      ],
    });

    expect(working.blockers).toEqual([]);
    expect(working.recordCount).toBe(2);
    expect(working.records[0]).toMatchObject({
      legacyId: 'magic-1',
      tombstoned: false,
    });
    expect(working.records[0].payload).toMatchObject({
      name: 'Bag of Devouring',
    });
    expect(working.records[1]).toMatchObject({
      legacyId: 'magic-2',
      tombstoned: true,
      payload: null,
    });
    expect(working.records[1].payloadFingerprint).toBe(
      await fingerprintMagicItemTombstone('magic-2')
    );
    expect(working.records[1].byteCount).toBe(
      new TextEncoder().encode('{"legacyId":"magic-2","tombstoned":true}')
        .byteLength
    );
    expect(working.rawCandidates).toEqual(source.rawCandidates);
    expect(working.fingerprint).not.toBe(source.fingerprint);
  });

  it('refuses working copies built from unvalidated sources or documents', async () => {
    const blocked = await buildMagicItemManifest({
      campaignCode: 'ABC123',
      rawEnvelope: '',
    });
    const source = await build([item()]);
    const payload = magicItemPayloadFromCustomItem(item());

    await expect(
      buildMagicItemWorkingCopyManifest({
        source: blocked,
        documents: [
          { legacyId: 'magic-1', payload, schemaVersion: 1, tombstoned: false },
        ],
      })
    ).rejects.toThrow('A validated magic item source manifest is required');

    await expect(
      buildMagicItemWorkingCopyManifest({
        source,
        documents: [
          { legacyId: 'magic-1', payload, schemaVersion: 2, tombstoned: false },
        ],
      })
    ).rejects.toThrow('schema version 1');

    await expect(
      buildMagicItemWorkingCopyManifest({
        source,
        documents: [
          {
            legacyId: 'magic-1',
            payload: { ...payload, name: '' },
            schemaVersion: 1,
            tombstoned: false,
          },
        ],
      })
    ).rejects.toThrow('magic-1');
  });

  const payloadWith = (overrides: Record<string, unknown>) => ({
    ...magicItemPayloadFromCustomItem(item()),
    ...overrides,
  });

  const invalidItemCases: Array<[string, Record<string, unknown>]> = [
    ['a name over 1000 characters', { name: 'x'.repeat(1001) }],
    ['a non-string name', { name: 42 }],
    ['a category over 100 characters', { category: 'c'.repeat(101) }],
    ['a non-string rarity', { rarity: 5 }],
    ['a non-string description', { description: null }],
    ['properties that are not an array', { properties: 'Extradimensional' }],
    ['tags with a non-string entry', { tags: ['wondrous', 7] }],
    ['a non-boolean requiresAttunement', { requiresAttunement: 'yes' }],
    ['a non-string createdAt', { createdAt: 1_700_000_000 }],
    ['a non-string updatedAt', { updatedAt: [] }],
    ['a non-boolean isAttuned', { isAttuned: 'no' }],
    ['a non-boolean isEquipped', { isEquipped: 1 }],
    ['a non-string group', { group: 3 }],
    ['a non-string sourceItemId', { sourceItemId: false }],
    ['a non-numeric bonusSpellAttack', { bonusSpellAttack: '1' }],
    ['a non-finite bonusSpellSaveDc', { bonusSpellSaveDc: Number.NaN }],
    ['legacyCharges that are not an object', { legacyCharges: 'dawn' }],
    ['charges that are not an array', { charges: 'none' }],
    ['a charges entry that is not an object', { charges: [42] }],
    ['a chargePool that is not an object', { chargePool: 'none' }],
    [
      'chargePool abilities that are not an array',
      { chargePool: { abilities: 'none' } },
    ],
    ['chargePool abilities that are absent', { chargePool: { maxCharges: 1 } }],
  ];

  it.each(invalidItemCases)(
    'rejects %s as an invalid item',
    (_label, overrides) => {
      expect(validateMagicItemPayload(payloadWith(overrides))).toMatchObject({
        ok: false,
        kind: 'invalid-item',
      });
    }
  );

  const invalidChildCases: Array<[string, Record<string, unknown>, string]> = [
    [
      'a charge without an id',
      { charges: [{ name: 'Reach' }] },
      'invalid-child-id',
    ],
    [
      'a charge id over 255 characters',
      { charges: [{ id: 'c'.repeat(256) }] },
      'invalid-child-id',
    ],
    [
      'repeated charge ids',
      { charges: [{ id: 'charge-1' }, { id: 'charge-1' }] },
      'duplicate-child-id',
    ],
    [
      'an ability id that is not a string',
      { chargePool: { abilities: [{ id: 9 }] } },
      'invalid-child-id',
    ],
    [
      'an ability entry that is not an object',
      { chargePool: { abilities: [null] } },
      'invalid-item',
    ],
  ];

  it.each(invalidChildCases)('rejects %s', (_label, overrides, kind) => {
    expect(validateMagicItemPayload(payloadWith(overrides))).toMatchObject({
      ok: false,
      kind,
    });
  });

  const acceptedCases: Array<[string, Record<string, unknown>]> = [
    ['null attunement flags', { isAttuned: null, isEquipped: null }],
    ['null spell bonuses', { bonusSpellAttack: null, bonusSpellSaveDc: null }],
    [
      'null child collections',
      { charges: null, chargePool: null, legacyCharges: null },
    ],
    [
      'a homebrew category and rarity',
      { category: 'homebrew relic', rarity: 'mythic' },
    ],
    [
      'boundary-length labels',
      {
        name: 'n'.repeat(1000),
        category: 'c'.repeat(100),
        rarity: 'r'.repeat(100),
      },
    ],
    [
      'an empty description and no properties',
      { description: '', properties: [] },
    ],
  ];

  it.each(acceptedCases)('accepts %s', (_label, overrides) => {
    expect(validateMagicItemPayload(payloadWith(overrides))).toMatchObject({
      ok: true,
    });
  });

  it('sorts blockers deterministically by canonical JSON', async () => {
    // Discovery order is unclassified-field then duplicate-id; canonical JSON
    // sorting compares `detail` first, so the emitted order is the reverse.
    const manifest = await build([item({ secretNotes: 'hidden' }), item()]);

    expect(kinds(manifest)).toEqual(['duplicate-id', 'unclassified-field']);
    const details = manifest.blockers.map(blocker => blocker.detail);
    expect(details).toEqual([
      'Duplicate magic item ID magic-1',
      'Magic item field secretNotes is not classified in Slice 11C',
    ]);
    expect(details).toEqual([...details].sort());
  });
});
