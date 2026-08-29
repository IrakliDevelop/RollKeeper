'use client';

import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { AccountEnablePreview } from '@/lib/supabase/automaticCharacterSyncPreferences';
import type { AutomaticConflictResolution } from '@/lib/indexeddb/automaticCharacterConflictService';
import type { AutomaticSyncLocalCharacter } from '@/lib/supabase/automaticCharacterSyncService';
import type { AutomaticCharacterCloudStatus } from '@/lib/supabase/automaticCharacterSyncService';
import { isAutomaticCharacterSyncEnabled } from '@/lib/supabase/automaticCharacterSyncService';
import { awaitCharacterPersistenceResult } from '@/lib/indexeddb/characterPersistenceRuntime';
import { createBrowserAutomaticCharacterSync } from '@/lib/supabase/browserAutomaticCharacterSync';
import { subscribeBrowserAutomaticCharacterAccountChanges } from '@/lib/supabase/browserAutomaticCharacterSync';
import { AUTOMATIC_SYNC_STATUS_CHANGED_EVENT } from '@/lib/supabase/automaticCharacterSyncCoordinator';
import {
  AUTOMATIC_CHARACTER_AUTHORITY_CHANGED_EVENT,
  clearAutomaticCharacterSyncRuntime,
  configureAutomaticCharacterSyncRuntime,
} from '@/lib/supabase/automaticCharacterSyncRuntime';
import { usePlayerStore } from '@/store/playerStore';

export type CharacterAutomaticSyncStatus = AutomaticCharacterCloudStatus;

export interface AutomaticCharacterSyncController {
  accountLabel: string | null;
  indexedDbPrimary: boolean;
  statuses: Record<string, CharacterAutomaticSyncStatus>;
  busy: string | null;
  error: string | null;
  preview: AccountEnablePreview | null;
  refresh(): Promise<void>;
  enable(character: AutomaticSyncLocalCharacter): Promise<void>;
  disable(legacyId: string): Promise<void>;
  retry(legacyId: string): Promise<void>;
  previewAccountEnable(): Promise<AccountEnablePreview>;
  confirmAccountEnable(): Promise<void>;
  cancelPreview(): void;
  resolveConflict(
    legacyId: string,
    resolution: AutomaticConflictResolution
  ): Promise<void>;
  downloadQuarantine(legacyId: string): Promise<void>;
}

