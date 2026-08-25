import { describe, expect, it } from 'vitest';

import { sha256Bytes } from '@/lib/indexeddb/migrationCapture';
import type {
  CombatLogEvent,
  CombatLogState,
  DamageEvent,
} from '@/types/combatLog';

import {
  buildCombatLogArchiveManifest,
  buildCombatLogArchiveWorkingCopyManifest,
  canonicalJson,
  combatLogArchiveFromPayload,
  combatLogArchivePayloadFrom,
  COMBAT_LOG_ARCHIVE_FAMILY,
  COMBAT_LOG_ARCHIVE_FAMILY_INVENTORY,
  COMBAT_LOG_ARCHIVE_MAX_ITEMS,
  COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES,
  COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES,
  COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
  fingerprintCombatLogArchivePayload,
  fingerprintCombatLogArchiveTombstone,
  registeredDurableDmFamilies,
  validateCombatLogArchivePayload,
  type CombatLogArchivePayload,
} from './combatLogArchiveFamily';

// ── Fixtures ───────────────────────────────────────────────────────────────

const CAMPAIGN = 'SYNTH1';
const ENC_A = 'enc-a';

const damageEvent = (
  id: string,
  overrides: Record<string, unknown> = {}
): DamageEvent =>
  ({
    id,
    timestamp: '2026-01-01T00:00:00.000Z',
    round: 1,
    turn: 0,
    encounterId: ENC_A,
    type: 'damage',
    sourceId: 'ent-1',
    sourceName: 'Cultist',
    targetId: 'ent-2',
    targetName: 'Aria',
    amount: 7,
    damageType: 'slashing',
    ...overrides,
  }) as DamageEvent;

const turnEvent = (id: string): CombatLogEvent => ({
  id,
  timestamp: '2026-01-01T00:00:01.000Z',
  round: 1,
  turn: 1,
  encounterId: ENC_A,
  type: 'turn_start',
  entityId: 'ent-1',
  entityName: 'Cultist',
});

/** A closed archive payload: `endedAt` present. */
const archivePayload = (
  overrides: Partial<CombatLogArchivePayload> = {}
): CombatLogArchivePayload => {
  const encounterId = overrides.encounterId ?? ENC_A;
  return {
    encounterId,
    events: [
      { ...damageEvent('evt-1'), encounterId },
      { ...turnEvent('evt-2'), encounterId },
    ],
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: '2026-01-01T00:10:00.000Z',
    ...overrides,
  };
};

/** Ruling 3: an archive that is still open — no `endedAt`. */
const activeArchivePayload = (): CombatLogArchivePayload => {
  const payload = archivePayload();
  delete payload.endedAt;
  return payload;
};

type SeedArchive = { archiveId: string } & Record<string, unknown>;

const endedArchive = (
  overrides: Record<string, unknown> = {}
): SeedArchive => ({
  archiveId: 'arc-1',
  campaignCode: CAMPAIGN,
  ...archivePayload(),
  ...overrides,
});

const activeArchive = (
  overrides: Record<string, unknown> = {}
): SeedArchive => {
  const archive = endedArchive(overrides);
  delete archive.endedAt;
  return archive;
};

const seedEnvelope = (
  archives: SeedArchive[],
  tombstones: Record<string, unknown> = {},
  version = 2
) =>
  JSON.stringify({
    state: {
      encounters: Object.fromEntries(
        archives.map(({ archiveId, ...rest }) => [archiveId, rest])
      ),
      combatLogTombstones: tombstones,
      activeArchiveId: 'arc-1',
    },
    version,
  });

const build = (
  archives: SeedArchive[],
  tombstones: Record<string, unknown> = {},
  version = 2
) =>
  buildCombatLogArchiveManifest({
    campaignCode: CAMPAIGN,
    rawEnvelope: seedEnvelope(archives, tombstones, version),
  });

const kinds = (manifest: { blockers: Array<{ kind: string }> }) =>
  manifest.blockers.map(blocker => blocker.kind);

/** Canonical UTF-8 bytes of a payload, exactly as the manifest measures them. */
const payloadBytes = (payload: CombatLogArchivePayload) =>
  new TextEncoder().encode(canonicalJson(payload)).byteLength;

/** The validator's own bound on a single text field — the padding knob. */
const PAD_MAX = 1_000;

/**
 * A payload of *exactly* `targetBytes` canonical UTF-8 bytes. Event ids are
 * fixed-width, so one extra `x` in `weaponOrSpellName` costs exactly one byte.
 * Coarse-fills with maximum-width pads, drops one, then lands the remainder on
 * two tunable events — which always span it, because dropping one coarse event
 * frees more room than two pads can hold.
 */
