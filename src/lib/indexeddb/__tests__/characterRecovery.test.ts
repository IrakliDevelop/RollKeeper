import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import { captureDeviceBackup } from '@/lib/deviceRecovery';
import {
  activateImportedCharacterGeneration,
  importCharacterRecoveryGeneration,
  inspectCharacterRecoveryBundle,
  inspectPlayerBackupSafetyFile,
  stageCharacterRecoveryFromSerialized,
  verifyActivatedCharacterRecovery,
  visibleCharactersMatchRecovery,
} from '@/lib/indexeddb/characterRecovery';
import {
  commitCharacterCutover,
  readCharacterActivationEvidence,
  readCharacterAuthority,
} from '@/lib/indexeddb/characterAuthority';
import {
  readCharacterCutoverSelection,
  repairRecoveredCharacterSelectionFromEvidence,
} from '@/lib/indexeddb/characterCutoverSelection';
import {
  DATABASE_NAME,
  deleteRollkeeperDatabaseForTests,
  openExistingRollkeeperDatabase,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

async function seedActive(database: IDBDatabase, raw: string) {
  const tx = database.transaction(['meta', 'kvGenerations'], 'readwrite');
  tx.objectStore('meta').put({
    key: 'migration-state:guest:character',
    state: 'CUTOVER_READY',
    runId: 'active',
    checkpointAt: 'before',
  });
  tx.objectStore('kvGenerations').put({
    namespace: 'guest',
    generation: 'active',
    key: 'rollkeeper-player-data',
    presence: true,
    rawValue: raw,
  });
  await transactionComplete(tx);
  await commitCharacterCutover(database, {
    namespace: 'guest',
    generation: 'active',
    confirmed: true,
    now: () => 'active',
    gates: {
      recoveryReceipt: true,
      sourceManifestUnchanged: true,
      captureVerifiedAfterReopen: true,
      noQuarantine: true,
      parity: true,
      journalEmpty: true,
    },
  });
}

describe('post-cutover character recovery', () => {
  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  async function expectLocalDatabaseAbsent() {
    await new Promise(resolve => setTimeout(resolve, 0));
    await expect(indexedDB.databases()).resolves.not.toContainEqual(
      expect.objectContaining({ name: DATABASE_NAME })
    );
    await expect(
      openExistingRollkeeperDatabase({ factory: indexedDB })
    ).resolves.toBeNull();
  }

  it('inspects invalid JSON, shape, checksum, aggregate, empty-character, and duplicate keys without creating the database', async () => {
    const invalid = [
      ['not-json', 'invalid-json'],
      [JSON.stringify({ format: 'nope' }), 'invalid-shape'],
      [
        JSON.stringify({
          format: 'rollkeeper-device-backup',
          formatVersion: 99,
          appVersion: 'test',
          runId: 'x',
          createdAt: 'now',
          entries: [],
          manifestHash: '0'.repeat(64),
          validation: {
            entryCount: 0,
            totalBytes: 0,
            validJsonCount: 0,
            malformedJsonCount: 0,
            futureVersionCount: 0,
            retainedOnlyCount: 0,
          },
        }),
        'unsupported-version',
      ],
    ] as const;
    for (const [serialized, reason] of invalid) {
      await expect(inspectCharacterRecoveryBundle(serialized)).resolves.toEqual(
        {
          ok: false,
          reason,
        }
      );
    }

    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"characters":[]},"version":1}'
    );
    const valid = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'inspect',
      timestamp: 'now',
    });
    const checksumTampered = structuredClone(valid);
    checksumTampered.entries[0].rawValue = 'tampered';
    await expect(
      inspectCharacterRecoveryBundle(JSON.stringify(checksumTampered))
    ).resolves.toEqual({ ok: false, reason: 'checksum-mismatch' });

    const aggregateTampered = structuredClone(valid);
    aggregateTampered.manifestHash = 'f'.repeat(64);
    await expect(
      inspectCharacterRecoveryBundle(JSON.stringify(aggregateTampered))
    ).resolves.toEqual({ ok: false, reason: 'aggregate-mismatch' });

    localStorage.clear();
    localStorage.setItem(
      'rollkeeper-dm-data',
      '{"state":{"campaigns":[]},"version":1}'
    );
    const dmOnly = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'dm-only',
      timestamp: 'now',
    });
    await expect(
      inspectCharacterRecoveryBundle(JSON.stringify(dmOnly))
    ).resolves.toEqual({ ok: false, reason: 'empty-character-set' });

    const { computeManifestHash } = await import('@/lib/deviceRecovery');
    const duplicateBundle = structuredClone(valid);
    duplicateBundle.entries = [valid.entries[0], valid.entries[0]];
    duplicateBundle.manifestHash = await computeManifestHash(
      duplicateBundle.entries
    );
    await expect(
      inspectCharacterRecoveryBundle(JSON.stringify(duplicateBundle))
    ).resolves.toEqual({ ok: false, reason: 'duplicate-character-key' });

    await expect(
      inspectCharacterRecoveryBundle(
        JSON.stringify({
          format: 'rollkeeper-current-character-export',
          formatVersion: 1,
        })
      )
    ).resolves.toEqual({ ok: false, reason: 'diagnostic-not-restorable' });

    await expectLocalDatabaseAbsent();
  });

  it('rejects invalid files from staging before creating rollkeeper-local', async () => {
    await expect(
      stageCharacterRecoveryFromSerialized({
        factory: indexedDB,
        serialized: '{broken',
        namespace: 'guest',
      })
    ).rejects.toThrow(/valid JSON|invalid/i);
    await expectLocalDatabaseAbsent();
  });

  it('validates a character-only bundle in memory without creating the database', async () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"characters":[]},"version":1}'
    );
    const bundle = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'ok',
      timestamp: 'now',
    });
    const inspected = await inspectCharacterRecoveryBundle(
      JSON.stringify(bundle)
    );
    expect(inspected).toMatchObject({
      ok: true,
      characterEntries: [{ key: 'rollkeeper-player-data' }],
    });
    await expectLocalDatabaseAbsent();
  });

  it('validates before parsing, imports only to a new inactive generation, and requires explicit activation', async () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"characters":[]},"version":1}'
    );
    const bundle = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'import-a',
      timestamp: 'now',
    });
    const serialized = JSON.stringify(bundle);
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const preview = await importCharacterRecoveryGeneration(
      database,
      serialized,
      'guest'
    );
    expect(preview).toMatchObject({
      generation: 'recovery:import-a',
      status: 'inactive',
      entryCount: 1,
      quarantineCount: 0,
    });
    expect(await readCharacterAuthority(database, 'guest')).toEqual({
      authority: 'localStorage',
      epoch: 0,
    });
    await expect(
      activateImportedCharacterGeneration(database, {
        namespace: 'guest',
        generation: 'recovery:import-a',
        confirmed: false,
        now: () => 'later',
      })
    ).rejects.toThrow(/explicit confirmation/i);

    const tampered = JSON.parse(serialized);
    tampered.entries[0].rawValue = 'tampered';
    await expect(
      importCharacterRecoveryGeneration(
        database,
        JSON.stringify(tampered),
        'guest'
      )
    ).rejects.toThrow(/checksum/i);
    database.close();
  });

  it('never replaces newer active edits with a stale imported snapshot and preserves both as a conflict', async () => {
    const oldRaw = '{"state":{"characters":[],"revision":1},"version":1}';
    const newRaw = '{"state":{"characters":[],"revision":2},"version":1}';
    localStorage.setItem('rollkeeper-player-data', oldRaw);
    const bundle = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'stale',
      timestamp: 'old',
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedActive(database, newRaw);
    const extra = database.transaction('kvGenerations', 'readwrite');
    extra.objectStore('kvGenerations').put({
      namespace: 'guest',
      generation: 'active',
      key: 'rollkeeper-character:extra',
      presence: true,
      rawValue: '{"state":{"character":{"id":"extra"}}}',
    });
    await transactionComplete(extra);
    await importCharacterRecoveryGeneration(
      database,
      JSON.stringify(bundle),
      'guest'
    );
    const result = await activateImportedCharacterGeneration(database, {
      namespace: 'guest',
      generation: 'recovery:stale',
      confirmed: true,
      now: () => 'later',
    });
    expect(result).toMatchObject({
      activated: false,
      conflictCount: 2,
      state: 'RECOVERY_REQUIRED',
    });
    expect(await readCharacterAuthority(database, 'guest')).toMatchObject({
      authority: 'indexedDB',
      generation: 'active',
      epoch: 1,
    });
    const tx = database.transaction('conflicts', 'readonly');
    expect(await requestResult(tx.objectStore('conflicts').getAll())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'recovery-generation-divergence',
          activeRawValue: newRaw,
          importedRawValue: oldRaw,
        }),
        expect.objectContaining({
          key: 'rollkeeper-character:extra',
          importedRawValue: null,
        }),
      ])
    );
    await transactionComplete(tx);
    database.close();
  });

  it('activates an identical imported generation at a new epoch without deleting the old generation', async () => {
    const raw = '{"state":{"characters":[]},"version":1}';
    localStorage.setItem('rollkeeper-player-data', raw);
    const bundle = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'same',
      timestamp: 'old',
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedActive(database, raw);
    await importCharacterRecoveryGeneration(
      database,
      JSON.stringify(bundle),
      'guest'
    );
    const result = await activateImportedCharacterGeneration(database, {
      namespace: 'guest',
      generation: 'recovery:same',
      confirmed: true,
      now: () => 'later',
    });
    expect(result).toMatchObject({
      activated: true,
      epoch: 2,
      generation: 'recovery:same',
    });
    await expect(
      activateImportedCharacterGeneration(database, {
        namespace: 'guest',
        generation: 'recovery:same',
        confirmed: true,
        now: () => 'even-later',
      })
    ).resolves.toEqual(result);
    const tx = database.transaction('kvGenerations', 'readonly');
    const rows = await requestResult(tx.objectStore('kvGenerations').getAll());
    expect(new Set(rows.map(row => row.generation))).toEqual(
      new Set(['active', 'recovery:same'])
    );
    await transactionComplete(tx);
    database.close();
  });

  it('supports idempotent import, rejects immutable collisions, and rejects missing/empty generations', async () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"source":"a","characters":[]},"version":1}'
    );
    const first = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'collision',
      timestamp: 'a',
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await importCharacterRecoveryGeneration(
      database,
      JSON.stringify(first),
      'guest'
    );
    await expect(
      importCharacterRecoveryGeneration(
        database,
        JSON.stringify(first),
        'guest'
      )
    ).resolves.toMatchObject({ status: 'inactive' });
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"source":"b","characters":[]},"version":1}'
    );
    const second = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'collision',
      timestamp: 'b',
    });
    await expect(
      importCharacterRecoveryGeneration(
        database,
        JSON.stringify(second),
        'guest'
      )
    ).rejects.toThrow(/collision/i);
    await expect(
      activateImportedCharacterGeneration(database, {
        namespace: 'guest',
        generation: 'missing',
        confirmed: true,
        now: () => 'now',
      })
    ).rejects.toThrow(/not found/i);
    const empty = database.transaction('meta', 'readwrite');
    empty.objectStore('meta').put({
      key: 'character-recovery:guest:empty',
      generation: 'empty',
      namespace: 'guest',
      status: 'inactive',
      bundleHash: 'hash',
      quarantineCount: 0,
      importedAt: 'now',
    });
    await transactionComplete(empty);
    await expect(
      activateImportedCharacterGeneration(database, {
        namespace: 'guest',
        generation: 'empty',
        confirmed: true,
        now: () => 'now',
      })
    ).rejects.toThrow(/empty/i);
    database.close();
  });

  it('blocks quarantined or journaled imports without hiding their raw values', async () => {
    localStorage.setItem('rollkeeper-player-data', '{broken');
    const malformed = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'malformed',
      timestamp: 'old',
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const preview = await importCharacterRecoveryGeneration(
      database,
      JSON.stringify(malformed),
      'guest'
    );
    expect(preview.quarantineCount).toBe(1);
    const blocked = await activateImportedCharacterGeneration(database, {
      namespace: 'guest',
      generation: 'recovery:malformed',
      confirmed: true,
      now: () => 'now',
    });
    expect(blocked).toMatchObject({
      activated: false,
      state: 'RECOVERY_REQUIRED',
    });

    const raw = '{"state":{"characters":[]},"version":1}';
    localStorage.setItem('rollkeeper-player-data', raw);
    const journaled = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'journaled',
      timestamp: 'old',
    });
    await importCharacterRecoveryGeneration(
      database,
      JSON.stringify(journaled),
      'user:a'
    );
    const journal = database.transaction('journal', 'readwrite');
    journal
      .objectStore('journal')
      .put({ journalId: 'pending', namespace: 'user:a', family: 'character' });
    await transactionComplete(journal);
    const result = await activateImportedCharacterGeneration(database, {
      namespace: 'user:a',
      generation: 'recovery:journaled',
      confirmed: true,
      now: () => 'now',
    });
    expect(result).toMatchObject({
      activated: false,
      state: 'RECOVERY_REQUIRED',
    });
    const read = database.transaction('kvGenerations', 'readonly');
    expect(
      await requestResult(
        read
          .objectStore('kvGenerations')
          .get(['guest', 'recovery:malformed', 'rollkeeper-player-data'])
      )
    ).toMatchObject({ rawValue: '{broken' });
    await transactionComplete(read);
    database.close();
  });

  it('activates a truly empty profile, writes recovery evidence and a generated marker, and verifies IDs/hashes after reopen', async () => {
    const player =
      '{"state":{"characters":[{"id":"hero-1","name":"Hero One","race":"Human","class":"Fighter","level":1,"createdAt":"2020-01-01T00:00:00.000Z","updatedAt":"2020-01-01T00:00:00.000Z","lastPlayed":"2020-01-01T00:00:00.000Z","characterData":{"id":"hero-1"},"tags":[],"isArchived":false}]},"version":1}';
    const envelope = '{"state":{"character":{"id":"hero-1"}},"version":0}';
    const bundle = await captureDeviceBackup(
      new Map([
        ['rollkeeper-player-data', player],
        ['rollkeeper-character:hero-1', envelope],
      ]),
      { appVersion: 'test', runId: 'empty-restore', timestamp: 'file-time' }
    );
    const serialized = JSON.stringify(bundle);
    localStorage.clear();
    await stageCharacterRecoveryFromSerialized({
      factory: indexedDB,
      serialized,
      namespace: 'guest',
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    expect(await readCharacterAuthority(database, 'guest')).toEqual({
      authority: 'localStorage',
      epoch: 0,
    });
    const result = await activateImportedCharacterGeneration(database, {
      namespace: 'guest',
      generation: 'recovery:empty-restore',
      confirmed: true,
      now: () => 'activated-at',
      storage: localStorage,
    });
    expect(result).toMatchObject({
      activated: true,
      generation: 'recovery:empty-restore',
      epoch: 1,
    });
    const evidence = await readCharacterActivationEvidence(
      database,
      'guest',
      'recovery:empty-restore'
    );
    expect(evidence).toMatchObject({
      recoveryRunId: 'empty-restore',
      recoveryManifestHash: bundle.manifestHash,
      recoveryCreatedAt: 'file-time',
      selectedAt: 'activated-at',
      activatedGeneration: 'recovery:empty-restore',
      activatedEpoch: 1,
    });
    expect(evidence?.playerBackupRunId).toBeUndefined();
    expect(evidence?.playerBackupAccountId).toBeUndefined();
    const marker = readCharacterCutoverSelection(localStorage, 'guest');
    expect(marker).toMatchObject({
      recoveryRunId: 'empty-restore',
      recoveryManifestHash: bundle.manifestHash,
      recoveryCreatedAt: 'file-time',
      activatedGeneration: 'recovery:empty-restore',
      activatedEpoch: 1,
    });
    expect(marker?.playerBackupRunId).toBeUndefined();
    database.close();
    const reopened = await openRollkeeperDatabase({ factory: indexedDB });
    await expect(
      verifyActivatedCharacterRecovery(reopened, {
        namespace: 'guest',
        serialized,
        storage: localStorage,
        visibleCharacters: [{ id: 'hero-1', tags: [] }],
      })
    ).resolves.toMatchObject({
      ok: true,
      characterIds: ['hero-1'],
    });
    await expect(
      verifyActivatedCharacterRecovery(reopened, {
        namespace: 'guest',
        serialized,
        storage: localStorage,
        visibleCharacters: [{ id: 'hero-1' }],
      })
    ).resolves.toMatchObject({
      ok: false,
      reason: 'visible-mismatch',
    });
    reopened.close();
  });

  it('verifies roster-only restorations from parsed character IDs', async () => {
    const player =
      '{"state":{"characters":[{"id":"hero-1","name":"Hero One","race":"Human","class":"Fighter","level":1,"createdAt":"2020-01-01T00:00:00.000Z","updatedAt":"2020-01-01T00:00:00.000Z","lastPlayed":"2020-01-01T00:00:00.000Z","characterData":{"id":"hero-1"},"tags":[],"isArchived":false}]},"version":1}';
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-player-data', player]]),
      { appVersion: 'test', runId: 'roster-only', timestamp: 'file-time' }
    );
    const serialized = JSON.stringify(bundle);
    localStorage.clear();
    await stageCharacterRecoveryFromSerialized({
      factory: indexedDB,
      serialized,
      namespace: 'guest',
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await activateImportedCharacterGeneration(database, {
      namespace: 'guest',
      generation: 'recovery:roster-only',
      confirmed: true,
      now: () => 'activated-at',
      storage: localStorage,
    });
    database.close();
    const reopened = await openRollkeeperDatabase({ factory: indexedDB });
    await expect(
      verifyActivatedCharacterRecovery(reopened, {
        namespace: 'guest',
        serialized,
        storage: localStorage,
        visibleCharacters: [{ id: 'hero-1', tags: [] }],
      })
    ).resolves.toMatchObject({
      ok: true,
      characterIds: ['hero-1'],
    });
    reopened.close();
  });

  it('fails closed when a valid active pointer has no generation rows', async () => {
    const raw = '{"state":{"characters":[]},"version":1}';
    localStorage.setItem('rollkeeper-player-data', raw);
    const bundle = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'corrupt',
      timestamp: 'old',
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await seedActive(database, raw);
    const wipe = database.transaction('kvGenerations', 'readwrite');
    const generations = wipe.objectStore('kvGenerations');
    const activeRows = (
      (await requestResult(generations.getAll())) as Array<{
        namespace: string;
        generation: string;
        key: string;
      }>
    ).filter(row => row.namespace === 'guest' && row.generation === 'active');
    for (const row of activeRows) {
      generations.delete([row.namespace, row.generation, row.key]);
    }
    await transactionComplete(wipe);
    await importCharacterRecoveryGeneration(
      database,
      JSON.stringify(bundle),
      'guest'
    );
    await expect(
      activateImportedCharacterGeneration(database, {
        namespace: 'guest',
        generation: 'recovery:corrupt',
        confirmed: true,
        now: () => 'later',
        storage: localStorage,
      })
    ).rejects.toThrow(/missing/i);
    expect(await readCharacterAuthority(database, 'guest')).toMatchObject({
      authority: 'indexedDB',
      generation: 'active',
    });
    expect(readCharacterCutoverSelection(localStorage, 'guest')).toBeNull();
    database.close();
  });

  it('does not invent a marker on reload and repairs only from explicit continuation', async () => {
    const raw = '{"state":{"characters":[]},"version":1}';
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-player-data', raw]]),
      {
        appVersion: 'test',
        runId: 'crash',
        timestamp: 'file-time',
      }
    );
    localStorage.clear();
    await stageCharacterRecoveryFromSerialized({
      factory: indexedDB,
      serialized: JSON.stringify(bundle),
      namespace: 'guest',
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await activateImportedCharacterGeneration(database, {
      namespace: 'guest',
      generation: 'recovery:crash',
      confirmed: true,
      now: () => 'activated-at',
    });
    expect(readCharacterCutoverSelection(localStorage, 'guest')).toBeNull();
    const evidence = await readCharacterActivationEvidence(
      database,
      'guest',
      'recovery:crash'
    );
    expect(evidence).toMatchObject({
      recoveryRunId: 'crash',
      activatedGeneration: 'recovery:crash',
    });
    expect(readCharacterCutoverSelection(localStorage, 'guest')).toBeNull();
    const repaired = repairRecoveredCharacterSelectionFromEvidence(
      localStorage,
      'guest',
      evidence!
    );
    expect(repaired).toMatchObject({
      recoveryRunId: 'crash',
      activatedGeneration: 'recovery:crash',
      activatedEpoch: 1,
    });
    expect(repaired.playerBackupRunId).toBeUndefined();
    database.close();
  });

  it('does not activate a cryptographically valid file whose roster characters are incomplete', async () => {
    const player =
      '{"state":{"characters":[{"id":"hero-1","name":"Hero One","characterData":{"id":"hero-1"}}]},"version":1}';
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-player-data', player]]),
      { appVersion: 'test', runId: 'incomplete', timestamp: 'file-time' }
    );
    const serialized = JSON.stringify(bundle);
    const inspected = await inspectCharacterRecoveryBundle(serialized);
    expect(inspected).toMatchObject({ ok: true, quarantineCount: 1 });
    localStorage.clear();
    await stageCharacterRecoveryFromSerialized({
      factory: indexedDB,
      serialized,
      namespace: 'guest',
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    await expect(
      activateImportedCharacterGeneration(database, {
        namespace: 'guest',
        generation: 'recovery:incomplete',
        confirmed: true,
        now: () => 'later',
        storage: localStorage,
      })
    ).resolves.toMatchObject({
      activated: false,
      state: 'RECOVERY_REQUIRED',
    });
    expect(await readCharacterAuthority(database, 'guest')).toEqual({
      authority: 'localStorage',
      epoch: 0,
    });
    expect(readCharacterCutoverSelection(localStorage, 'guest')).toBeNull();
    database.close();
  });

  it('classifies a mixed safety file with character entries as character restore', async () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"characters":[{"id":"hero-1","name":"Hero One","race":"Human","class":"Fighter","level":1,"createdAt":"2020-01-01T00:00:00.000Z","updatedAt":"2020-01-01T00:00:00.000Z","lastPlayed":"2020-01-01T00:00:00.000Z","characterData":{"id":"hero-1"},"tags":[],"isArchived":false}]},"version":1}'
    );
    localStorage.setItem(
      'rollkeeper-dm-data',
      '{"state":{"campaigns":[]},"version":1}'
    );
    const bundle = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'mixed',
      timestamp: 'now',
    });
    await expect(
      inspectPlayerBackupSafetyFile(JSON.stringify(bundle))
    ).resolves.toMatchObject({
      ok: true,
      kind: 'character',
    });
    expect(
      bundle.entries.some(entry => entry.key === 'rollkeeper-dm-data')
    ).toBe(true);
    await expectLocalDatabaseAbsent();
  });

  it('classifies a valid character-free safety file as generic restore, not invalid', async () => {
    localStorage.setItem(
      'rollkeeper-dm-data',
      '{"state":{"campaigns":[]},"version":1}'
    );
    const bundle = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'dm-only',
      timestamp: 'now',
    });
    await expect(
      inspectPlayerBackupSafetyFile(JSON.stringify(bundle))
    ).resolves.toMatchObject({
      ok: true,
      kind: 'generic',
      characterEntries: [],
    });
    await expectLocalDatabaseAbsent();
  });

  it('rejects visible restored characters that are missing tags or IDs', () => {
    expect(visibleCharactersMatchRecovery([{ id: 'hero-1' }], ['hero-1'])).toBe(
      false
    );
    expect(
      visibleCharactersMatchRecovery([{ id: 'hero-1', tags: [] }], ['hero-1'])
    ).toBe(true);
    expect(
      visibleCharactersMatchRecovery(
        [{ id: 'hero-1', tags: [] }],
        ['hero-1', 'hero-2']
      )
    ).toBe(false);
  });
});
