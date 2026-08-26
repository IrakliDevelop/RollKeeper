import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  activateRecoveryGeneration,
  assertStorageMigrationRecoveryGate,
  captureDeviceBackup,
  downloadRawRecoveryEntries,
  initiateDeviceBackupDownload,
  previewRecoveryBundle,
  restoreRecoveryEntries,
  stageRecoveryBundle,
  validateDeviceBackupJson,
  verifyDownloadedDeviceBackup,
  type RecoveryDownloadReceipt,
} from '@/lib/deviceRecovery';

describe('device recovery bundle', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it('captures required, canvas, character, and unknown RollKeeper entries as exact raw bytes', async () => {
    const storage = new Map<string, string>([
      ['rollkeeper-character', ' {"state":{"name":"A 🐉"}}\n'],
      ['rollkeeper-character:hero-2', '{"state":{"name":"B"}}'],
      ['rollkeeper-player-data', '{"state":{"characters":[]},"version":1}'],
      ['rollkeeper-dm-data', 'not-json'],
      ['location-canvas-town', '{"unicode":"雪"}'],
      ['battlemap-canvas-cave', '{"shapes":[]}'],
      ['rollkeeper-future-feature', 'opaque bytes'],
      ['unrelated-key', 'excluded'],
    ]);

    const bundle = await captureDeviceBackup(storage, {
      appVersion: '1.2.3',
      runId: 'run-123',
      timestamp: '2026-08-15T10:00:00.000Z',
    });

    expect(bundle).toMatchObject({
      format: 'rollkeeper-device-backup',
      formatVersion: 1,
      appVersion: '1.2.3',
      runId: 'run-123',
      createdAt: '2026-08-15T10:00:00.000Z',
    });
    expect(bundle.entries.map(entry => entry.key)).toEqual([
      'battlemap-canvas-cave',
      'location-canvas-town',
      'rollkeeper-character',
      'rollkeeper-character:hero-2',
      'rollkeeper-dm-data',
      'rollkeeper-future-feature',
      'rollkeeper-player-data',
    ]);
    expect(
      bundle.entries.find(entry => entry.key === 'rollkeeper-character')
    ).toMatchObject({
      rawValue: ' {"state":{"name":"A 🐉"}}\n',
      byteCount: 29,
    });
    expect(
      bundle.entries.find(entry => entry.key === 'rollkeeper-future-feature')
    ).toMatchObject({ classification: 'retained-only' });
    expect(
      bundle.entries.every(entry => /^[a-f0-9]{64}$/.test(entry.sha256))
    ).toBe(true);
    expect(bundle.manifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(bundle.validation).toMatchObject({
      entryCount: 7,
      malformedJsonCount: 1,
      retainedOnlyCount: 1,
    });
  });

  it('summarizes malformed JSON and future persisted-store versions without rewriting raw values', async () => {
    const storage = new Map<string, string>([
      ['rollkeeper-dm-data', '{broken'],
      ['rollkeeper-player-data', '{"state":{"characters":[]},"version":999}'],
    ]);

    const bundle = await captureDeviceBackup(storage, {
      appVersion: '1.2.3',
      runId: 'run-validation',
      timestamp: '2026-08-15T10:00:00.000Z',
    });

    expect(bundle.validation).toMatchObject({
      entryCount: 2,
      validJsonCount: 1,
      malformedJsonCount: 1,
      futureVersionCount: 1,
    });
    expect(bundle.entries.map(entry => entry.rawValue)).toEqual([
      '{broken',
      '{"state":{"characters":[]},"version":999}',
    ]);
  });

  it('round-trips a multi-megabyte Unicode canvas with its UTF-8 byte count', async () => {
    const rawCanvas = JSON.stringify({ canvas: '雪🐉'.repeat(400_000) });
    const bundle = await captureDeviceBackup(
      new Map([['battlemap-canvas-unicode', rawCanvas]]),
      {
        appVersion: '1.2.3',
        runId: 'run-large',
        timestamp: '2026-08-15T10:00:00.000Z',
      }
    );

    expect(bundle.entries[0].rawValue).toBe(rawCanvas);
    expect(bundle.entries[0].byteCount).toBe(
      new TextEncoder().encode(rawCanvas).byteLength
    );
    expect(bundle.entries[0].byteCount).toBeGreaterThan(2_000_000);
  });

  it('rejects checksum tampering before accepting entry payloads', async () => {
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-dm-data', '{broken']]),
      {
        appVersion: '1.2.3',
        runId: 'run-tamper',
        timestamp: '2026-08-15T10:00:00.000Z',
      }
    );
    const serialized = JSON.stringify(bundle).replace('{broken', '{changed');

    await expect(validateDeviceBackupJson(serialized)).rejects.toThrow(
      'checksum mismatch'
    );
  });

  it('rejects classification tampering through the manifest hash', async () => {
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-player-data', '{"state":{},"version":1}']]),
      {
        appVersion: '1.2.3',
        runId: 'run-classification-tamper',
        timestamp: '2026-08-15T10:00:00.000Z',
      }
    );
    bundle.entries[0].classification = 'retained-only';

    await expect(
      validateDeviceBackupJson(JSON.stringify(bundle))
    ).rejects.toThrow('manifest checksum mismatch');
  });

  it('previews empty-profile restores, versions, collisions, and quarantine without changing storage', async () => {
    const source = new Map<string, string>([
      ['rollkeeper-player-data', '{"state":{},"version":1}'],
      ['rollkeeper-dm-data', '{broken'],
      ['rollkeeper-npc-data', '{"state":{},"version":99}'],
      ['rollkeeper-location-data', '{"state":{"locations":[]}}'],
    ]);
    const bundle = await captureDeviceBackup(source, {
      appVersion: '1.2.3',
      runId: 'run-preview',
      timestamp: '2026-08-15T10:00:00.000Z',
    });
    const target = new Map<string, string>([
      ['rollkeeper-player-data', '{"state":{},"version":1}'],
      ['rollkeeper-location-data', '{"state":{"locations":[1]}}'],
    ]);

    const preview = previewRecoveryBundle(bundle, target);

    expect(preview).toMatchObject({
      entryCount: 4,
      restorableCount: 2,
      identicalCount: 1,
      conflictCount: 1,
      quarantineCount: 2,
      versions: {
        'rollkeeper-player-data': 1,
        'rollkeeper-npc-data': 99,
      },
    });
    expect(preview.conflicts).toEqual(['rollkeeper-location-data']);
    expect(preview.quarantine).toEqual([
      { key: 'rollkeeper-dm-data', reason: 'malformed-json' },
      { key: 'rollkeeper-npc-data', reason: 'future-version' },
    ]);
    expect([...target.entries()]).toEqual([
      ['rollkeeper-player-data', '{"state":{},"version":1}'],
      ['rollkeeper-location-data', '{"state":{"locations":[1]}}'],
    ]);

    const emptyPreview = previewRecoveryBundle(bundle, new Map());
    expect(emptyPreview.restorableCount).toBe(4);
    expect(emptyPreview.conflictCount).toBe(0);
  });

  it('downloads with browser-facing filename copy while preserving the compatibility format and matching manifest receipt', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T10:05:00.000Z'));
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-player-data', '{"state":{},"version":1}']]),
      {
        appVersion: '1.2.3',
        runId: 'run-download',
        timestamp: '2026-08-15T10:00:00.000Z',
      }
    );
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:recovery-download');
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const receipts = {
      recordDownloadReceipt: vi.fn().mockResolvedValue(undefined),
    };

    await initiateDeviceBackupDownload(bundle, receipts);

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    const link = click.mock.instances[0] as HTMLAnchorElement;
    expect(link.href).toBe('blob:recovery-download');
    expect(link.download).toBe(
      `rollkeeper-browser-backup_2026-08-15_${bundle.manifestHash}.json`
    );
    expect(bundle.format).toBe('rollkeeper-device-backup');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:recovery-download');
    expect(receipts.recordDownloadReceipt).toHaveBeenCalledWith({
      runId: bundle.runId,
      manifestHash: bundle.manifestHash,
      initiatedAt: '2026-08-15T10:05:00.000Z',
      entries: bundle.entries.map(({ key, byteCount, sha256 }) => ({
        key,
        byteCount,
        sha256,
      })),
    });
  });

  it('records the bundle entry vector on the download receipt', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(
      'blob:recovery-download-entries'
    );
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined
    );
    const recorded: RecoveryDownloadReceipt[] = [];
    const storage = new Map<string, string>([
      ['rollkeeper-dm-data', '{"state":{},"version":1}'],
      ['rollkeeper-player-data', '{"state":{"characters":[]},"version":1}'],
    ]);
    const bundle = await captureDeviceBackup(storage, {
      appVersion: 'test',
      runId: 'run-1',
      timestamp: '2026-08-24T00:00:00.000Z',
    });

    await initiateDeviceBackupDownload(bundle, {
      recordDownloadReceipt: async receipt => void recorded.push(receipt),
    });

    expect(recorded[0].entries).toEqual(
      bundle.entries.map(({ key, byteCount, sha256 }) => ({
        key,
        byteCount,
        sha256,
      }))
    );
  });

  it('verifies a reselected download only when its checksums and exact identity match', async () => {
    const bundle = await captureDeviceBackup(
      new Map([
        ['rollkeeper-calendar-data', '{"state":{"calendars":[]},"version":0}'],
      ]),
      {
        appVersion: '1.2.3',
        runId: 'calendar-recovery-run',
        timestamp: '2026-08-15T10:00:00.000Z',
      }
    );
    const receipts = {
      verifyDownloadReceipt: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      verifyDownloadedDeviceBackup(JSON.stringify(bundle), bundle, receipts, {
        now: () => '2026-08-15T10:10:00.000Z',
      })
    ).resolves.toEqual(bundle);
    expect(receipts.verifyDownloadReceipt).toHaveBeenCalledWith({
      runId: bundle.runId,
      manifestHash: bundle.manifestHash,
      verifiedAt: '2026-08-15T10:10:00.000Z',
    });

    const wrongRun = { ...bundle, runId: 'different-run' };
    await expect(
      verifyDownloadedDeviceBackup(JSON.stringify(wrongRun), bundle, receipts)
    ).rejects.toThrow('does not match the current preview');

    const corrupt = structuredClone(bundle);
    corrupt.entries[0]!.rawValue += 'tampered';
    await expect(
      verifyDownloadedDeviceBackup(JSON.stringify(corrupt), bundle, receipts)
    ).rejects.toThrow('checksum mismatch');
    expect(receipts.verifyDownloadReceipt).toHaveBeenCalledOnce();
  });

  it('stages a validated import as an inactive generation without overwriting active data', async () => {
    const bundle = await captureDeviceBackup(
      new Map([
        ['rollkeeper-player-data', '{"state":{"source":true},"version":1}'],
      ]),
      {
        appVersion: '1.2.3',
        runId: 'run-stage',
        timestamp: '2026-08-15T10:00:00.000Z',
      }
    );
    const target = new Map([
      ['rollkeeper-player-data', '{"state":{"active":true},"version":1}'],
    ]);
    const repository = {
      stageGeneration: vi.fn().mockResolvedValue(undefined),
    };

    const staged = await stageRecoveryBundle(
      JSON.stringify(bundle),
      target,
      repository
    );

    expect(repository.stageGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-stage',
        status: 'inactive',
        bundle,
        preview: expect.objectContaining({ conflictCount: 1 }),
      })
    );
    expect(staged.status).toBe('inactive');
    expect(target.get('rollkeeper-player-data')).toBe(
      '{"state":{"active":true},"version":1}'
    );
  });

  it('restores selected missing entries byte-for-byte while preserving collisions and never deleting values', async () => {
    const bundle = await captureDeviceBackup(
      new Map([
        ['rollkeeper-player-data', ' {"state":{"source":true},"version":1}\n'],
        ['rollkeeper-dm-data', '{"state":{"dmId":"source"},"version":1}'],
      ]),
      {
        appVersion: '1.2.3',
        runId: 'run-restore',
        timestamp: '2026-08-15T10:00:00.000Z',
      }
    );
    const values = new Map([
      ['rollkeeper-dm-data', '{"state":{"dmId":"active"},"version":1}'],
      ['keep-me', 'untouched'],
    ]);
    const target = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn(),
    };

    const result = restoreRecoveryEntries(bundle, target, [
      'rollkeeper-player-data',
      'rollkeeper-dm-data',
    ]);

    expect(result).toEqual({
      restored: ['rollkeeper-player-data'],
      identical: [],
      conflicts: ['rollkeeper-dm-data'],
      quarantined: [],
    });
    expect(values.get('rollkeeper-player-data')).toBe(
      ' {"state":{"source":true},"version":1}\n'
    );
    expect(values.get('rollkeeper-dm-data')).toBe(
      '{"state":{"dmId":"active"},"version":1}'
    );
    expect(values.get('keep-me')).toBe('untouched');
    expect(target.removeItem).not.toHaveBeenCalled();
  });

  it('requires explicit generation activation and a matching unchanged-source download receipt before migration', async () => {
    const source = new Map([
      ['rollkeeper-player-data', '{"state":{},"version":1}'],
    ]);
    const bundle = await captureDeviceBackup(source, {
      appVersion: '1.2.3',
      runId: 'run-gate',
      timestamp: '2026-08-15T10:00:00.000Z',
    });
    const repository = {
      activateGeneration: vi.fn().mockResolvedValue(undefined),
      hasDownloadReceipt: vi.fn().mockResolvedValue(true),
    };

    await expect(
      activateRecoveryGeneration('run-gate', false, repository)
    ).rejects.toThrow('explicit confirmation');
    expect(repository.activateGeneration).not.toHaveBeenCalled();

    await activateRecoveryGeneration('run-gate', true, repository);
    expect(repository.activateGeneration).toHaveBeenCalledWith('run-gate');
    await expect(
      assertStorageMigrationRecoveryGate(source, bundle, repository)
    ).resolves.toBeUndefined();

    source.set(
      'rollkeeper-player-data',
      '{"state":{"changed":true},"version":1}'
    );
    await expect(
      assertStorageMigrationRecoveryGate(source, bundle, repository)
    ).rejects.toThrow('source manifest changed');

    source.set('rollkeeper-player-data', '{"state":{},"version":1}');
    repository.hasDownloadReceipt.mockResolvedValue(false);
    await expect(
      assertStorageMigrationRecoveryGate(source, bundle, repository)
    ).rejects.toThrow('matching recovery download');
  });

  it('downloads selected quarantined raw values without parsing or rewriting them', async () => {
    const bundle = await captureDeviceBackup(
      new Map([
        ['rollkeeper-dm-data', ' {broken\n'],
        ['rollkeeper-player-data', '{"state":{},"version":1}'],
      ]),
      {
        appVersion: '1.2.3',
        runId: 'run-quarantine',
        timestamp: '2026-08-15T10:00:00.000Z',
      }
    );
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:quarantine');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined
    );

    downloadRawRecoveryEntries(bundle, ['rollkeeper-dm-data']);

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(JSON.parse(await blob.text())).toEqual({
      format: 'rollkeeper-raw-recovery-data',
      sourceRunId: 'run-quarantine',
      entries: [{ key: 'rollkeeper-dm-data', rawValue: ' {broken\n' }],
    });
  });
});