function payloadOfExactBytes(targetBytes: number): CombatLogArchivePayload {
  const payload = archivePayload();
  payload.events = [];
  const padEvent = (pad: number) =>
    damageEvent(`pad-${String(payload.events.length).padStart(6, '0')}`, {
      weaponOrSpellName: 'x'.repeat(pad),
    });
  // Marginal cost of one *additional* pad event (the first also pays no comma).
  payload.events.push(padEvent(PAD_MAX));
  const before = payloadBytes(payload);
  payload.events.push(padEvent(PAD_MAX));
  const overhead = payloadBytes(payload) - before - PAD_MAX;

  while (payloadBytes(payload) + overhead + PAD_MAX <= targetBytes)
    payload.events.push(padEvent(PAD_MAX));
  payload.events.pop();

  const rest = targetBytes - payloadBytes(payload) - 2 * overhead;
  const first = Math.min(PAD_MAX, rest);
  payload.events.push(padEvent(first));
  payload.events.push(padEvent(rest - first));

  const actual = payloadBytes(payload);
  if (actual !== targetBytes)
    throw new Error(`fixture missed its target: ${actual} != ${targetBytes}`);
  return payload;
}

const archiveOfExactBytes = (
  archiveId: string,
  targetBytes: number
): SeedArchive => ({
  archiveId,
  campaignCode: CAMPAIGN,
  ...payloadOfExactBytes(targetBytes),
});

/** Archives whose canonical byte counts sum to exactly `totalBytes`. */
function archivesTotallingExactly(totalBytes: number): SeedArchive[] {
  const chunk = 150_000;
  const archives: SeedArchive[] = [];
  let remaining = totalBytes;
  while (remaining > chunk + 10_000) {
    archives.push(archiveOfExactBytes(`arc-${archives.length}`, chunk));
    remaining -= chunk;
  }
  archives.push(archiveOfExactBytes(`arc-${archives.length}`, remaining));
  return archives;
}

const otherCampaignArchive: SeedArchive = {
  archiveId: 'arc-other',
  campaignCode: 'OTHER1',
  ...archivePayload(),
};

const unscopedArchive: SeedArchive = {
  archiveId: 'arc-unscoped',
  ...archivePayload(),
};

const deletedTombstone = {
  legacyId: 'arc-deleted',
  deletedAt: '2026-01-05T00:00:00.000Z',
  beforeImage: {
    campaignCode: CAMPAIGN,
    ...archivePayload(),
  },
};

const otherCampaignTombstone = {
  legacyId: 'arc-other-deleted',
  deletedAt: '2026-01-05T00:00:00.000Z',
  beforeImage: {
    campaignCode: 'OTHER1',
    ...archivePayload(),
  },
};

