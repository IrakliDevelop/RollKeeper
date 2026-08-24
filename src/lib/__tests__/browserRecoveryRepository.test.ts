import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import { BrowserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import { captureDeviceBackup } from '@/lib/deviceRecovery';

function deleteRecoveryDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('rollkeeper-recovery');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('database deletion blocked'));
  });
}

describe('BrowserRecoveryRepository verified download receipts', () => {
  afterEach(async () => {
    await deleteRecoveryDatabase();
  });

  it('does not treat initiation as verification and verifies only the matching run', async () => {
    const repository = new BrowserRecoveryRepository();
    const manifestHash = 'a'.repeat(64);
    await repository.recordDownloadReceipt({
      runId: 'calendar-run',
      manifestHash,
      initiatedAt: '2026-08-15T10:00:00.000Z',
    });

    await expect(repository.hasDownloadReceipt(manifestHash)).resolves.toBe(
      true
    );
    await expect(
      repository.hasVerifiedDownloadReceipt(manifestHash)
    ).resolves.toBe(false);
    await expect(
      repository.verifyDownloadReceipt({
        runId: 'wrong-run',
        manifestHash,
        verifiedAt: '2026-08-15T10:05:00.000Z',
      })
    ).rejects.toThrow('matching initiated recovery download');

    await repository.verifyDownloadReceipt({
      runId: 'calendar-run',
      manifestHash,
      verifiedAt: '2026-08-15T10:05:00.000Z',
    });
    await expect(
      repository.hasVerifiedDownloadReceipt(manifestHash)
    ).resolves.toBe(true);
  });
});

describe('readVerifiedDownloadReceipt', () => {
  afterEach(async () => {
    await deleteRecoveryDatabase();
  });

  it('returns null when the receipt was initiated but never verified', async () => {
    const repository = new BrowserRecoveryRepository();
    await repository.recordDownloadReceipt({
      runId: 'run-1',
      manifestHash: 'a'.repeat(64),
      initiatedAt: '2026-08-24T00:00:00.000Z',
    });

    expect(
      await repository.readVerifiedDownloadReceipt('a'.repeat(64))
    ).toBeNull();
  });

  it('returns the receipt, its run id and its entry vector once verified', async () => {
    const repository = new BrowserRecoveryRepository();
    await repository.recordDownloadReceipt({
      runId: 'run-1',
      manifestHash: 'b'.repeat(64),
      initiatedAt: '2026-08-24T00:00:00.000Z',
      entries: [
        { key: 'rollkeeper-dm-data', byteCount: 12, sha256: 'c'.repeat(64) },
      ],
    });
    await repository.verifyDownloadReceipt({
      runId: 'run-1',
      manifestHash: 'b'.repeat(64),
      verifiedAt: '2026-08-24T00:01:00.000Z',
    });

    const receipt = await repository.readVerifiedDownloadReceipt(
      'b'.repeat(64)
    );

    expect(receipt?.runId).toBe('run-1');
    expect(receipt?.entries).toEqual([
      { key: 'rollkeeper-dm-data', byteCount: 12, sha256: 'c'.repeat(64) },
    ]);
  });

  it('returns null for a manifest hash with no receipt at all', async () => {
    const repository = new BrowserRecoveryRepository();
    expect(
      await repository.readVerifiedDownloadReceipt('d'.repeat(64))
    ).toBeNull();
  });
});

