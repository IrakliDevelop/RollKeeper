'use client';

import { useCallback, useRef, useState } from 'react';
import { createJSONStorage } from 'zustand/middleware';

import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  captureDeviceBackup,
  initiateDeviceBackupDownload,
  restoreRecoveryEntries,
} from '@/lib/deviceRecovery';
import {
  inspectCharacterRecoveryBundle,
  inspectPlayerBackupSafetyFile,
  stageCharacterRecoveryFromSerialized,
  activateImportedCharacterGeneration,
  verifyActivatedCharacterRecovery,
  verifyLegacyCharacterRecovery,
} from '@/lib/indexeddb/characterRecovery';
import {
  captureActiveCharacterRecoveryBundle,
  exportCurrentCharacterData,
} from '@/lib/indexeddb/characterRecoveryExport';
import {
  inspectCurrentCharacterSafetyCoverage,
  readCharacterActivationEvidence,
  readCharacterAuthority,
  rollbackCharacterAuthority,
  verifyCharacterRollbackGenerationAfterReopen,
} from '@/lib/indexeddb/characterAuthority';
import {
  openExistingRollkeeperDatabase,
  openRollkeeperDatabase,
} from '@/lib/indexeddb/localDatabase';
import {
  applyActivatedRuntimeFromSelection,
  createCharacterFamilyStateStorage,
} from '@/lib/indexeddb/characterPersistenceRuntime';
import { repairRecoveredCharacterSelectionFromEvidence } from '@/lib/indexeddb/characterCutoverSelection';
import { createPerCharacterStorage } from '@/lib/characterCanonicalStorage';
import type { StorageNamespace } from '@/lib/indexeddb/shadowJournal';
import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';
import {
  genericRestorePreselectedKeys,
  shouldUseLegacyGenericCharacterRestore,
} from '@/lib/playerBackup/playerBackupRecoveryPolicy';
import { readPlayerBackupCapabilities } from '@/lib/playerBackup/playerBackupFlags';
import { APP_VERSION } from '@/utils/constants';
import { usePlayerStore } from '@/store/playerStore';
import { useCharacterStore } from '@/store/characterStore';

export type RecoveryReviewKind = 'generic' | 'character' | 'unusable';
export type RecoveryConfirmKind =
  | 'generic'
  | 'character'
  | 'character-activate'
  | 'rollback'
  | null;
export type RecoveryResultKind =
  | 'generic-success'
  | 'character-success'
  | 'difference'
  | 'verification-failure'
  | 'invalid'
  | 'unusable'
  | 'rollback-refusal'
  | null;