function useCharacterAutomaticSyncController(
  characters: readonly AutomaticSyncLocalCharacter[]
): AutomaticCharacterSyncController {
  const contextRef =
    useRef<Awaited<ReturnType<typeof createBrowserAutomaticCharacterSync>>>(
      null
    );
  const charactersRef = useRef(characters);
  charactersRef.current = characters;
  const appliedVersions = useRef(new Map<string, number>());
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [indexedDbPrimary, setIndexedDbPrimary] = useState(false);
  const [statuses, setStatuses] = useState<
    Record<string, CharacterAutomaticSyncStatus>
  >({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AccountEnablePreview | null>(null);
  const [accountGeneration, setAccountGeneration] = useState(0);
  const observedAccountId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isAutomaticCharacterSyncEnabled()) return;
    return subscribeBrowserAutomaticCharacterAccountChanges(accountId => {
      if (observedAccountId.current === undefined) {
        observedAccountId.current = accountId;
        return;
      }
      if (observedAccountId.current === accountId) {
        const context = contextRef.current;
        if (accountId && context) {
          void context.repository
            .resumeAfterAuthentication(`user:${accountId}`)
            .then(() => context.coordinator.wake())
            .catch(cause => {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'Automatic sync could not resume'
              );
            });
        }
        return;
      }
      observedAccountId.current = accountId;
      setAccountGeneration(current => current + 1);
    });
  }, []);

  const applyCloudDocuments = useCallback(async () => {
    const context = contextRef.current;
    if (!context) return;
    for (const document of await context.documents()) {
      const appliedKey = `${document.namespace}:${document.legacyId}`;
      const store = usePlayerStore.getState();
      const existing = store.getCharacterById(document.legacyId);
      if (document.baseServerVersion <= 0 && existing) continue;
      const appliedVersion = appliedVersions.current.get(appliedKey);
      if (
        appliedVersion !== undefined &&
        appliedVersion >= document.baseServerVersion
      ) {
        continue;
      }
      if (document.deletedAt) {
        if (existing) {
          usePlayerStore.setState(state => ({
            characters: state.characters.filter(
              character => character.id !== document.legacyId
            ),
            characterTombstones: {
              ...state.characterTombstones,
              [document.legacyId]: {
                id: document.legacyId,
                deletedAt: Date.parse(document.deletedAt!),
                beforeImage: structuredClone(existing),
              },
            },
          }));
        }
      } else if (
        document.payload &&
        typeof document.payload === 'object' &&
        !Array.isArray(document.payload) &&
        'characterData' in document.payload
      ) {
        if (existing) {
          store.replaceCloudRecoveredCharacter(
            document.payload as unknown as Parameters<
              typeof store.replaceCloudRecoveredCharacter
            >[0]
          );
        } else {
          store.addCloudRecoveredCharacter(
            document.payload as unknown as Parameters<
              typeof store.addCloudRecoveredCharacter
            >[0]
          );
        }
      }
      appliedVersions.current.set(appliedKey, document.baseServerVersion);
    }
  }, []);

  const refresh = useCallback(async () => {
    const context = contextRef.current;
    if (!context) return;
    await context.coordinator.manualRefresh();
    await applyCloudDocuments();
    setStatuses(await context.statuses(charactersRef.current));
  }, [applyCloudDocuments]);

  useEffect(() => {
    if (!isAutomaticCharacterSyncEnabled()) return;
    const rebuildForAuthority = () => {
      setAccountGeneration(current => current + 1);
    };
    window.addEventListener(
      AUTOMATIC_CHARACTER_AUTHORITY_CHANGED_EVENT,
      rebuildForAuthority
    );
    return () => {
      window.removeEventListener(
        AUTOMATIC_CHARACTER_AUTHORITY_CHANGED_EVENT,
        rebuildForAuthority
      );
    };
  }, []);

  useEffect(() => {
    if (!isAutomaticCharacterSyncEnabled()) return;
    let active = true;
    const updateFromDurableState = () => {
      const context = contextRef.current;
      if (!context) return;
      void (async () => {
        await applyCloudDocuments();
        if (active) {
          setStatuses(await context.statuses(charactersRef.current));
        }
      })().catch(cause => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Automatic sync status could not be refreshed'
          );
        }
      });
    };
    window.addEventListener(
      AUTOMATIC_SYNC_STATUS_CHANGED_EVENT,
      updateFromDurableState
    );
    return () => {
      active = false;
      window.removeEventListener(
        AUTOMATIC_SYNC_STATUS_CHANGED_EVENT,
        updateFromDurableState
      );
    };
  }, [applyCloudDocuments]);

  useEffect(() => {
    if (!isAutomaticCharacterSyncEnabled()) return;
    let active = true;
    setAccountLabel(null);
    setIndexedDbPrimary(false);
    setStatuses({});
    setPreview(null);
    void createBrowserAutomaticCharacterSync()
      .then(async context => {
        if (!active || !context) {
          context?.close();
          return;
        }
        contextRef.current = context;
        observedAccountId.current = context.accountId;
        setAccountLabel(context.accountLabel);
        setIndexedDbPrimary(context.indexedDbPrimary);
        configureAutomaticCharacterSyncRuntime({
          accountId: context.accountId,
          recordEdit: character => context.service.recordEdit(character),
          recordDelete: character => context.service.recordDelete(character),
          wake: () => context.coordinator.wake(),
          stop: () => context.coordinator.stop(),
        });
        await context.repository.resumeAfterAuthentication(
          `user:${context.accountId}`
        );
        await context.coordinator.start();
        await applyCloudDocuments();
        if (active) setStatuses(await context.statuses(charactersRef.current));
      })
      .catch(cause => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Automatic sync could not start'
          );
        }
      });
    return () => {
      active = false;
      const context = contextRef.current;
      contextRef.current = null;
      if (context) {
        clearAutomaticCharacterSyncRuntime(context.accountId);
        context.close();
      }
    };
  }, [accountGeneration, applyCloudDocuments]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    void context.statuses(characters).then(setStatuses);
  }, [characters]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context || !accountLabel) return;
    let active = true;
    void (async () => {
      const localResult = await awaitCharacterPersistenceResult();
      if (!localResult.saved) return;
      const documents = await context.documents();
      const existing = new Set(documents.map(document => document.legacyId));
      let queued = false;
      for (const character of characters) {
        if (existing.has(character.id)) continue;
        if ((await context.service.recordEdit(character)) === 'queued') {
          queued = true;
        }
      }
      if (queued) await context.coordinator.wake();
      if (active) setStatuses(await context.statuses(characters));
    })().catch(cause => {
      if (active) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'A future character could not be queued for automatic sync'
        );
      }
    });
    return () => {
      active = false;
    };
  }, [accountLabel, characters]);

  const run = useCallback(
    async (key: string, operation: () => Promise<void>) => {
      if (busy) return;
      setBusy(key);
      setError(null);
      try {
        await operation();
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Cloud sync failed');
      } finally {
        setBusy(null);
      }
    },
    [busy, refresh]
  );

  return {
    accountLabel,
    indexedDbPrimary,
    statuses,
    busy,
    error,
    preview,
    refresh,
    async enable(character) {
      const context = contextRef.current;
      if (!context) throw new Error('Sign in before enabling automatic sync');
      if (
        !window.confirm(
          `Enable automatic sync for ${character.name} to ${context.accountLabel}? Local data remains available offline.`
        )
      ) {
        return;
      }
      await run(`enable:${character.id}`, async () => {
        await context.service.enableCharacter(character, {
          confirmed: true,
          targetAccountId: context.accountId,
        });
        await context.coordinator.wake();
      });
    },
    async disable(legacyId) {
      const context = contextRef.current;
      if (!context) return;
      await run(`disable:${legacyId}`, () =>
        context.service.disableCharacter(legacyId)
      );
    },
    async retry(legacyId) {
      const context = contextRef.current;
      if (!context) return;
      await run(`retry:${legacyId}`, async () => {
        await context.repository.resumeAfterAuthentication(
          `user:${context.accountId}`
        );
        await context.repository.retryNow(
          `user:${context.accountId}`,
          legacyId
        );
        await context.coordinator.wake();
      });
    },
    async previewAccountEnable() {
      const context = contextRef.current;
      if (!context) throw new Error('Sign in before enabling automatic sync');
      const value = await context.service.previewAccountEnable(
        charactersRef.current
      );
      setPreview(value);
      return value;
    },
    async confirmAccountEnable() {
      const context = contextRef.current;
      if (!context || !preview) return;
      await run('confirm-account', async () => {
        await context.service.confirmAccountEnable(
          preview,
          charactersRef.current,
          true
        );
        setPreview(null);
        await context.coordinator.wake();
      });
    },
    cancelPreview() {
      setPreview(null);
    },
    async resolveConflict(legacyId, resolution) {
      const context = contextRef.current;
      if (!context) return;
      await run(`resolve:${legacyId}`, async () => {
        const conflict = (
          await context.repository.listConflicts(`user:${context.accountId}`)
        ).find(
          candidate =>
            candidate.legacyId === legacyId &&
            candidate.resolutionState === 'unresolved'
        );
        if (!conflict) throw new Error('Conflict was not found');
        await context.conflicts.resolve(conflict.conflictId, resolution, {
          copyLegacyId:
            resolution === 'keep-both' ? crypto.randomUUID() : undefined,
        });
        await context.coordinator.wake();
      });
    },
    async downloadQuarantine(legacyId) {
      const context = contextRef.current;
      if (!context) return;
      const row = (
        await context.repository.listQuarantine(`user:${context.accountId}`)
      ).find(candidate => candidate.legacyId === legacyId);
      if (!row) throw new Error('Quarantined candidate was not found');
      const blob = new Blob([row.rawValue], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rollkeeper-automatic-sync-quarantine-${legacyId}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
  };
}

const AutomaticCharacterSyncContext =
  createContext<AutomaticCharacterSyncController | null>(null);

const disabledController: AutomaticCharacterSyncController = {
  accountLabel: null,
  indexedDbPrimary: false,
  statuses: {},
  busy: null,
  error: null,
  preview: null,
  refresh: async () => undefined,
  enable: async () => {
    throw new Error('Sign in before enabling automatic sync');
  },
  disable: async () => undefined,
  retry: async () => undefined,
  previewAccountEnable: async () => {
    throw new Error('Sign in before enabling automatic sync');
  },
  confirmAccountEnable: async () => undefined,
  cancelPreview: () => undefined,
  resolveConflict: async () => undefined,
  downloadQuarantine: async () => undefined,
};

export function CharacterAutomaticSyncProvider({
  children,
}: {
  children: ReactNode;
}) {
  const characters = usePlayerStore(state => state.characters);
  const controller = useCharacterAutomaticSyncController(characters);
  return createElement(
    AutomaticCharacterSyncContext.Provider,
    { value: controller },
    children
  );
}

export function useCharacterAutomaticSync(): AutomaticCharacterSyncController {
  return useContext(AutomaticCharacterSyncContext) ?? disabledController;
}