describe('enrichVerifiedDownloadReceiptEntries', () => {
  afterEach(async () => {
    await deleteRecoveryDatabase();
  });

  it('refuses to enrich a receipt that was initiated but never verified', async () => {
    const repository = new BrowserRecoveryRepository();
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-dm-data', '{"state":{},"version":1}']]),
      {
        appVersion: 'test',
        runId: 'run-1',
        timestamp: '2026-08-24T00:00:00.000Z',
      }
    );
    await repository.recordDownloadReceipt({
      runId: bundle.runId,
      manifestHash: bundle.manifestHash,
      initiatedAt: '2026-08-24T00:00:00.000Z',
    });

    await expect(
      repository.enrichVerifiedDownloadReceiptEntries(
        bundle.manifestHash,
        bundle.entries
      )
    ).rejects.toThrow('A verified recovery download receipt is required');
  });

  it('refuses to enrich a manifest hash with no receipt at all', async () => {
    const repository = new BrowserRecoveryRepository();
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-dm-data', '{"state":{},"version":1}']]),
      {
        appVersion: 'test',
        runId: 'run-1',
        timestamp: '2026-08-24T00:00:00.000Z',
      }
    );

    await expect(
      repository.enrichVerifiedDownloadReceiptEntries(
        bundle.manifestHash,
        bundle.entries
      )
    ).rejects.toThrow('A verified recovery download receipt is required');
  });

  it('refuses to overwrite a receipt that already carries an entry vector', async () => {
    const repository = new BrowserRecoveryRepository();
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-dm-data', '{"state":{},"version":1}']]),
      {
        appVersion: 'test',
        runId: 'run-1',
        timestamp: '2026-08-24T00:00:00.000Z',
      }
    );
    await repository.recordDownloadReceipt({
      runId: bundle.runId,
      manifestHash: bundle.manifestHash,
      initiatedAt: '2026-08-24T00:00:00.000Z',
      entries: bundle.entries.map(({ key, byteCount, sha256 }) => ({
        key,
        byteCount,
        sha256,
      })),
    });
    await repository.verifyDownloadReceipt({
      runId: bundle.runId,
      manifestHash: bundle.manifestHash,
      verifiedAt: '2026-08-24T00:01:00.000Z',
    });

    await expect(
      repository.enrichVerifiedDownloadReceiptEntries(
        bundle.manifestHash,
        bundle.entries
      )
    ).rejects.toThrow('already carries an entry vector');
  });

  it('refuses entries whose aggregate hash does not match the receipt manifest hash', async () => {
    const repository = new BrowserRecoveryRepository();
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-dm-data', '{"state":{},"version":1}']]),
      {
        appVersion: 'test',
        runId: 'run-1',
        timestamp: '2026-08-24T00:00:00.000Z',
      }
    );
    await repository.recordDownloadReceipt({
      runId: bundle.runId,
      manifestHash: bundle.manifestHash,
      initiatedAt: '2026-08-24T00:00:00.000Z',
    });
    await repository.verifyDownloadReceipt({
      runId: bundle.runId,
      manifestHash: bundle.manifestHash,
      verifiedAt: '2026-08-24T00:01:00.000Z',
    });

    const tamperedEntries = bundle.entries.map(entry =>
      entry.key === 'rollkeeper-dm-data'
        ? { ...entry, byteCount: entry.byteCount + 1 }
        : entry
    );

    await expect(
      repository.enrichVerifiedDownloadReceiptEntries(
        bundle.manifestHash,
        tamperedEntries
      )
    ).rejects.toThrow('does not match the receipt manifest hash');
  });

  it('enriches a verified receipt whose supplied entries reproduce its manifest hash', async () => {
    const repository = new BrowserRecoveryRepository();
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-dm-data', '{"state":{},"version":1}']]),
      {
        appVersion: 'test',
        runId: 'run-1',
        timestamp: '2026-08-24T00:00:00.000Z',
      }
    );
    await repository.recordDownloadReceipt({
      runId: bundle.runId,
      manifestHash: bundle.manifestHash,
      initiatedAt: '2026-08-24T00:00:00.000Z',
    });
    await repository.verifyDownloadReceipt({
      runId: bundle.runId,
      manifestHash: bundle.manifestHash,
      verifiedAt: '2026-08-24T00:01:00.000Z',
    });

    await repository.enrichVerifiedDownloadReceiptEntries(
      bundle.manifestHash,
      bundle.entries
    );

    const receipt = await repository.readVerifiedDownloadReceipt(
      bundle.manifestHash
    );
    expect(receipt?.entries).toEqual(
      bundle.entries.map(({ key, byteCount, sha256 }) => ({
        key,
        byteCount,
        sha256,
      }))
    );
  });
});
