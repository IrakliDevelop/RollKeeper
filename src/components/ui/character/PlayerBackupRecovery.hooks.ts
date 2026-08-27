'use client';

import { useCallback, useRef, useState } from 'react';

import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  captureDeviceBackup,
  initiateDeviceBackupDownload,
  restoreRecoveryEntries,
} from '@/lib/deviceRecovery';
import { isCharacterFamilyKey } from '@/lib/indexeddb/characterFamily';
import {
  inspectCharacterRecoveryBundle,
  stageCharacterRecoveryFromSerialized,
  activateImportedCharacterGeneration,
  verifyActivatedCharacterRecovery,
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
} from '@/lib/indexeddb/characterAuthority';
import {
  openExistingRollkeeperDatabase,
  openRollkeeperDatabase,
} from '@/lib/indexeddb/localDatabase';
import { repairRecoveredCharacterSelectionFromEvidence } from '@/lib/indexeddb/characterCutoverSelection';
import type { StorageNamespace } from '@/lib/indexeddb/shadowJournal';
import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';
import { genericRestorePreselectedKeys } from '@/lib/playerBackup/playerBackupRecoveryPolicy';
import { readPlayerBackupCapabilities } from '@/lib/playerBackup/playerBackupFlags';
import { APP_VERSION } from '@/utils/constants';

export type RecoveryReviewKind = 'generic' | 'character' | 'unusable';
export type RecoveryConfirmKind = 'generic' | 'character' | 'rollback' | null;
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

function isCharacterOnly(entries: readonly { key: string }[]): boolean {
  return (
    entries.length > 0 &&
    entries.every(entry => isCharacterFamilyKey(entry.key))
  );
}

function hasLocalCharacterFamily(storage: Storage): boolean {
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isCharacterFamilyKey(key) && storage.getItem(key) !== null) {
      return true;
    }
  }
  return false;
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
      const inspected = await inspectCharacterRecoveryBundle(serialized);
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
      setReviewKind(
        isCharacterOnly(inspected.bundle.entries) ? 'character' : 'generic'
      );
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
      const inspected = await inspectCharacterRecoveryBundle(serialized);
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
        authority.authority === 'localStorage' &&
        !capabilities.calls.localAuthorityMutation &&
        hasLocalCharacterFamily(localStorage)
      ) {
        const inspected = await inspectCharacterRecoveryBundle(serialized);
        if (!inspected.ok) {
          setResultKind('invalid');
          return;
        }
        const keys = genericRestorePreselectedKeys(
          inspected.bundle.entries,
          key => localStorage.getItem(key),
          'legacy'
        );
        restoreRecoveryEntries(inspected.bundle, localStorage, keys, {
          authority: 'legacy',
        });
        setConfirmKind(null);
        setReviewKind(null);
        setResultKind('generic-success');
        announce(COPY.recovery.restoreMissingResult);
        return;
      }
      const staged = await stageCharacterRecoveryFromSerialized({
        factory: indexedDB,
        serialized,
        namespace,
      });
      if (staged.quarantineCount > 0) {
        setConfirmKind(null);
        setResultKind('unusable');
        announce(COPY.recovery.unusable);
        return;
      }
      const database = await openRollkeeperDatabase({ factory: indexedDB });
      try {
        const activated = await activateImportedCharacterGeneration(database, {
          namespace,
          generation: staged.generation,
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
        const reopened = await openRollkeeperDatabase({ factory: indexedDB });
        try {
          const verified = await verifyActivatedCharacterRecovery(reopened, {
            namespace,
            serialized,
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
        database.close();
        setResultKind('verification-failure');
        announce(COPY.recovery.restoreVerificationFailure);
      }
    } catch {
      setResultKind('invalid');
      announce(COPY.recovery.invalidFile);
    } finally {
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
      const database = await openRollkeeperDatabase({ factory: indexedDB });
      try {
        const result = await rollbackCharacterAuthority(
          database,
          localStorage,
          {
            namespace,
            expectedEpoch: coverage.authority.epoch,
            confirmed: true,
            reopenVerified:
              coverage.parity && coverage.matchingJournalCount === 0,
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
    handleSaveCurrent,
    handleDownloadDetails,
    handleDownloadOriginal,
    handleConfirmRollback,
    handleContinueActivation,
  };
}