function downloadText(serialized: string, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([serialized], { type: 'application/json' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

function routeMountedStoresToActivatedAuthority(): void {
  const playerStorage = createJSONStorage(() =>
    createCharacterFamilyStateStorage({
      backing: localStorage,
      participant: true,
    })
  );
  const characterStorage = createJSONStorage(() => createPerCharacterStorage());
  if (!playerStorage || !characterStorage) {
    throw new Error('Character persistence storage is unavailable');
  }
  usePlayerStore.persist.setOptions({ storage: playerStorage });
  useCharacterStore.persist.setOptions({ storage: characterStorage });
}

export function usePlayerBackupRecovery(namespace: StorageNamespace = 'guest') {
  const [busy, setBusy] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [reviewKind, setReviewKind] = useState<RecoveryReviewKind | null>(null);
  const [confirmKind, setConfirmKind] = useState<RecoveryConfirmKind>(null);
  const [resultKind, setResultKind] = useState<RecoveryResultKind>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const serializedRef = useRef<string | null>(null);
  const stagedGenerationRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasOriginal, setHasOriginal] = useState(false);

  const announce = (status: string | null) => {
    setLiveStatus(null);
    if (status) {
      queueMicrotask(() => setLiveStatus(status));
    }
  };

  const handleChooseFile = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    setResultKind(null);
    try {
      const serialized = await file.text();
      serializedRef.current = serialized;
      setHasOriginal(true);
      const inspected = await inspectPlayerBackupSafetyFile(serialized);
      if (!inspected.ok) {
        setReviewKind(null);
        setResultKind(
          inspected.reason === 'diagnostic-not-restorable'
            ? 'unusable'
            : 'invalid'
        );
        announce(
          inspected.reason === 'diagnostic-not-restorable'
            ? COPY.recovery.unusable
            : COPY.recovery.invalidFile
        );
        return;
      }
      setReviewKind(inspected.kind);
    } catch {
      setResultKind('invalid');
      announce(COPY.recovery.invalidFile);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, []);

  const handleConfirmGeneric = useCallback(async () => {
    const serialized = serializedRef.current;
    if (!serialized) return;
    setBusy(true);
    setError(null);
    try {
      const inspected = await inspectPlayerBackupSafetyFile(serialized);
      if (!inspected.ok) {
        setResultKind('invalid');
        return;
      }
      const existing = await openExistingRollkeeperDatabase({
        factory: indexedDB,
      });
      const authority = existing
        ? await readCharacterAuthority(existing, namespace)
        : { authority: 'localStorage' as const, epoch: 0 };
      existing?.close();
      const keys = genericRestorePreselectedKeys(
        inspected.bundle.entries,
        key => localStorage.getItem(key),
        authority.authority === 'indexedDB' ? 'indexedDB' : 'legacy'
      );
      restoreRecoveryEntries(inspected.bundle, localStorage, keys, {
        authority: authority.authority === 'indexedDB' ? 'indexedDB' : 'legacy',
      });
      setConfirmKind(null);
      setReviewKind(null);
      setResultKind('generic-success');
      announce(COPY.recovery.restoreMissingResult);
    } catch {
      setResultKind('invalid');
      announce(COPY.recovery.invalidFile);
    } finally {
      setBusy(false);
    }
  }, [namespace]);

  const handleConfirmCharacter = useCallback(async () => {
    const serialized = serializedRef.current;
    if (!serialized) return;
    setBusy(true);
    setError(null);
    try {
      const capabilities = readPlayerBackupCapabilities(
        typeof navigator !== 'undefined' && Boolean(navigator.locks)
      );
      const existing = await openExistingRollkeeperDatabase({
        factory: indexedDB,
      });
      const authority = existing
        ? await readCharacterAuthority(existing, namespace)
        : { authority: 'localStorage' as const, epoch: 0 };
      existing?.close();
      if (
        shouldUseLegacyGenericCharacterRestore({
          authority: authority.authority,
          localAuthorityMutation: capabilities.calls.localAuthorityMutation,
        })
      ) {
        const inspected = await inspectCharacterRecoveryBundle(serialized);
        if (!inspected.ok) {
          setResultKind('invalid');
          return;
        }
        if (inspected.quarantineCount > 0) {
          setConfirmKind(null);
          setReviewKind(null);
          setResultKind('unusable');
          announce(COPY.recovery.unusable);
          return;
        }
        const keys = genericRestorePreselectedKeys(
          inspected.bundle.entries,
          key => localStorage.getItem(key),
          'legacy'
        );
        const restored = restoreRecoveryEntries(
          inspected.bundle,
          localStorage,
          keys,
          { authority: 'legacy' }
        );
        setConfirmKind(null);
        setReviewKind(null);
        if (restored.conflicts.length > 0) {
          setResultKind('difference');
          announce(COPY.recovery.restoreDifference);
          return;
        }
        await usePlayerStore.persist.rehydrate();
        await useCharacterStore.persist.rehydrate();
        const verified = await verifyLegacyCharacterRecovery({
          serialized,
          storage: localStorage,
          visibleCharacters: usePlayerStore.getState().characters,
        });
        if (verified.ok) {
          setResultKind('character-success');
          announce(COPY.recovery.restoreSuccess);
        } else {
          setResultKind('verification-failure');
          announce(COPY.recovery.restoreVerificationFailure);
        }
        return;
      }
      const staged = await stageCharacterRecoveryFromSerialized({
        factory: indexedDB,
        serialized,
        namespace,
      });
      stagedGenerationRef.current = staged.generation;
      setReviewKind(null);
      if (staged.quarantineCount > 0) {
        setConfirmKind(null);
        setResultKind('unusable');
        announce(COPY.recovery.unusable);
        return;
      }
      setConfirmKind('character-activate');
    } catch {
      setResultKind('invalid');
      announce(COPY.recovery.invalidFile);
    } finally {
      setBusy(false);
    }
  }, [namespace]);

  const handleConfirmCharacterActivate = useCallback(async () => {
    const serialized = serializedRef.current;
    const generation = stagedGenerationRef.current;
    if (!serialized || !generation) return;
    setBusy(true);
    setError(null);
    let database: IDBDatabase | undefined;
    try {
      database = await openRollkeeperDatabase({ factory: indexedDB });
      const activated = await activateImportedCharacterGeneration(database, {
        namespace,
        generation,
        confirmed: true,
        now: () => new Date().toISOString(),
        storage: localStorage,
      });
      if (!activated.activated) {
        setConfirmKind(null);
        setReviewKind(null);
        setResultKind('difference');
        announce(COPY.recovery.restoreDifference);
        return;
      }
      database.close();
      database = undefined;
      const reopened = await openRollkeeperDatabase({ factory: indexedDB });
      try {
        if (!applyActivatedRuntimeFromSelection(localStorage, namespace)) {
          throw new Error('Activated character selection is unavailable');
        }
        routeMountedStoresToActivatedAuthority();
        await usePlayerStore.persist.rehydrate();
        await useCharacterStore.persist.rehydrate();
        const verified = await verifyActivatedCharacterRecovery(reopened, {
          namespace,
          serialized,
          storage: localStorage,
          visibleCharacters: usePlayerStore.getState().characters,
        });
        setConfirmKind(null);
        setReviewKind(null);
        if (verified.ok) {
          setResultKind('character-success');
          announce(COPY.recovery.restoreSuccess);
        } else {
          setResultKind('verification-failure');
          announce(COPY.recovery.restoreVerificationFailure);
        }
      } finally {
        reopened.close();
      }
    } catch {
      setResultKind('verification-failure');
      announce(COPY.recovery.restoreVerificationFailure);
    } finally {
      database?.close();
      setBusy(false);
    }
  }, [namespace]);

  const handleSaveCurrent = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const captured = await captureActiveCharacterRecoveryBundle({
        factory: indexedDB,
        namespace,
        appVersion: APP_VERSION,
        runId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      });
      await initiateDeviceBackupDownload(
        captured.bundle,
        browserRecoveryRepository
      );
      announce(COPY.recovery.saveCurrent);
    } catch {
      try {
        const bundle = await captureDeviceBackup(localStorage, {
          appVersion: APP_VERSION,
          runId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        });
        await initiateDeviceBackupDownload(bundle, browserRecoveryRepository);
        announce(COPY.recovery.saveNew);
      } catch {
        setError(COPY.errors.currentCharacter);
        announce(COPY.errors.currentCharacter);
      }
    } finally {
      setBusy(false);
    }
  }, [namespace]);

  const handleDownloadDetails = useCallback(async () => {
    setBusy(true);
    try {
      const database = await openExistingRollkeeperDatabase({
        factory: indexedDB,
      });
      if (!database) {
        setError(COPY.recovery.chooseFileHint);
        return;
      }
      try {
        downloadText(
          await exportCurrentCharacterData(database, localStorage, namespace),
          'rollkeeper-recovery-details.json'
        );
      } finally {
        database.close();
      }
    } catch {
      setError(COPY.errors.currentCharacter);
    } finally {
      setBusy(false);
    }
  }, [namespace]);

  const handleDownloadOriginal = useCallback(() => {
    if (!serializedRef.current) {
      setError(COPY.recovery.chooseFileHint);
      return;
    }
    downloadText(serializedRef.current, 'rollkeeper-recovery-copy.json');
  }, []);

  const handleConfirmRollback = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const coverage = await inspectCurrentCharacterSafetyCoverage({
        factory: indexedDB,
        storage: localStorage,
        namespace,
      });
      const reopenVerified = await verifyCharacterRollbackGenerationAfterReopen(
        indexedDB,
        namespace,
        coverage.authority.generation,
        coverage.authority.epoch
      );
      const database = await openRollkeeperDatabase({ factory: indexedDB });
      try {
        const result = await rollbackCharacterAuthority(
          database,
          localStorage,
          {
            namespace,
            expectedEpoch: coverage.authority.epoch,
            confirmed: true,
            reopenVerified,
            now: () => new Date().toISOString(),
          }
        );
        setConfirmKind(null);
        if (result.state === 'RECOVERY_REQUIRED') {
          setResultKind('rollback-refusal');
          announce(COPY.recovery.rollbackRefusal);
        } else {
          announce(COPY.recovery.rollback);
          setOptionsOpen(false);
        }
      } finally {
        database.close();
      }
    } catch {
      setConfirmKind(null);
      setResultKind('rollback-refusal');
      announce(COPY.recovery.rollbackRefusal);
    } finally {
      setBusy(false);
    }
  }, [namespace]);

  const handleContinueActivation = useCallback(async () => {
    setBusy(true);
    try {
      const database = await openExistingRollkeeperDatabase({
        factory: indexedDB,
      });
      if (!database) return;
      try {
        const authority = await readCharacterAuthority(database, namespace);
        if (authority.authority !== 'indexedDB') return;
        const evidence = await readCharacterActivationEvidence(
          database,
          namespace,
          authority.generation
        );
        if (!evidence) return;
        repairRecoveredCharacterSelectionFromEvidence(
          localStorage,
          namespace,
          evidence
        );
        announce(COPY.recovery.continueActivation);
      } finally {
        database.close();
      }
    } finally {
      setBusy(false);
    }
  }, [namespace]);

  return {
    busy,
    optionsOpen,
    reviewKind,
    confirmKind,
    resultKind,
    liveStatus,
    error,
    inputRef,
    hasOriginal,
    setOptionsOpen,
    setConfirmKind,
    setReviewKind,
    handleChooseFile,
    handleConfirmGeneric,
    handleConfirmCharacter,
    handleConfirmCharacterActivate,
    handleSaveCurrent,
    handleDownloadDetails,
    handleDownloadOriginal,
    handleConfirmRollback,
    handleContinueActivation,
  };
}
