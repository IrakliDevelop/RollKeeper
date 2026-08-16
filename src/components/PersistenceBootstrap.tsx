'use client';

import { useEffect, useState, type ReactNode } from 'react';

import {
  isIndexedDbMigrationEnabled,
  runPersistenceBootstrap,
} from '@/lib/indexeddb/persistenceBootstrap';
import { useBattleMapStore } from '@/store/battleMapStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useCharacterStore } from '@/store/characterStore';
import { useCombatLogStore } from '@/store/combatLogStore';
import { useDmStore } from '@/store/dmStore';
import { useEncounterStore } from '@/store/encounterStore';
import { useLocationStore } from '@/store/locationStore';
import { useMagicItemLibraryStore } from '@/store/magicItemLibraryStore';
import { useNPCStore } from '@/store/npcStore';
import { usePlayerStore } from '@/store/playerStore';

const enabled = isIndexedDbMigrationEnabled();

async function hydratePersistedStores(): Promise<void> {
  await Promise.all([
    usePlayerStore.persist.rehydrate(),
    useCharacterStore.persist.rehydrate(),
    useDmStore.persist.rehydrate(),
    useEncounterStore.persist.rehydrate(),
    useNPCStore.persist.rehydrate(),
    useCalendarStore.persist.rehydrate(),
    useLocationStore.persist.rehydrate(),
    useBattleMapStore.persist.rehydrate(),
    useCombatLogStore.persist.rehydrate(),
    useMagicItemLibraryStore.persist.rehydrate(),
  ]);
}

export function PersistenceBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void runPersistenceBootstrap({
      enabled,
      migrate: async namespace => {
        const [{ runIndexedDbMigration }, { browserRecoveryRepository }] =
          await Promise.all([
            import('@/lib/indexeddb/migrationEngine'),
            import('@/lib/browserRecoveryRepository'),
          ]);
        const locks = navigator.locks
          ? {
              request: async <T,>(
                name: string,
                options: { mode: 'exclusive' },
                callback: () => Promise<T> | T
              ): Promise<T> =>
                await navigator.locks.request<Promise<T>>(
                  name,
                  options,
                  async () => await callback()
                ),
            }
          : undefined;
        const storageManager = navigator.storage
          ? {
              estimate: () => navigator.storage.estimate(),
              persist: () => navigator.storage.persist(),
            }
          : undefined;
        return runIndexedDbMigration({
          factory: window.indexedDB,
          storage: window.localStorage,
          namespace,
          runId: crypto.randomUUID(),
          ownerId: crypto.randomUUID(),
          now: () => new Date().toISOString(),
          nowMs: () => Date.now(),
          locks,
          storageManager,
          recoveryGate: browserRecoveryRepository,
        });
      },
      hydrate: hydratePersistedStores,
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return ready ? children : null;
}
