import { describe, expect, it, vi } from 'vitest';

import {
  isIndexedDbMigrationEnabled,
  runPersistenceBootstrap,
} from '@/lib/indexeddb/persistenceBootstrap';

describe('persistence bootstrap', () => {
  it('is disabled by default and makes zero migration calls', async () => {
    vi.stubEnv('NEXT_PUBLIC_INDEXEDDB_MIGRATION_ENABLED', undefined);
    const migrate = vi.fn();
    const hydrate = vi.fn();
    expect(isIndexedDbMigrationEnabled()).toBe(false);

    await runPersistenceBootstrap({
      enabled: false,
      migrate,
      hydrate,
    });

    expect(migrate).not.toHaveBeenCalled();
    expect(hydrate).not.toHaveBeenCalled();
  });

  it('recognizes only the explicit true feature value', () => {
    vi.stubEnv('NEXT_PUBLIC_INDEXEDDB_MIGRATION_ENABLED', 'true');
    expect(isIndexedDbMigrationEnabled()).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_INDEXEDDB_MIGRATION_ENABLED', 'false');
    expect(isIndexedDbMigrationEnabled()).toBe(false);
  });

  it('runs migration before hydration and still hydrates legacy stores after a blocked result', async () => {
    const order: string[] = [];
    const result = await runPersistenceBootstrap({
      enabled: true,
      migrate: async () => {
        order.push('migration');
        return { state: 'BLOCKED' };
      },
      hydrate: async () => {
        order.push('hydration');
      },
    });
    expect(order).toEqual(['migration', 'hydration']);
    expect(result).toEqual({ state: 'BLOCKED' });
  });

  it('hydrates localStorage after an unexpected migration error without claiming guest data', async () => {
    const hydrate = vi.fn();
    const result = await runPersistenceBootstrap({
      enabled: true,
      migrate: async namespace => {
        expect(namespace).toBe('guest');
        throw new Error('IndexedDB unavailable');
      },
      hydrate,
    });
    expect(result).toMatchObject({
      state: 'LEGACY_PRIMARY',
      authority: 'localStorage',
    });
    expect(hydrate).toHaveBeenCalledOnce();
  });

  it('normalizes non-Error failures while preserving localStorage authority', async () => {
    const result = await runPersistenceBootstrap({
      enabled: true,
      migrate: async () => Promise.reject('unavailable'),
      hydrate: async () => undefined,
    });
    expect(result).toMatchObject({
      state: 'LEGACY_PRIMARY',
      authority: 'localStorage',
      error: 'unavailable',
    });
  });
});
