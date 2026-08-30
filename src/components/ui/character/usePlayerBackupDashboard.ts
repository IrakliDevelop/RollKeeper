'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isAuthSessionMissingError } from '@supabase/supabase-js';

import { PlayerBackupReadOnlyCoordinator } from '@/lib/playerBackup/playerBackupCoordinator';
import {
  createBrowserPlayerBackupCloudPreview,
  previewPlayerBackupCloud,
} from '@/lib/playerBackup/playerBackupCloudPreview';
import { listPlayerBackupConflicts } from '@/lib/playerBackup/playerBackupConflictCoordinator';
import { mapPlayerBackupError } from '@/lib/playerBackup/playerBackupCopy';
import {
  projectDashboardCharacterStatus,
  projectPlayerBackupDashboard,
  readPlayerBackupCharacterPolicies,
  type PlayerBackupDashboardView,
} from '@/lib/playerBackup/playerBackupDashboard';
import { readPlayerBackupCapabilities } from '@/lib/playerBackup/playerBackupFlags';
import {
  derivePlayerBackupRunResult,
  withExistingDatabase,
} from '@/lib/playerBackup/playerBackupOnlineExecution';
import { hasPlayerBackupExclusiveLockCapability } from '@/lib/playerBackup/playerBackupRunFence';
import { IndexedDbAutomaticCharacterSyncRepository } from '@/lib/indexeddb/automaticCharacterSyncRepository';
import { createCharacterCloudLinkRepository } from '@/lib/supabase/characterCloudLinks';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { usePlayerStore } from '@/store/playerStore';

function deriveBrowserResult(options: {
  factory: IDBFactory;
  storage: Storage;
  accountId: string;
  runId: string;
}) {
  return withExistingDatabase(options.factory, database =>
    derivePlayerBackupRunResult({
      factory: options.factory,
      accountId: options.accountId,
      expectedActiveRunId: options.runId,
      links: createCharacterCloudLinkRepository(options.storage),
      repository: new IndexedDbAutomaticCharacterSyncRepository(database),
    })
  );
}

export function usePlayerBackupDashboard(): {
  view: PlayerBackupDashboardView;
  liveStatus: string | null;
  ready: boolean;
} {
  const coordinatorRef = useRef(new PlayerBackupReadOnlyCoordinator());
  const generation = useRef(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState(() =>
    coordinatorRef.current.snapshot()
  );
  const [policies, setPolicies] = useState<Record<string, 'on' | 'off'>>({});
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [durableStateLoaded, setDurableStateLoaded] = useState(false);
  const roster = usePlayerStore(state => state.characters);
  const lockAvailable = hasPlayerBackupExclusiveLockCapability(
    typeof navigator === 'undefined' ? null : navigator.locks
  );
  const capabilities = useMemo(
    () => readPlayerBackupCapabilities(lockAvailable),
    [lockAvailable]
  );

  const applyAccount = useCallback((nextId: string | null) => {
    setAccountId(current => {
      if (current === nextId) return current;
      generation.current += 1;
      coordinatorRef.current.changeAccount(nextId);
      setSnapshot(coordinatorRef.current.snapshot());
      setPolicies({});
      setLiveStatus(null);
      setDurableStateLoaded(nextId === null);
      return nextId;
    });
  }, []);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    if (!client) {
      applyAccount(null);
      setDurableStateLoaded(true);
      return undefined;
    }
    let cancelled = false;
    void client.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error && isAuthSessionMissingError(error)) {
        applyAccount(null);
        setDurableStateLoaded(true);
        return;
      }
      if (error) {
        setLiveStatus(mapPlayerBackupError('account', error));
        applyAccount(null);
        setDurableStateLoaded(true);
        return;
      }
      applyAccount(data.user?.id ?? null);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        const nextAccountId = session?.user?.id ?? null;
        applyAccount(nextAccountId);
        if (nextAccountId === null) setDurableStateLoaded(true);
      }
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [applyAccount]);

  useEffect(() => {
    if (!accountId) return undefined;
    const coordinator = coordinatorRef.current;
    const token = generation.current;
    let cancelled = false;
    void (async () => {
      try {
        if (typeof indexedDB === 'undefined') return;
        await coordinator.discoverRun(indexedDB);
        if (cancelled || token !== generation.current) return;
        const nextPolicies = await readPlayerBackupCharacterPolicies({
          factory: indexedDB,
          accountId,
          characterIds: usePlayerStore
            .getState()
            .characters.map(item => item.id),
        });
        if (cancelled || token !== generation.current) return;
        setPolicies(nextPolicies.characterPolicies);
        const preview = createBrowserPlayerBackupCloudPreview({
          manualRead: capabilities.calls.manualRead,
          automaticRead: capabilities.calls.automaticRead,
        });
        if (preview) {
          await coordinator.loadCloud(accountId, () =>
            previewPlayerBackupCloud({
              auth: preview.auth,
              gateway: preview.gateway,
              localCharacters: usePlayerStore.getState().characters,
            })
          );
        }
        if (cancelled || token !== generation.current) return;
        const run = coordinator.snapshot().run;
        if (run) {
          await coordinator.loadResult(accountId, () =>
            deriveBrowserResult({
              factory: indexedDB,
              storage: window.localStorage,
              accountId,
              runId: run.runId,
            })
          );
          if (cancelled || token !== generation.current) return;
          await coordinator.loadConflicts(accountId, () =>
            listPlayerBackupConflicts({
              factory: indexedDB,
              accountId,
              expectedActiveRunId: run.runId,
            })
          );
        }
      } catch (cause) {
        if (!cancelled && token === generation.current) {
          setLiveStatus(mapPlayerBackupError('account', cause));
        }
      } finally {
        if (!cancelled && token === generation.current) {
          setSnapshot(coordinator.snapshot());
          setDurableStateLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    accountId,
    capabilities.calls.automaticRead,
    capabilities.calls.manualRead,
  ]);

  const view = useMemo(() => {
    const conflictIds = new Set(
      snapshot.conflicts?.conflicts.map(conflict => conflict.legacyId) ?? []
    );
    const characters = roster.map(character => {
      const outcome = snapshot.result?.outcomes[character.id]?.outcome;
      const cloud = snapshot.cloud.characters.find(
        item => item.legacyId === character.id
      );
      return {
        id: character.id,
        status: projectDashboardCharacterStatus({
          outcome,
          cloudState: cloud?.state ?? null,
          conflict: conflictIds.has(character.id),
          preference: policies[character.id] ?? null,
          mode: snapshot.run?.mode ?? null,
        }),
      };
    });
    const hasAcknowledgedCurrentAccountCopy =
      (snapshot.result?.protected.length ?? 0) > 0 ||
      characters.some(
        character =>
          character.status === 'ongoing' ||
          character.status === 'saved-once' ||
          character.status === 'paused'
      );
    return projectPlayerBackupDashboard({
      rosterHydrated: hydrated,
      characterCount: roster.length,
      capabilities,
      accountId,
      run: snapshot.run
        ? {
            stage: snapshot.run.stage,
            mode: snapshot.run.mode,
            selectedCharacterIds: snapshot.run.selectedCharacterIds,
          }
        : null,
      result: snapshot.result
        ? {
            complete: snapshot.result.complete,
            protected: snapshot.result.protected,
            queued: snapshot.result.queued,
          }
        : null,
      resultLoading: snapshot.resultLoading,
      characters,
      hasAcknowledgedCurrentAccountCopy,
    });
  }, [accountId, capabilities, hydrated, policies, roster, snapshot]);

  return { view, liveStatus, ready: hydrated && durableStateLoaded };
}
