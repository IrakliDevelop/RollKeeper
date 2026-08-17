'use client';

import { useEffect, useState, type ReactNode } from 'react';

import {
  isBrowserCharacterCutoverParticipant,
  readCharacterCutoverSelection,
} from '@/lib/indexeddb/characterCutoverSelection';
import { resolvePersistenceBootstrapMode } from '@/lib/indexeddb/characterBootstrapRouting';
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
import { CharacterRecoveryExportControls } from '@/components/ui/feedback/CharacterRecoveryExportControls';
import { CharacterAutomaticSyncProvider } from '@/components/ui/character/useCharacterAutomaticSync';

const slice7Enabled = isIndexedDbMigrationEnabled();

async function hydrateCharacterStores(): Promise<void> {
  await Promise.all([
    usePlayerStore.persist.rehydrate(),
    useCharacterStore.persist.rehydrate(),
  ]);
}

async function hydrateSlice7PersistedStores(): Promise<void> {
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
  // The server cannot see profile-local localStorage. Start with the legacy
  // render on both server and first client render to avoid a hydration split;
  // selected profiles have skipHydration set in their character stores and
  // are moved behind the bootstrap barrier in the first effect.
  const [ready, setReady] = useState(!slice7Enabled);
  const [recoveryRequired, setRecoveryRequired] = useState(false);

  useEffect(() => {
    const mode = resolvePersistenceBootstrapMode({
      characterParticipant: isBrowserCharacterCutoverParticipant(),
      slice7Enabled,
    });
    if (mode === 'legacy') return;
    if (mode === 'slice7') {
      let active = true;
      void runPersistenceBootstrap({
        enabled: true,
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
        hydrate: hydrateSlice7PersistedStores,
      }).finally(() => {
        if (active) setReady(true);
      });
      return () => {
        active = false;
      };
    }
    setReady(false);
    let active = true;
    let stopMonitor: (() => void) | undefined;
    const selection = readCharacterCutoverSelection(
      window.localStorage,
      'guest'
    );
    void (async () => {
      const [{ bootstrapCharacterPersistence }, { browserRecoveryRepository }] =
        await Promise.all([
          import('@/lib/indexeddb/characterPersistenceBootstrap'),
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
      const result = await bootstrapCharacterPersistence({
        factory: window.indexedDB,
        storage: window.localStorage,
        namespace: 'guest',
        runId: crypto.randomUUID(),
        ownerId: crypto.randomUUID(),
        now: () => new Date().toISOString(),
        nowMs: () => Date.now(),
        locks,
        storageManager,
        recoveryGate: browserRecoveryRepository,
        requiredRecoveryManifestHash: selection?.recoveryManifestHash,
        activatedEpoch: selection?.activatedEpoch,
      });
      if (
        result.state === 'RECOVERY_REQUIRED' &&
        result.authority === 'indexedDB'
      ) {
        if (active) setRecoveryRequired(true);
        return;
      }
      if (result.state === 'IDB_PRIMARY') {
        const [
          { installCharacterStaleMirrorMonitor },
          { finishCharacterPersistenceBootstrap },
        ] = await Promise.all([
          import('@/lib/indexeddb/characterStaleMirror'),
          import('@/lib/indexeddb/characterPersistenceRuntime'),
        ]);
        stopMonitor = installCharacterStaleMirrorMonitor(window, 'guest');
        await hydrateCharacterStores();
        finishCharacterPersistenceBootstrap();
      } else {
        await hydrateCharacterStores();
      }
      window.dispatchEvent(
        new Event('rollkeeper:character-bootstrap-complete')
      );
    })()
      .catch(() => {
        if (selection?.activatedEpoch !== undefined) {
          if (active) setRecoveryRequired(true);
          return;
        }
        return hydrateCharacterStores();
      })
      .finally(() => {
        document.documentElement.removeAttribute(
          'data-character-persistence-pending'
        );
        document.documentElement.style.visibility = '';
        if (active) setReady(true);
      });
    return () => {
      active = false;
      stopMonitor?.();
    };
  }, []);

  if (recoveryRequired) {
    return (
      <main className="bg-surface text-body min-h-screen p-8">
        <h1 className="text-heading text-2xl font-bold">Recovery required</h1>
        <p className="mt-2 max-w-2xl">
          The active character generation could not be verified. RollKeeper has
          not fallen back to an older localStorage copy. Open this profile in a
          supported recovery build to export and reconcile every candidate.
        </p>
        <CharacterRecoveryExportControls
          namespace="guest"
          runId={
            readCharacterCutoverSelection(
              typeof localStorage === 'undefined'
                ? { getItem: () => null }
                : localStorage,
              'guest'
            )?.activatedGeneration
          }
        />
      </main>
    );
  }
  return ready ? (
    <CharacterAutomaticSyncProvider>{children}</CharacterAutomaticSyncProvider>
  ) : null;
}
