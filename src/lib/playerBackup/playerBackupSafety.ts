import {
  type DeviceBackupEntryVectorItem,
  type DeviceBackupV1,
  captureDeviceBackup,
  deviceBackupEntryVectorsEqual,
  validateDeviceBackupJson,
} from '@/lib/deviceRecovery';
import { characterCutoverSelectionKey } from '@/lib/indexeddb/characterCutoverSelection';
import {
  inspectCurrentCharacterSafetyCoverage,
  retryCharacterMirrorJournal,
} from '@/lib/indexeddb/characterAuthority';
import {
  type ActiveCharacterRecoveryBundle,
  captureActiveCharacterRecoveryBundle,
} from '@/lib/indexeddb/characterRecoveryExport';
import type { StorageNamespace } from '@/lib/indexeddb/shadowJournal';
import { openExistingRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';

interface VerifiedReceiptGate {
  hasVerifiedDownloadReceipt(manifestHash: string): Promise<boolean>;
}

export async function inspectPlayerBackupCharacterCoverage(options: {
  factory: IDBFactory;
  storage: Storage;
  namespace: StorageNamespace;
}) {
  return inspectCurrentCharacterSafetyCoverage(options);
}

export async function savePlayerBackupSafetyFiles(options: {
  factory: IDBFactory;
  storage: Storage;
  namespace: StorageNamespace;
  appVersion: string;
  runId: string;
  timestamp: string;
  retryMirror?: typeof retryCharacterMirrorJournal;
}): Promise<{
  broad: DeviceBackupV1;
  currentCharacters: ActiveCharacterRecoveryBundle | null;
}> {
  const database = await openExistingRollkeeperDatabase({
    factory: options.factory,
  });
  if (!database) throw new Error('Active character saving is not available');
  try {
    await (options.retryMirror ?? retryCharacterMirrorJournal)(
      database,
      options.storage,
      options.namespace
    );
  } finally {
    database.close();
  }
  const coverage = await inspectCurrentCharacterSafetyCoverage({
    factory: options.factory,
    storage: options.storage,
    namespace: options.namespace,
  });
  const broad = await captureDeviceBackup(options.storage, {
    appVersion: options.appVersion,
    runId: options.runId,
    timestamp: options.timestamp,
  });
  if (coverage.broadFileCoversCurrentCharacters) {
    return { broad, currentCharacters: null };
  }
  return {
    broad,
    currentCharacters: await captureActiveCharacterRecoveryBundle({
      factory: options.factory,
      namespace: options.namespace,
      appVersion: options.appVersion,
      runId: `${options.runId}:characters`,
      timestamp: options.timestamp,
      expectedAuthority: coverage.authority,
    }),
  };
}

export async function assertFreshVerifiedBroadSafetyFile(options: {
  bundle: DeviceBackupV1;
  storage: Storage | ReadonlyMap<string, string>;
  receipts: VerifiedReceiptGate;
}): Promise<DeviceBackupV1> {
  await validateDeviceBackupJson(JSON.stringify(options.bundle));
  if (
    !(await options.receipts.hasVerifiedDownloadReceipt(
      options.bundle.manifestHash
    ))
  ) {
    throw new Error('A verified safety file is required');
  }
  const fresh = await captureDeviceBackup(options.storage, {
    appVersion: options.bundle.appVersion,
    runId: options.bundle.runId,
    timestamp: options.bundle.createdAt,
  });
  if (
    fresh.manifestHash !== options.bundle.manifestHash ||
    !deviceBackupEntryVectorsEqual(fresh, options.bundle)
  ) {
    throw new Error('The protected source changed after the safety file check');
  }
  return fresh;
}

interface OriginalActivationEvidence {
  selectedAt: string;
  recoveryManifestHash: string;
  recoveryRunId: string;
  recoveryCreatedAt: string;
  activatedEpoch: number;
  activatedGeneration: string;
}

type SelectionValidation = {
  namespace: StorageNamespace;
  playerBackupRunId: string;
  accountId: string;
  authorizedAt?: string;
} & (
  | {
      mode: 'first-activation';
      broadReceipt: Pick<
        DeviceBackupV1,
        'manifestHash' | 'runId' | 'createdAt'
      >;
    }
  | { mode: 'active-rebind'; originalEvidence: OriginalActivationEvidence }
);

function vectorWithoutSelection(
  entries: readonly DeviceBackupEntryVectorItem[],
  key: string
): DeviceBackupEntryVectorItem[] {
  return entries.filter(entry => entry.key !== key);
}

function validSelection(
  raw: string | null,
  options: SelectionValidation
): boolean {
  if (!raw) return false;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const authorizationMatches =
      value.version === 1 &&
      value.namespace === options.namespace &&
      value.family === 'character' &&
      typeof value.selectedAt === 'string' &&
      value.playerBackupRunId === options.playerBackupRunId &&
      value.playerBackupAccountId === options.accountId &&
      typeof value.playerBackupAuthorizedAt === 'string' &&
      (options.authorizedAt === undefined ||
        value.playerBackupAuthorizedAt === options.authorizedAt);
    if (!authorizationMatches) return false;
    if (options.mode === 'first-activation') {
      return (
        value.recoveryManifestHash === options.broadReceipt.manifestHash &&
        value.recoveryRunId === options.broadReceipt.runId &&
        value.recoveryCreatedAt === options.broadReceipt.createdAt &&
        value.activatedEpoch === undefined &&
        value.activatedGeneration === undefined
      );
    }
    const evidence = options.originalEvidence;
    return (
      value.selectedAt === evidence.selectedAt &&
      value.recoveryManifestHash === evidence.recoveryManifestHash &&
      value.recoveryRunId === evidence.recoveryRunId &&
      value.recoveryCreatedAt === evidence.recoveryCreatedAt &&
      value.activatedEpoch === evidence.activatedEpoch &&
      value.activatedGeneration === evidence.activatedGeneration
    );
  } catch {
    return false;
  }
}

