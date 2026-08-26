import { captureDeviceBackup } from '../deviceRecovery';
import {
  commitCharacterCutover,
  type CharacterActivationEvidenceInput,
  type CharacterCutoverGates,
} from './characterAuthority';
import { isCharacterFamilyKey } from './characterFamily';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from './localDatabase';
import { verifyPersistedCapture } from './migrationCapture';
import {
  freezeCharacterPersistenceForCutover,
  setCharacterRuntimeAuthority,
} from './characterPersistenceRuntime';
import type { StorageNamespace } from './shadowJournal';

interface InspectionOptions {
  factory: IDBFactory;
  storage: Storage;
  namespace: StorageNamespace;
  recoveryManifestHash: string;
  recoveryRunId: string;
  recoveryCreatedAt: string;
  appVersion: string;
  recoveryGate: { hasDownloadReceipt(hash: string): Promise<boolean> };
  verifyProtectedSource?: () => Promise<boolean>;
  activationEvidence?: CharacterActivationEvidenceInput;
}

export interface CharacterCutoverInspection {
  generation: string;
  ready: boolean;
  gates: CharacterCutoverGates;
  quarantineCount: number;
  journalCount: number;
}

function currentCharacterKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isCharacterFamilyKey(key)) keys.push(key);
  }
  return keys;
}

export async function inspectCharacterCutoverReadiness(
  options: InspectionOptions
): Promise<CharacterCutoverInspection> {
  const database = await openRollkeeperDatabase({ factory: options.factory });
  try {
    const transaction = database.transaction(
      ['meta', 'kvGenerations', 'quarantine', 'journal'],
      'readonly'
    );
    const state = (await requestResult(
      transaction
        .objectStore('meta')
        .get(`migration-state:${options.namespace}:character`)
    )) as { state?: string; runId?: string } | undefined;
    if (state?.state !== 'CUTOVER_READY' || !state.runId) {
      throw new Error('Character migration is not ready for cutover');
    }
    const generation = state.runId;
    const rows = (await requestResult(
      transaction.objectStore('kvGenerations').getAll()
    )) as Array<{
      namespace: StorageNamespace;
      generation: string;
      key: string;
      rawValue: string | null;
      presence: boolean;
    }>;
    const quarantines = (await requestResult(
      transaction.objectStore('quarantine').getAll()
    )) as Array<{ namespace?: StorageNamespace; runId?: string }>;
    const journals = (await requestResult(
      transaction.objectStore('journal').getAll()
    )) as Array<{ namespace?: StorageNamespace; generation?: string }>;
    await transactionComplete(transaction);

    const activeRows = rows.filter(
      row =>
        row.namespace === options.namespace &&
        row.generation === generation &&
        isCharacterFamilyKey(row.key)
    );
    const byKey = new Map(activeRows.map(row => [row.key, row]));
    const parity = currentCharacterKeys(options.storage).every(key => {
      const row = byKey.get(key);
      return (
        row?.presence === true && row.rawValue === options.storage.getItem(key)
      );
    });
    const quarantineCount = quarantines.filter(
      row => row.namespace === options.namespace && row.runId === generation
    ).length;
    const journalCount = journals.filter(
      row =>
        row.namespace === options.namespace && row.generation === generation
    ).length;
    let captureVerifiedAfterReopen = true;
    try {
      await verifyPersistedCapture({
        factory: options.factory,
        runId: generation,
      });
    } catch {
      captureVerifiedAfterReopen = false;
    }
    const current = options.verifyProtectedSource
      ? null
      : await captureDeviceBackup(options.storage, {
          appVersion: options.appVersion,
          runId: options.recoveryRunId,
          timestamp: options.recoveryCreatedAt,
        });
    const gates: CharacterCutoverGates = {
      recoveryReceipt: await options.recoveryGate.hasDownloadReceipt(
        options.recoveryManifestHash
      ),
      sourceManifestUnchanged: options.verifyProtectedSource
        ? await options.verifyProtectedSource()
        : current!.manifestHash === options.recoveryManifestHash,
      captureVerifiedAfterReopen,
      noQuarantine: quarantineCount === 0,
      parity,
      journalEmpty: journalCount === 0,
    };
    return {
      generation,
      ready: Object.values(gates).every(Boolean),
      gates,
      quarantineCount,
      journalCount,
    };
  } finally {
    database.close();
  }
}

export async function activatePreparedCharacterCutover(
  options: InspectionOptions & { confirmed: boolean; now: () => string }
) {
  if (!options.confirmed) {
    throw new Error('Character cutover requires explicit confirmation');
  }
  const releaseWrites = await freezeCharacterPersistenceForCutover();
  try {
    const inspection = await inspectCharacterCutoverReadiness(options);
    if (!inspection.ready) {
      throw new Error('Character cutover gate is not satisfied');
    }
    const database = await openRollkeeperDatabase({ factory: options.factory });
    try {
      const authority = await commitCharacterCutover(database, {
        namespace: options.namespace,
        generation: inspection.generation,
        confirmed: true,
        gates: inspection.gates,
        activationEvidence: options.activationEvidence,
        now: options.now,
      });
      setCharacterRuntimeAuthority(authority);
      return authority;
    } finally {
      database.close();
    }
  } finally {
    releaseWrites();
  }
}
