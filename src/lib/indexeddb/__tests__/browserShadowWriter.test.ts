import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { recordAuthoritativeShadowWrite } from '@/lib/indexeddb/browserShadowWriter';

describe('browser shadow writer', () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('does nothing before SHADOWING', async () => {
    await recordAuthoritativeShadowWrite('key', 'raw');
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const tx = database.transaction(['journal', 'kvGenerations'], 'readonly');
    expect(await requestResult(tx.objectStore('journal').count())).toBe(0);
    expect(await requestResult(tx.objectStore('kvGenerations').count())).toBe(
      0
    );
    await transactionComplete(tx);
    database.close();
  });

  it.each(['SHADOWING', 'CUTOVER_READY'])(
    'journals and clears an acknowledged %s write',
    async state => {
      const database = await openRollkeeperDatabase({ factory: indexedDB });
      const setup = database.transaction('meta', 'readwrite');
      setup.objectStore('meta').put({
        key: 'migration-state:guest',
        state,
        runId: 'run-shadow',
      });
      await transactionComplete(setup);
      database.close();

      await recordAuthoritativeShadowWrite(
        'rollkeeper-player-data',
        'exact raw'
      );

      const reopened = await openRollkeeperDatabase({ factory: indexedDB });
      const tx = reopened.transaction(['journal', 'kvGenerations'], 'readonly');
      expect(await requestResult(tx.objectStore('journal').count())).toBe(0);
      expect(
        await requestResult(
          tx
            .objectStore('kvGenerations')
            .get(['guest', 'run-shadow', 'rollkeeper-player-data'])
        )
      ).toMatchObject({ rawValue: 'exact raw' });
      await transactionComplete(tx);
      reopened.close();
    }
  );

  it('retains the journal when authority changes before the shadow commit', async () => {
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const setup = database.transaction('meta', 'readwrite');
    setup.objectStore('meta').put({
      key: 'migration-state:guest:character',
      state: 'SHADOWING',
      runId: 'run-shadow',
    });
    await transactionComplete(setup);

    vi.spyOn(crypto, 'randomUUID').mockImplementationOnce(() => {
      const authorityChange = database.transaction('meta', 'readwrite');
      authorityChange.objectStore('meta').put({
        key: 'migration-state:guest:character',
        state: 'IDB_PRIMARY',
        runId: 'run-shadow',
      });
      return '00000000-0000-4000-8000-000000000008';
    });

    await recordAuthoritativeShadowWrite(
      'rollkeeper-player-data',
      'exact raw',
      {
        namespace: 'guest',
        family: 'character',
      }
    );

    const tx = database.transaction(['journal', 'kvGenerations'], 'readonly');
    expect(await requestResult(tx.objectStore('journal').count())).toBe(1);
    expect(await requestResult(tx.objectStore('kvGenerations').count())).toBe(
      0
    );
    await transactionComplete(tx);
    database.close();
  });

  it('fails closed when IndexedDB cannot open', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('unavailable');
      },
    });
    await expect(
      recordAuthoritativeShadowWrite('key', 'raw')
    ).resolves.toBeUndefined();
  });
});
