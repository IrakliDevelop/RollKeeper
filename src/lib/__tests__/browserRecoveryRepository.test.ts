import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import { BrowserRecoveryRepository } from '@/lib/browserRecoveryRepository';

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
