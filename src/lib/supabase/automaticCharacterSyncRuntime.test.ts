import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearAutomaticCharacterSyncRuntime,
  configureAutomaticCharacterSyncRuntime,
  recordAutomaticCharacterDelete,
  recordAutomaticCharacterEdit,
  wakeAutomaticCharacterSyncRuntime,
} from './automaticCharacterSyncRuntime';

const character = {
  id: 'character-a',
  name: 'Aster',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('automatic character sync runtime bridge', () => {
  afterEach(() => clearAutomaticCharacterSyncRuntime());

  it('is a no-op without an explicitly initialized participating account', async () => {
    await expect(recordAutomaticCharacterEdit(character)).resolves.toBe(
      'local-only'
    );
    await expect(recordAutomaticCharacterDelete(character)).resolves.toBe(
      'local-only'
    );
    await expect(wakeAutomaticCharacterSyncRuntime()).resolves.toBeUndefined();
  });

  it('records durable work before waking the worker', async () => {
    const recordEdit = vi.fn(async () => 'queued' as const);
    const recordDelete = vi.fn(async () => 'queued' as const);
    const wake = vi.fn(async () => undefined);
    configureAutomaticCharacterSyncRuntime({
      accountId: 'account-a',
      recordEdit,
      recordDelete,
      wake,
      stop: vi.fn(),
    });

    await expect(recordAutomaticCharacterEdit(character)).resolves.toBe(
      'queued'
    );
    expect(recordEdit.mock.invocationCallOrder[0]).toBeLessThan(
      wake.mock.invocationCallOrder[0]
    );
    await recordAutomaticCharacterDelete(character);
    expect(recordDelete).toHaveBeenCalledWith(character);
  });

  it('stops the old account worker before switching namespaces', () => {
    const stopA = vi.fn();
    configureAutomaticCharacterSyncRuntime({
      accountId: 'account-a',
      recordEdit: vi.fn(),
      recordDelete: vi.fn(),
      wake: vi.fn(),
      stop: stopA,
    });
    configureAutomaticCharacterSyncRuntime({
      accountId: 'account-b',
      recordEdit: vi.fn(),
      recordDelete: vi.fn(),
      wake: vi.fn(),
      stop: vi.fn(),
    });
    expect(stopA).toHaveBeenCalledOnce();
  });

  it('does not wake for local-only work and ignores cleanup for another account', async () => {
    const runtime = {
      accountId: 'account-a',
      recordEdit: vi.fn(async () => 'local-only' as const),
      recordDelete: vi.fn(async () => 'local-only' as const),
      wake: vi.fn(async () => undefined),
      stop: vi.fn(),
    };
    configureAutomaticCharacterSyncRuntime(runtime);
    configureAutomaticCharacterSyncRuntime(runtime);
    clearAutomaticCharacterSyncRuntime('account-b');
    await recordAutomaticCharacterEdit(character);
    await recordAutomaticCharacterDelete(character);
    expect(runtime.wake).not.toHaveBeenCalled();
    expect(runtime.stop).not.toHaveBeenCalled();
    clearAutomaticCharacterSyncRuntime('account-a');
    expect(runtime.stop).toHaveBeenCalledOnce();
  });

  it('wakes the existing authorized worker without changing work identity', async () => {
    const wake = vi.fn(async () => undefined);
    configureAutomaticCharacterSyncRuntime({
      accountId: 'account-a',
      recordEdit: vi.fn(),
      recordDelete: vi.fn(),
      wake,
      stop: vi.fn(),
    });
    await wakeAutomaticCharacterSyncRuntime();
    expect(wake).toHaveBeenCalledOnce();
  });
});