export function compareProtectedSourceEntries(options: {
  before: readonly DeviceBackupEntryVectorItem[];
  after: readonly DeviceBackupEntryVectorItem[];
  selectionRaw: string | null;
  selection: SelectionValidation;
}): {
  protectedSourceUnchanged: boolean;
  selectionValid: boolean;
  changedKeys: string[];
} {
  const selectionKey = characterCutoverSelectionKey(
    options.selection.namespace
  );
  const beforeProtected = vectorWithoutSelection(options.before, selectionKey);
  const afterProtected = vectorWithoutSelection(options.after, selectionKey);
  const protectedSourceUnchanged = deviceBackupEntryVectorsEqual(
    beforeProtected,
    afterProtected
  );
  const expectedByKey = new Map(
    beforeProtected.map(entry => [
      entry.key,
      `${entry.byteCount}:${entry.sha256}`,
    ])
  );
  const actualByKey = new Map(
    afterProtected.map(entry => [
      entry.key,
      `${entry.byteCount}:${entry.sha256}`,
    ])
  );
  const changedKeys = [
    ...new Set([...expectedByKey.keys(), ...actualByKey.keys()]),
  ]
    .filter(key => expectedByKey.get(key) !== actualByKey.get(key))
    .sort();
  return {
    protectedSourceUnchanged,
    selectionValid: validSelection(options.selectionRaw, options.selection),
    changedKeys,
  };
}

export async function verifyFreshCurrentCharacterBundle(options: {
  expected: ActiveCharacterRecoveryBundle;
  factory: IDBFactory;
  namespace: StorageNamespace;
  receipts: VerifiedReceiptGate;
}): Promise<{ generation: string; epoch: number }> {
  await validateDeviceBackupJson(JSON.stringify(options.expected.bundle));
  if (
    !(await options.receipts.hasVerifiedDownloadReceipt(
      options.expected.bundle.manifestHash
    ))
  ) {
    throw new Error('A verified current character file is required');
  }
  const fresh = await captureActiveCharacterRecoveryBundle({
    factory: options.factory,
    namespace: options.namespace,
    appVersion: options.expected.bundle.appVersion,
    runId: options.expected.bundle.runId,
    timestamp: options.expected.bundle.createdAt,
    expectedAuthority: options.expected.authority,
  });
  if (
    fresh.bundle.manifestHash !== options.expected.bundle.manifestHash ||
    !deviceBackupEntryVectorsEqual(fresh.bundle, options.expected.bundle) ||
    fresh.authority.generation !== options.expected.authority.generation ||
    fresh.authority.epoch !== options.expected.authority.epoch
  ) {
    throw new Error('Current character data changed after the file check');
  }
  return {
    generation: fresh.authority.generation,
    epoch: fresh.authority.epoch,
  };
}
