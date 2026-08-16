import { describe, expect, it, vi } from 'vitest';

import {
  MemoryShadowJournalRepository,
  ShadowWriteCoordinator,
} from '@/lib/indexeddb/shadowJournal';

function storageBackend(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
}

describe('localStorage-authoritative shadow journal', () => {
  it.each([
    ['both acknowledge', false, false, true, true, 0],
    ['only localStorage acknowledges', false, true, true, false, 1],
    ['only IndexedDB acknowledges', true, false, false, true, 1],
    ['neither acknowledges', true, true, false, false, 1],
  ])(
    'records %s',
    async (_label, failLegacy, failIdb, legacyAck, idbAck, pendingCount) => {
      const storage = storageBackend();
      if (failLegacy)
        storage.setItem.mockImplementation(() => {
          throw new DOMException('full', 'QuotaExceededError');
        });
      const repository = new MemoryShadowJournalRepository();
      const shadow = vi.fn(async () => {
        if (failIdb) throw new Error('IDB failed');
      });
      const coordinator = new ShadowWriteCoordinator({
        namespace: 'guest',
        generation: 'run-a',
        storage,
        repository,
        writeShadow: shadow,
        now: () => 'now',
        randomId: () => 'journal-a',
      });

      const result = await coordinator.write('rollkeeper-player-data', 'raw');

      expect(result).toMatchObject({ legacyAck, idbAck });
      expect(result.saved).toBe(legacyAck);
      expect(await repository.list('guest')).toHaveLength(pendingCount);
    }
  );

  it('retries failed shadow writes after reload until the journal is empty', async () => {
    const storage = storageBackend();
    const repository = new MemoryShadowJournalRepository();
    const shadow = vi
      .fn()
      .mockRejectedValueOnce(new Error('transaction abort'))
      .mockResolvedValue(undefined);
    const options = {
      namespace: 'guest' as const,
      generation: 'run-a',
      storage,
      repository,
      writeShadow: shadow,
      now: () => 'now',
      randomId: () => 'journal-a',
    };
    await new ShadowWriteCoordinator(options).write('key', 'value');
    expect(await repository.list('guest')).toHaveLength(1);

    const reloaded = new ShadowWriteCoordinator(options);
    await reloaded.retryPending();

    expect(shadow).toHaveBeenCalledTimes(2);
    expect(await repository.list('guest')).toEqual([]);
  });

  it('rejects stale old-tab writes and preserves the rejected candidate', async () => {
    const storage = storageBackend({ key: 'newer' });
    const repository = new MemoryShadowJournalRepository();
    const coordinator = new ShadowWriteCoordinator({
      namespace: 'guest',
      generation: 'run-a',
      storage,
      repository,
      writeShadow: vi.fn(),
      now: () => 'now',
      randomId: () => 'journal-a',
    });

    const result = await coordinator.write('key', 'stale', {
      expectedRawValue: 'older',
    });

    expect(result).toMatchObject({ stale: true, saved: false });
    expect(storage.values.get('key')).toBe('newer');
    expect(repository.staleCandidates).toEqual([
      expect.objectContaining({ rawValue: 'stale', currentRawValue: 'newer' }),
    ]);
  });

  it('isolates guest and account journals', async () => {
    const repository = new MemoryShadowJournalRepository();
    await repository.put({
      journalId: 'guest-entry',
      namespace: 'guest',
      generation: 'run-a',
      key: 'key',
      rawValue: 'guest',
      legacyAck: true,
      idbAck: false,
      attempts: 1,
      updatedAt: 'now',
    });
    await repository.put({
      journalId: 'user-entry',
      namespace: 'user:user-a',
      generation: 'run-a',
      key: 'key',
      rawValue: 'user',
      legacyAck: true,
      idbAck: false,
      attempts: 1,
      updatedAt: 'now',
    });

    expect(
      (await repository.list('guest')).map(entry => entry.journalId)
    ).toEqual(['guest-entry']);
    expect(
      (await repository.list('user:user-a')).map(entry => entry.journalId)
    ).toEqual(['user-entry']);
  });

  it('retries missing legacy acknowledgements and keeps double failures queued', async () => {
    const storage = storageBackend();
    const repository = new MemoryShadowJournalRepository();
    await repository.put({
      journalId: 'retry',
      namespace: 'guest',
      generation: 'run-a',
      key: 'key',
      rawValue: 'value',
      legacyAck: false,
      idbAck: true,
      attempts: 1,
      updatedAt: 'before',
    });
    const coordinator = new ShadowWriteCoordinator({
      namespace: 'guest',
      generation: 'run-a',
      storage,
      repository,
      writeShadow: vi.fn(),
      now: () => 'after',
      randomId: () => 'unused',
    });
    await coordinator.retryPending();
    expect(storage.values.get('key')).toBe('value');
    expect(await repository.list('guest')).toEqual([]);

    storage.setItem.mockImplementation(() => {
      throw new Error('legacy failed');
    });
    await repository.put({
      journalId: 'double-failure',
      namespace: 'guest',
      generation: 'run-a',
      key: 'other',
      rawValue: 'value',
      legacyAck: false,
      idbAck: false,
      attempts: 1,
      updatedAt: 'before',
    });
    const failing = new ShadowWriteCoordinator({
      namespace: 'guest',
      generation: 'run-a',
      storage,
      repository,
      writeShadow: vi.fn().mockRejectedValue(new Error('idb failed')),
      now: () => 'after',
      randomId: () => 'unused',
    });
    await failing.retryPending();
    expect(await repository.list('guest')).toEqual([
      expect.objectContaining({
        journalId: 'double-failure',
        legacyAck: false,
        idbAck: false,
        attempts: 2,
      }),
    ]);
  });

  it('preserves a changed queued value and shadows the current authoritative bytes', async () => {
    const storage = storageBackend({ key: 'current' });
    const repository = new MemoryShadowJournalRepository();
    await repository.put({
      journalId: 'changed',
      namespace: 'guest',
      generation: 'run-a',
      key: 'key',
      rawValue: 'queued-old',
      legacyAck: true,
      idbAck: false,
      attempts: 1,
      updatedAt: 'before',
    });
    const shadow = vi.fn().mockResolvedValue(undefined);
    await new ShadowWriteCoordinator({
      namespace: 'guest',
      generation: 'run-a',
      storage,
      repository,
      writeShadow: shadow,
      now: () => 'after',
      randomId: () => 'unused',
    }).retryPending();
    expect(repository.staleCandidates).toHaveLength(1);
    expect(shadow).toHaveBeenCalledWith('key', 'current');
    expect(await repository.list('guest')).toEqual([]);
  });

  it('does not recreate an authoritative value that was removed while queued', async () => {
    const storage = storageBackend();
    const repository = new MemoryShadowJournalRepository();
    await repository.put({
      journalId: 'removed',
      namespace: 'guest',
      generation: 'run-a',
      key: 'key',
      rawValue: 'queued-old',
      legacyAck: true,
      idbAck: false,
      attempts: 1,
      updatedAt: 'before',
    });
    const shadow = vi.fn();
    await new ShadowWriteCoordinator({
      namespace: 'guest',
      generation: 'run-a',
      storage,
      repository,
      writeShadow: shadow,
      now: () => 'after',
      randomId: () => 'unused',
    }).retryPending();
    expect(shadow).not.toHaveBeenCalled();
    expect(storage.values.has('key')).toBe(false);
  });
});