describe('Slice 11F combat log archive family', () => {
  it('registers combat_log_archive last', () => {
    expect(registeredDurableDmFamilies).toEqual([
      'campaign_settings',
      'calendar',
      'magic_item',
      'npc',
      'encounter_definition',
      'combat_log_archive',
    ]);
  });

  it('declares the family constants and the classification inventory', () => {
    expect(COMBAT_LOG_ARCHIVE_FAMILY).toBe('combat_log_archive');
    expect(COMBAT_LOG_ARCHIVE_PERSIST_VERSION).toBe(2);
    expect(COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES).toBe(262_144);
    expect(COMBAT_LOG_ARCHIVE_MAX_ITEMS).toBe(2_000);
    expect(COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES).toBe(5_242_880);
    expect(COMBAT_LOG_ARCHIVE_FAMILY_INVENTORY).toMatchObject({
      family: 'combat_log_archive',
      localStorageKeys: ['rollkeeper-combat-log'],
      persistenceVersions: { 'rollkeeper-combat-log': 2 },
      stableIdentity: 'encounters[<archiveId>] (campaignCode-scoped)',
      stableChildIdentity: ['events[].id'],
      completeEnvelopeFields: ['encounters', 'combatLogTombstones'],
      excludedEnvelopeFields: ['activeArchiveId', 'lastAdmissionError'],
      documentFields: ['encounterId', 'events', 'startedAt', 'endedAt'],
      privateFields: ['*'],
      publicFields: [],
      // Ruling 8 — DM-private: no projection, no Redis kinds.
      typedCrossFamilyReferences: ['encounterId → encounter_definition'],
      redisProjectionKinds: [],
      projection: 'not-applicable',
      excludedFamilies: expect.arrayContaining([
        'campaign_settings',
        'calendar',
        'magic_item',
        'npc',
        'encounter_definition',
        'battle_map',
      ]),
    });
    expect(COMBAT_LOG_ARCHIVE_FAMILY_INVENTORY.excludedFamilies).not.toContain(
      'combat_log_archive'
    );
  });

  it('captures the campaign slice as sorted records, ignoring unscoped and other-campaign data', async () => {
    const manifest = await build(
      [
        endedArchive({ archiveId: 'arc-b' }),
        endedArchive({ archiveId: 'arc-a' }),
        otherCampaignArchive,
        unscopedArchive,
      ],
      {
        [deletedTombstone.legacyId]: deletedTombstone,
        [otherCampaignTombstone.legacyId]: otherCampaignTombstone,
      }
    );

    expect(manifest.blockers).toEqual([]);
    expect(manifest.format).toBe('rollkeeper-combat-log-archive-manifest');
    expect(manifest.version).toBe(1);
    expect(manifest.family).toBe('combat_log_archive');
    expect(manifest.campaignCode).toBe(CAMPAIGN);
    expect(manifest.recordCount).toBe(3);
    expect(manifest.records.map(entry => entry.legacyId)).toEqual([
      'arc-a',
      'arc-b',
      'arc-deleted',
    ]);
    expect(manifest.records[0].payload).not.toHaveProperty('campaignCode');
    expect(manifest.records[0].payload).toMatchObject({
      encounterId: ENC_A,
      startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: '2026-01-01T00:10:00.000Z',
      events: [
        expect.objectContaining({ id: 'evt-1', type: 'damage' }),
        expect.objectContaining({ id: 'evt-2', type: 'turn_start' }),
      ],
    });
    const tombstoneRecord = manifest.records[2];
    expect(tombstoneRecord.tombstoned).toBe(true);
    expect(tombstoneRecord.payload).toBeNull();
    expect(tombstoneRecord.payloadFingerprint).toBe(
      await fingerprintCombatLogArchiveTombstone('arc-deleted')
    );
    expect(manifest.records[0].payloadFingerprint).toBe(
      await fingerprintCombatLogArchivePayload(manifest.records[0].payload!)
    );
    expect(manifest.totalBytes).toBe(
      manifest.records.reduce((total, entry) => total + entry.byteCount, 0)
    );
    expect(manifest.rawCandidates).toHaveLength(1);
    expect(manifest.rawCandidates[0].sourceKey).toBe('rollkeeper-combat-log');
  });

  it('fingerprints deterministically and changes when an event changes', async () => {
    const first = await build([endedArchive()]);
    const second = await build([endedArchive()]);
    const changed = await build([
      endedArchive({
        events: [{ ...damageEvent('evt-1'), amount: 9 }, turnEvent('evt-2')],
      }),
    ]);

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(changed.fingerprint).not.toBe(first.fingerprint);
  });

  it('treats an absent campaign as valid with zero records', async () => {
    const manifest = await buildCombatLogArchiveManifest({
      campaignCode: 'ZZZ999',
      rawEnvelope: seedEnvelope([endedArchive()]),
    });

    expect(manifest.records).toEqual([]);
    expect(manifest.blockers).toEqual([]);
    expect(manifest.recordCount).toBe(0);
    expect(manifest.totalBytes).toBe(0);
  });

  it('blocks an envelope that has never been persisted', async () => {
    const manifest = await buildCombatLogArchiveManifest({
      campaignCode: CAMPAIGN,
      rawEnvelope: '',
    });

    expect(kinds(manifest)).toEqual(['incomplete-envelope']);
    expect(manifest.blockers[0].detail).toBe(
      'rollkeeper-combat-log has never been persisted on this browser'
    );
    expect(manifest.blockers[0].legacyId).toBeNull();
  });

  it('blocks malformed JSON and incomplete envelopes', async () => {
    const malformed = await buildCombatLogArchiveManifest({
      campaignCode: CAMPAIGN,
      rawEnvelope: '{not json',
    });
    const incomplete = await buildCombatLogArchiveManifest({
      campaignCode: CAMPAIGN,
      rawEnvelope: JSON.stringify({ state: {} }),
    });
    const notARecord = await buildCombatLogArchiveManifest({
      campaignCode: CAMPAIGN,
      rawEnvelope: JSON.stringify({
        state: { encounters: [] },
        version: 2,
      }),
    });
    const badTombstones = await buildCombatLogArchiveManifest({
      campaignCode: CAMPAIGN,
      rawEnvelope: JSON.stringify({
        state: { encounters: {}, combatLogTombstones: 'nope' },
        version: 2,
      }),
    });

    expect(kinds(malformed)).toEqual(['malformed-json']);
    expect(kinds(incomplete)).toEqual(['incomplete-envelope']);
    expect(kinds(notARecord)).toEqual(['incomplete-envelope']);
    expect(notARecord.records).toEqual([]);
    expect(kinds(badTombstones)).toEqual(['incomplete-envelope']);
  });

  it('blocks future and legacy persistence versions', async () => {
    const future = await build([endedArchive()], {}, 3);
    const legacy = await build([endedArchive()], {}, 1);
    const missing = await buildCombatLogArchiveManifest({
      campaignCode: CAMPAIGN,
      rawEnvelope: JSON.stringify({ state: { encounters: {} } }),
    });

    expect(kinds(future)).toEqual(['future-schema']);
    expect(future.blockers[0].detail).toContain('3');
    expect(future.records).toEqual([]);
    expect(kinds(legacy)).toEqual(['legacy-schema']);
    expect(legacy.blockers[0].detail).toBe(
      'rollkeeper-combat-log is persisted at version 1; the combat log store migration must upgrade it to version 2 before preview'
    );
    expect(legacy.records).toEqual([]);
    expect(kinds(missing)).toEqual(['legacy-schema']);
    expect(missing.records).toEqual([]);
  });

  it('quarantines an archive with no stable archive id', async () => {
    const manifest = await build([endedArchive({ archiveId: '' })]);

    expect(kinds(manifest)).toEqual(['invalid-archive-id']);
    expect(manifest.blockers[0].legacyId).toBeNull();
    expect(manifest.records).toEqual([]);
  });

  it('quarantines unclassified fields and invalid archive shapes', async () => {
    const unclassified = await build([
      endedArchive({ secretNotes: 'the twist' }),
    ]);
    expect(kinds(unclassified)).toEqual(['unclassified-field']);
    expect(unclassified.blockers[0].detail).toContain('secretNotes');
    expect(unclassified.blockers[0].legacyId).toBe('arc-1');
    expect(unclassified.records).toEqual([]);

    const invalidStartedAt = await build([endedArchive({ startedAt: 42 })]);
    expect(kinds(invalidStartedAt)).toEqual(['invalid-archive']);
    expect(invalidStartedAt.records).toEqual([]);
  });

  // ── Ruling 3 — active archives are durable documents ─────────────────────

  it('blocks cutover on an archive with no endedAt', async () => {
    const manifest = await buildCombatLogArchiveManifest({
      campaignCode: CAMPAIGN,
      rawEnvelope: seedEnvelope([activeArchive()]),
    });
    expect(manifest.blockers).toContainEqual(
      expect.objectContaining({ kind: 'active-combat-log' })
    );
  });

  it('still emits the record for an archive with no endedAt', async () => {
    const manifest = await buildCombatLogArchiveManifest({
      campaignCode: CAMPAIGN,
      rawEnvelope: seedEnvelope([activeArchive()]),
    });
    expect(manifest.records).toHaveLength(1);
    expect(manifest.records[0].payload).not.toHaveProperty('endedAt');
    expect(manifest.blockers[0].legacyId).toBe('arc-1');
    expect(manifest.blockers[0].detail).toBe(
      'Combat log archive arc-1 is still open; end the combat log before turning on backup'
    );
  });

  it('does NOT block a working-copy manifest on an archive with no endedAt', async () => {
    const source = await buildCombatLogArchiveManifest({
      campaignCode: CAMPAIGN,
      rawEnvelope: seedEnvelope([endedArchive()]),
    });
    const working = await buildCombatLogArchiveWorkingCopyManifest({
      source,
      documents: [
        {
          legacyId: 'arc-1',
          payload: activeArchivePayload(),
          schemaVersion: 2,
          tombstoned: false,
        },
      ],
    });
    expect(working.blockers).toEqual([]);
  });

  it('does not block cutover on a closed archive', async () => {
    const manifest = await build([endedArchive()]);
    expect(manifest.blockers).toEqual([]);
  });

  // ── Validation ───────────────────────────────────────────────────────────

  it('rejects an event whose encounterId disagrees with the document', () => {
    const payload = archivePayload({ encounterId: 'enc-a' });
    payload.events[0].encounterId = 'enc-b';
    expect(validateCombatLogArchivePayload(payload)).toMatchObject({
      ok: false,
      kind: 'invalid-archive',
    });
  });

  it('rejects duplicate event ids', () => {
    const payload = archivePayload();
    payload.events = [damageEvent('evt-1'), damageEvent('evt-1')];
    expect(validateCombatLogArchivePayload(payload)).toMatchObject({
      ok: false,
      kind: 'duplicate-child-id',
    });
  });

  it('rejects a missing event id', () => {
    const payload = archivePayload();
    delete (payload.events[0] as { id?: string }).id;
    expect(validateCombatLogArchivePayload(payload)).toMatchObject({
      ok: false,
      kind: 'invalid-child-id',
    });
  });

  it('rejects a non-finite numeric field', () => {
    const payload = archivePayload();
    (payload.events[0] as { amount: number }).amount = Number.POSITIVE_INFINITY;
    expect(validateCombatLogArchivePayload(payload)).toMatchObject({
      ok: false,
      kind: 'invalid-archive',
    });
  });

  it('rejects a field that does not belong to the event discriminator', () => {
    const payload = archivePayload();
    // `as unknown as` is required by tsc: the union members have no index signature.
    (payload.events[0] as unknown as Record<string, unknown>).spellName =
      'Fireball';
    expect(validateCombatLogArchivePayload(payload)).toMatchObject({
      ok: false,
      kind: 'unclassified-field',
    });
  });

  // ── Prototype keys must not slip past the per-event allowlist ──────────

  it.each([
    'toString',
    'constructor',
    'valueOf',
    'hasOwnProperty',
    '__proto__',
  ])('rejects %s as an invented event discriminator', type => {
    const payload = archivePayload();
    payload.events = [
      {
        id: 'evt-1',
        timestamp: '2026-01-01T00:00:00.000Z',
        round: 1,
        turn: 0,
        encounterId: ENC_A,
        type,
      } as unknown as CombatLogEvent,
    ];
    expect(validateCombatLogArchivePayload(payload)).toMatchObject({
      ok: false,
      kind: 'invalid-archive',
    });
  });

  it.each(['toString', 'constructor', 'valueOf', 'hasOwnProperty'])(
    'rejects %s as an extra field on a legitimate event',
    field => {
      const payload = archivePayload();
      payload.events = [damageEvent('evt-1', { [field]: 'smuggled' })];
      expect(validateCombatLogArchivePayload(payload)).toMatchObject({
        ok: false,
        kind: 'unclassified-field',
      });
    }
  );

  it('quarantines the __proto__ own key that JSON.parse creates', async () => {
    // Written as raw JSON: an object literal would set the prototype instead of
    // creating an own key, which is exactly the case `in` fails to catch.
    const event =
      '{"id":"evt-1","timestamp":"2026-01-01T00:00:00.000Z","round":1,"turn":0,' +
      '"encounterId":"enc-a","type":"damage","sourceId":"ent-1","sourceName":"Cultist",' +
      '"targetId":"ent-2","targetName":"Aria","amount":7,"damageType":"slashing",' +
      '"__proto__":{"polluted":true}}';
    const rawEnvelope =
      '{"state":{"encounters":{"arc-1":{"campaignCode":"SYNTH1",' +
      '"encounterId":"enc-a","startedAt":"2026-01-01T00:00:00.000Z",' +
      `"endedAt":"2026-01-01T00:10:00.000Z","events":[${event}]}},` +
      '"combatLogTombstones":{},"activeArchiveId":null},"version":2}';
    expect(
      Object.hasOwn(
        JSON.parse(rawEnvelope).state.encounters['arc-1'].events[0],
        '__proto__'
      )
    ).toBe(true);

    const manifest = await buildCombatLogArchiveManifest({
      campaignCode: CAMPAIGN,
      rawEnvelope,
    });

    expect(kinds(manifest)).toEqual(['unclassified-field']);
    expect(manifest.blockers[0].detail).toContain('__proto__');
    expect(manifest.records).toEqual([]);
  });

  it('accepts an archive with no endedAt', () => {
    const payload = archivePayload();
    delete payload.endedAt;
    expect(validateCombatLogArchivePayload(payload).ok).toBe(true);
  });

  it('rejects a payload that is not a JSON object', () => {
    for (const value of ['not an object', 42, null, undefined, [], true])
      expect(validateCombatLogArchivePayload(value)).toMatchObject({
        ok: false,
        kind: 'invalid-archive',
      });
  });

  const invalidArchiveCases: Array<[string, Record<string, unknown>]> = [
    ['an absent encounterId', { encounterId: undefined }],
    ['an empty encounterId', { encounterId: '' }],
    ['an encounterId over 255 bytes', { encounterId: 'x'.repeat(256) }],
    ['an absent startedAt', { startedAt: undefined }],
    ['an empty startedAt', { startedAt: '' }],
    ['a non-string startedAt', { startedAt: 1_700_000_000 }],
    ['a non-string endedAt', { endedAt: 17 }],
    ['events that are not an array', { events: {} }],
  ];

  it.each(invalidArchiveCases)(
    'rejects %s as an invalid archive',
    (_label, overrides) => {
      expect(
        validateCombatLogArchivePayload({ ...archivePayload(), ...overrides })
      ).toMatchObject({ ok: false });
    }
  );

  const invalidEventCases: Array<[string, Record<string, unknown>]> = [
    ['an unknown event type', { type: 'gossip' }],
    ['a missing discriminator', { type: undefined }],
    ['a non-string timestamp', { timestamp: 9 }],
    ['a non-finite round', { round: Number.NaN }],
    ['a string turn', { turn: '2' }],
    ['a required field that is absent', { targetName: undefined }],
    ['a required id field that is empty', { sourceId: '' }],
    ['a non-boolean optional flag', { isCritical: 'yes' }],
    ['an over-long optional name', { weaponOrSpellName: 'x'.repeat(1_001) }],
  ];

  it.each(invalidEventCases)(
    'rejects an event with %s',
    (_label, overrides) => {
      const payload = archivePayload();
      payload.events = [damageEvent('evt-1', overrides)];
      expect(validateCombatLogArchivePayload(payload)).toMatchObject({
        ok: false,
      });
    }
  );

  it('rejects an out-of-union value on an enumerated event field', () => {
    const payload = archivePayload();
    payload.events = [
      {
        id: 'evt-1',
        timestamp: '2026-01-01T00:00:00.000Z',
        round: 1,
        turn: 0,
        encounterId: ENC_A,
        type: 'ability_use',
        userId: 'ent-1',
        userName: 'Cultist',
        abilityName: 'Tail Swipe',
        abilityType: 'cantrip',
      } as unknown as CombatLogEvent,
    ];
    expect(validateCombatLogArchivePayload(payload)).toMatchObject({
      ok: false,
    });
  });

  it('accepts every event discriminator in the union', () => {
    const base = {
      timestamp: '2026-01-01T00:00:00.000Z',
      round: 1,
      turn: 0,
      encounterId: ENC_A,
    };
    const events = [
      damageEvent('evt-damage'),
      {
        ...base,
        id: 'evt-healing',
        type: 'healing',
        sourceId: 'ent-1',
        sourceName: 'Cleric',
        targetId: 'ent-2',
        targetName: 'Aria',
        amount: 5,
        actualHealing: 4,
      },
      {
        ...base,
        id: 'evt-cond-on',
        type: 'condition_applied',
        targetId: 'ent-2',
        targetName: 'Aria',
        conditionName: 'Prone',
      },
      {
        ...base,
        id: 'evt-cond-off',
        type: 'condition_removed',
        targetId: 'ent-2',
        targetName: 'Aria',
        conditionName: 'Prone',
      },
      turnEvent('evt-turn-on'),
      {
        ...base,
        id: 'evt-turn-off',
        type: 'turn_end',
        entityId: 'ent-1',
        entityName: 'Cultist',
      },
      {
        ...base,
        id: 'evt-spell',
        type: 'spell_cast',
        casterId: 'ent-1',
        casterName: 'Cultist',
        spellName: 'Fireball',
        spellLevel: 3,
        slotUsed: 3,
        isConcentration: false,
      },
      {
        ...base,
        id: 'evt-ability',
        type: 'ability_use',
        userId: 'ent-1',
        userName: 'Cultist',
        abilityName: 'Tail Swipe',
        abilityType: 'legendary_action',
        legendaryActionCost: 1,
      },
      { ...base, id: 'evt-round-on', type: 'round_start', roundNumber: 1 },
      { ...base, id: 'evt-round-off', type: 'round_end', roundNumber: 1 },
      {
        ...base,
        id: 'evt-combat-on',
        type: 'combat_start',
        participantNames: ['Aria', 'Cultist'],
      },
      {
        ...base,
        id: 'evt-combat-off',
        type: 'combat_end',
        participantNames: ['Aria'],
        endReason: 'victory',
      },
      {
        ...base,
        id: 'evt-unconscious',
        type: 'unconscious',
        entityId: 'ent-2',
        entityName: 'Aria',
      },
      {
        ...base,
        id: 'evt-death',
        type: 'death',
        entityId: 'ent-2',
        entityName: 'Aria',
      },
      {
        ...base,
        id: 'evt-revived',
        type: 'revived',
        entityId: 'ent-2',
        entityName: 'Aria',
      },
      {
        ...base,
        id: 'evt-stabilized',
        type: 'stabilized',
        entityId: 'ent-2',
        entityName: 'Aria',
      },
    ] as unknown as CombatLogEvent[];

    expect(
      validateCombatLogArchivePayload({ ...archivePayload(), events })
    ).toMatchObject({ ok: true });
  });

  it('accepts an empty events array and a boundary-length name', () => {
    expect(
      validateCombatLogArchivePayload({ ...archivePayload(), events: [] })
    ).toMatchObject({ ok: true });
    const payload = archivePayload();
    payload.events = [damageEvent('evt-1', { sourceName: 'n'.repeat(1_000) })];
    expect(validateCombatLogArchivePayload(payload)).toMatchObject({
      ok: true,
    });
  });

  it('measures string bounds in UTF-8 bytes, not code units', () => {
    // 400 astral code points = 800 UTF-16 units but 1,600 UTF-8 bytes.
    const payload = archivePayload();
    payload.events = [damageEvent('evt-1', { sourceName: '𝄞'.repeat(400) })];
    expect(validateCombatLogArchivePayload(payload)).toMatchObject({
      ok: false,
    });
  });

  // ── Manifest-time limits ─────────────────────────────────────────────────

  it('reports oversized-record only past the record byte bound', async () => {
    const atBound = await build([
      archiveOfExactBytes('arc-1', COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES),
    ]);
    const overBound = await build([
      archiveOfExactBytes('arc-1', COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES + 1),
    ]);

    // A record *at* the cap is admitted; one byte more is not.
    expect(atBound.records[0].byteCount).toBe(
      COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES
    );
    expect(kinds(atBound)).toEqual([]);
    expect(overBound.records[0].byteCount).toBe(
      COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES + 1
    );
    expect(kinds(overBound)).toEqual(['oversized-record']);
    expect(overBound.blockers[0].legacyId).toBe('arc-1');
    expect(overBound.records).toHaveLength(1);
  });

  it('reports too-many-records only past the item bound', async () => {
    const archives = (count: number) =>
      Array.from({ length: count }, (_unused, index) =>
        endedArchive({ archiveId: `arc-${index}`, events: [] })
      );
    const atBound = await build(archives(COMBAT_LOG_ARCHIVE_MAX_ITEMS));
    const overBound = await build(archives(COMBAT_LOG_ARCHIVE_MAX_ITEMS + 1));

    expect(kinds(atBound)).toEqual([]);
    expect(atBound.recordCount).toBe(COMBAT_LOG_ARCHIVE_MAX_ITEMS);
    expect(kinds(overBound)).toEqual(['too-many-records']);
    expect(overBound.blockers[0].legacyId).toBeNull();
    expect(overBound.recordCount).toBe(COMBAT_LOG_ARCHIVE_MAX_ITEMS + 1);
  });

  it('reports oversized-family only past the total byte bound', async () => {
    const atBound = await build(
      archivesTotallingExactly(COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES)
    );
    const overBound = await build(
      archivesTotallingExactly(COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES + 1)
    );

    // A family *at* the cap is admitted; one byte more is not.
    expect(atBound.totalBytes).toBe(COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES);
    expect(kinds(atBound)).toEqual([]);
    expect(overBound.totalBytes).toBe(COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES + 1);
    expect(kinds(overBound)).toEqual(['oversized-family']);
    expect(overBound.blockers[0].legacyId).toBeNull();
    // Neither the per-record nor the item bound is what fired here.
    expect(overBound.recordCount).toBeLessThanOrEqual(
      COMBAT_LOG_ARCHIVE_MAX_ITEMS
    );
    for (const entry of overBound.records)
      expect(entry.byteCount).toBeLessThanOrEqual(
        COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES
      );
  });

  // ── Tombstones ───────────────────────────────────────────────────────────

  it('quarantines invalid tombstones and flags a tombstone that is also live', async () => {
    const invalidTombstone = await build([], {
      'arc-x': { legacyId: 'arc-x', deletedAt: '2026-01-01T00:00:00.000Z' },
    });
    const tombstonedAndLive = await build([endedArchive()], {
      'arc-1': {
        legacyId: 'arc-1',
        deletedAt: '2026-01-01T00:00:00.000Z',
        beforeImage: { campaignCode: CAMPAIGN, ...archivePayload() },
      },
    });

    expect(kinds(invalidTombstone)).toEqual(['invalid-tombstone']);
    expect(invalidTombstone.blockers[0].legacyId).toBe('arc-x');
    expect(kinds(tombstonedAndLive)).toEqual(['tombstoned-and-live']);
  });

  it('fingerprints tombstones over the canonical tombstone document', async () => {
    expect(await fingerprintCombatLogArchiveTombstone('arc-1')).toBe(
      await sha256Bytes('{"legacyId":"arc-1","tombstoned":true}')
    );
  });

  // ── Round-trip and working copies ────────────────────────────────────────

  it('round-trips payloads to and from archives', () => {
    const source: CombatLogState = {
      campaignCode: CAMPAIGN,
      ...archivePayload(),
    };
    const payload = combatLogArchivePayloadFrom(source);

    expect(payload).not.toHaveProperty('campaignCode');
    expect(combatLogArchiveFromPayload(CAMPAIGN, 'arc-1', payload)).toEqual(
      source
    );
  });

  it('builds a working copy manifest with tombstoned documents', async () => {
    const source = await build([
      endedArchive({ archiveId: 'arc-a' }),
      endedArchive({ archiveId: 'arc-b' }),
    ]);
    const payload = archivePayload({ encounterId: 'enc-renamed' });
    payload.events = payload.events.map(event => ({
      ...event,
      encounterId: 'enc-renamed',
    }));
    const working = await buildCombatLogArchiveWorkingCopyManifest({
      source,
      documents: [
        { legacyId: 'arc-a', payload, schemaVersion: 2, tombstoned: false },
        {
          legacyId: 'arc-b',
          payload: null,
          schemaVersion: 2,
          tombstoned: true,
        },
      ],
    });

    expect(working.blockers).toEqual([]);
    expect(working.recordCount).toBe(2);
    expect(working.records[0]).toMatchObject({
      legacyId: 'arc-a',
      tombstoned: false,
    });
    expect(working.records[0].payload).toMatchObject({
      encounterId: 'enc-renamed',
    });
    expect(working.records[1]).toMatchObject({
      legacyId: 'arc-b',
      tombstoned: true,
      payload: null,
    });
    expect(working.records[1].payloadFingerprint).toBe(
      await fingerprintCombatLogArchiveTombstone('arc-b')
    );
    expect(working.rawCandidates).toEqual(source.rawCandidates);
    expect(working.fingerprint).not.toBe(source.fingerprint);
  });

  it('refuses working copies built from unvalidated sources or documents', async () => {
    const blocked = await buildCombatLogArchiveManifest({
      campaignCode: CAMPAIGN,
      rawEnvelope: '',
    });
    const source = await build([endedArchive()]);
    const payload = archivePayload();

    await expect(
      buildCombatLogArchiveWorkingCopyManifest({
        source: blocked,
        documents: [
          { legacyId: 'arc-1', payload, schemaVersion: 2, tombstoned: false },
        ],
      })
    ).rejects.toThrow(
      'A validated combat log archive source manifest is required'
    );

    await expect(
      buildCombatLogArchiveWorkingCopyManifest({
        source,
        documents: [
          { legacyId: 'arc-1', payload, schemaVersion: 1, tombstoned: false },
        ],
      })
    ).rejects.toThrow('schema version 2');

    await expect(
      buildCombatLogArchiveWorkingCopyManifest({
        source,
        documents: [
          {
            legacyId: 'arc-1',
            payload: { ...payload, startedAt: '' },
            schemaVersion: 2,
            tombstoned: false,
          },
        ],
      })
    ).rejects.toThrow('arc-1');
  });

  it('sorts blockers deterministically by canonical JSON', async () => {
    const manifest = await build([
      activeArchive({ archiveId: 'arc-a' }),
      endedArchive({ archiveId: 'arc-b', secretNotes: 'hidden' }),
    ]);

    expect(kinds(manifest)).toEqual([
      'active-combat-log',
      'unclassified-field',
    ]);
    const details = manifest.blockers.map(blocker => blocker.detail);
    expect(details).toEqual([...details].sort());
  });

  // ── Canonical JSON ───────────────────────────────────────────────────────

  it('sorts object keys recursively and preserves array order', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, 1, 2], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[3,1,2]},"b":1}'
    );
    expect(canonicalJson({ endedAt: undefined, a: 1 })).toBe('{"a":1}');
  });
});
