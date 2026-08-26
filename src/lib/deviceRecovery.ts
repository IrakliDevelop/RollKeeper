const DEVICE_BACKUP_FORMAT = 'rollkeeper-device-backup' as const;
const DEVICE_BACKUP_FORMAT_VERSION = 1 as const;

const KNOWN_EXACT_KEYS = new Set([
  'rollkeeper-character',
  'rollkeeper-player-data',
  'rollkeeper-dm-data',
  'rollkeeper-encounter-data',
  'rollkeeper-npc-data',
  'rollkeeper-calendar-data',
  'rollkeeper-location-data',
  'rollkeeper-battlemap-data',
  'rollkeeper-combat-log',
  'rollkeeper-dm-magic-item-library',
]);

const CURRENT_PERSISTENCE_VERSIONS: Record<string, number> = {
  'rollkeeper-character': 0,
  'rollkeeper-player-data': 1,
  'rollkeeper-dm-data': 1,
  'rollkeeper-encounter-data': 2,
  'rollkeeper-npc-data': 4,
  'rollkeeper-calendar-data': 3,
  'rollkeeper-location-data': 0,
  'rollkeeper-battlemap-data': 0,
  'rollkeeper-combat-log': 1,
  'rollkeeper-dm-magic-item-library': 1,
};

export type RecoveryEntryClassification =
  | 'managed'
  | 'canvas'
  | 'retained-only';

export interface DeviceBackupEntry {
  key: string;
  rawValue: string;
  byteCount: number;
  sha256: string;
  classification: RecoveryEntryClassification;
}

export interface DeviceBackupValidationSummary {
  entryCount: number;
  totalBytes: number;
  validJsonCount: number;
  malformedJsonCount: number;
  futureVersionCount: number;
  retainedOnlyCount: number;
}

export interface DeviceBackupV1 {
  format: typeof DEVICE_BACKUP_FORMAT;
  formatVersion: typeof DEVICE_BACKUP_FORMAT_VERSION;
  appVersion: string;
  runId: string;
  createdAt: string;
  entries: DeviceBackupEntry[];
  manifestHash: string;
  validation: DeviceBackupValidationSummary;
}

export interface CaptureDeviceBackupOptions {
  appVersion: string;
  runId: string;
  timestamp: string;
}

type StorageSource = Storage | ReadonlyMap<string, string>;

function isMapSource(
  source: StorageSource
): source is ReadonlyMap<string, string> {
  return !('getItem' in source);
}

export interface RecoveryQuarantinePreview {
  key: string;
  reason: 'malformed-json' | 'future-version';
}

export interface RecoveryPreview {
  entryCount: number;
  totalBytes: number;
  restorableCount: number;
  identicalCount: number;
  conflictCount: number;
  quarantineCount: number;
  retainedOnlyCount: number;
  versions: Record<string, number>;
  conflicts: string[];
  quarantine: RecoveryQuarantinePreview[];
}

export interface RecoveryDownloadReceipt {
  runId: string;
  manifestHash: string;
  initiatedAt: string;
  verifiedAt?: string;
  /**
   * The verified bundle's per-entry hashes. Recovery evidence, not wizard
   * state: it is what lets a migration run resumed after a reload name the
   * exact key whose bytes changed, instead of only reporting that the device
   * manifest no longer matches.
   */
  entries?: { key: string; byteCount: number; sha256: string }[];
}

export interface RecoveryReceiptStore {
  recordDownloadReceipt(receipt: RecoveryDownloadReceipt): Promise<void>;
}

export interface RecoveryVerificationStore {
  verifyDownloadReceipt(receipt: {
    runId: string;
    manifestHash: string;
    verifiedAt: string;
  }): Promise<void>;
}

export interface StagedRecoveryGeneration {
  runId: string;
  status: 'inactive' | 'active';
  stagedAt: string;
  bundle: DeviceBackupV1;
  preview: RecoveryPreview;
}

export interface RecoveryGenerationRepository {
  stageGeneration(generation: StagedRecoveryGeneration): Promise<void>;
}

export interface RecoveryGenerationControl {
  activateGeneration(runId: string): Promise<void>;
}

export interface RecoveryGateReceiptStore {
  hasDownloadReceipt(manifestHash: string): Promise<boolean>;
}

interface WritableStorageTarget {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RecoveryRestoreResult {
  restored: string[];
  identical: string[];
  conflicts: string[];
  quarantined: string[];
}

function sourceEntries(source: StorageSource): Array<[string, string]> {
  if (isMapSource(source)) return [...source.entries()];
  const entries: Array<[string, string]> = [];
  for (let index = 0; index < source.length; index += 1) {
    const key = source.key(index);
    if (key === null) continue;
    const value = source.getItem(key);
    if (value !== null) entries.push([key, value]);
  }
  return entries;
}

function sourceValue(source: StorageSource, key: string): string | null {
  if (isMapSource(source)) return source.get(key) ?? null;
  return source.getItem(key);
}

function classificationForKey(key: string): RecoveryEntryClassification | null {
  if (KNOWN_EXACT_KEYS.has(key) || key.startsWith('rollkeeper-character:')) {
    return 'managed';
  }
  if (
    key.startsWith('location-canvas-') ||
    key.startsWith('battlemap-canvas-')
  ) {
    return 'canvas';
  }
  if (key.startsWith('rollkeeper-')) return 'retained-only';
  return null;
}

const utf8 = new TextEncoder();

function supportedVersionForKey(key: string): number | null {
  if (key.startsWith('rollkeeper-character:')) return 0;
  return CURRENT_PERSISTENCE_VERSIONS[key] ?? null;
}

function inspectEntry(entry: DeviceBackupEntry): {
  validJson: boolean;
  futureVersion: boolean;
  version?: number;
} {
  if (entry.classification === 'retained-only') {
    return { validJson: false, futureVersion: false };
  }
  try {
    const parsed = JSON.parse(entry.rawValue) as { version?: unknown } | null;
    const supportedVersion = supportedVersionForKey(entry.key);
    return {
      validJson: true,
      futureVersion:
        supportedVersion !== null &&
        typeof parsed?.version === 'number' &&
        parsed.version > supportedVersion,
      version: typeof parsed?.version === 'number' ? parsed.version : undefined,
    };
  } catch {
    return { validJson: false, futureVersion: false };
  }
}

export function previewRecoveryBundle(
  bundle: DeviceBackupV1,
  target: StorageSource
): RecoveryPreview {
  const conflicts: string[] = [];
  const quarantine: RecoveryQuarantinePreview[] = [];
  const versions: Record<string, number> = {};
  let restorableCount = 0;
  let identicalCount = 0;

  for (const entry of bundle.entries) {
    const current = sourceValue(target, entry.key);
    if (current === null) restorableCount += 1;
    else if (current === entry.rawValue) identicalCount += 1;
    else conflicts.push(entry.key);

    const inspected = inspectEntry(entry);
    if (inspected.version !== undefined)
      versions[entry.key] = inspected.version;
    if (entry.classification !== 'retained-only' && !inspected.validJson) {
      quarantine.push({ key: entry.key, reason: 'malformed-json' });
    } else if (inspected.futureVersion) {
      quarantine.push({ key: entry.key, reason: 'future-version' });
    }
  }

  return {
    entryCount: bundle.entries.length,
    totalBytes: bundle.entries.reduce(
      (total, entry) => total + entry.byteCount,
      0
    ),
    restorableCount,
    identicalCount,
    conflictCount: conflicts.length,
    quarantineCount: quarantine.length,
    retainedOnlyCount: bundle.entries.filter(
      entry => entry.classification === 'retained-only'
    ).length,
    versions,
    conflicts,
    quarantine,
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', utf8.encode(value));
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function isBackupEntry(value: unknown): value is DeviceBackupEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<DeviceBackupEntry>;
  return (
    typeof entry.key === 'string' &&
    typeof entry.rawValue === 'string' &&
    typeof entry.byteCount === 'number' &&
    typeof entry.sha256 === 'string' &&
    (entry.classification === 'managed' ||
      entry.classification === 'canvas' ||
      entry.classification === 'retained-only')
  );
}

function parseBackupShape(serialized: string): DeviceBackupV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('Recovery bundle is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid recovery bundle');
  }
  const bundle = parsed as Partial<DeviceBackupV1>;
  if (bundle.format !== DEVICE_BACKUP_FORMAT) {
    throw new Error('Invalid recovery bundle format');
  }
  if (bundle.formatVersion !== DEVICE_BACKUP_FORMAT_VERSION) {
    throw new Error('Unsupported recovery bundle version');
  }
  if (
    typeof bundle.appVersion !== 'string' ||
    typeof bundle.runId !== 'string' ||
    typeof bundle.createdAt !== 'string' ||
    typeof bundle.manifestHash !== 'string' ||
    !Array.isArray(bundle.entries) ||
    !bundle.entries.every(isBackupEntry) ||
    typeof bundle.validation !== 'object' ||
    bundle.validation === null
  ) {
    throw new Error('Invalid recovery bundle');
  }
  return bundle as DeviceBackupV1;
}

function manifestPayload(entries: DeviceBackupEntry[]): string {
  return JSON.stringify(
    entries.map(({ key, byteCount, sha256: entryHash, classification }) => ({
      key,
      byteCount,
      sha256: entryHash,
      classification,
    }))
  );
}

/**
 * Computes the same aggregate hash `captureDeviceBackup` stamps onto
 * `manifestHash`, from an already-captured entry list. Recovery-receipt
 * enrichment reuses this — never a re-derivation — so that its equality
 * check is the same manifest computation the original capture used.
 */
export async function computeManifestHash(
  entries: DeviceBackupEntry[]
): Promise<string> {
  return sha256(manifestPayload(entries));
}

export async function validateDeviceBackupJson(
  serialized: string
): Promise<DeviceBackupV1> {
  const bundle = parseBackupShape(serialized);
  for (const entry of bundle.entries) {
    const actualBytes = utf8.encode(entry.rawValue).byteLength;
    const actualHash = await sha256(entry.rawValue);
    if (actualBytes !== entry.byteCount || actualHash !== entry.sha256) {
      throw new Error(`Recovery entry checksum mismatch: ${entry.key}`);
    }
  }
  const actualManifestHash = await sha256(manifestPayload(bundle.entries));
  if (actualManifestHash !== bundle.manifestHash) {
    throw new Error('Recovery manifest checksum mismatch');
  }
  return bundle;
}

export async function initiateDeviceBackupDownload(
  bundle: DeviceBackupV1,
  receipts: RecoveryReceiptStore
): Promise<void> {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rollkeeper-browser-backup_${bundle.createdAt.slice(0, 10)}_${bundle.manifestHash}.json`;
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
    await receipts.recordDownloadReceipt({
      runId: bundle.runId,
      manifestHash: bundle.manifestHash,
      initiatedAt: new Date().toISOString(),
      entries: bundle.entries.map(({ key, byteCount, sha256 }) => ({
        key,
        byteCount,
        sha256,
      })),
    });
  } finally {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export async function verifyDownloadedDeviceBackup(
  serialized: string,
  expected: DeviceBackupV1,
  receipts: RecoveryVerificationStore,
  options: { now?: () => string } = {}
): Promise<DeviceBackupV1> {
  const bundle = await validateDeviceBackupJson(serialized);
  if (
    bundle.runId !== expected.runId ||
    bundle.manifestHash !== expected.manifestHash
  ) {
    throw new Error(
      'The selected recovery file does not match the current preview'
    );
  }
  await receipts.verifyDownloadReceipt({
    runId: bundle.runId,
    manifestHash: bundle.manifestHash,
    verifiedAt: (options.now ?? (() => new Date().toISOString()))(),
  });
  return bundle;
}

export function downloadRawRecoveryEntries(
  bundle: DeviceBackupV1,
  selectedKeys: readonly string[]
): void {
  const selected = new Set(selectedKeys);
  const payload = {
    format: 'rollkeeper-raw-recovery-data',
    sourceRunId: bundle.runId,
    entries: bundle.entries
      .filter(entry => selected.has(entry.key))
      .map(({ key, rawValue }) => ({ key, rawValue })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rollkeeper-quarantine_${bundle.runId}.json`;
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export async function stageRecoveryBundle(
  serialized: string,
  target: StorageSource,
  repository: RecoveryGenerationRepository
): Promise<StagedRecoveryGeneration> {
  const bundle = await validateDeviceBackupJson(serialized);
  const generation: StagedRecoveryGeneration = {
    runId: bundle.runId,
    status: 'inactive',
    stagedAt: new Date().toISOString(),
    bundle,
    preview: previewRecoveryBundle(bundle, target),
  };
  await repository.stageGeneration(generation);
  return generation;
}

export function restoreRecoveryEntries(
  bundle: DeviceBackupV1,
  target: WritableStorageTarget,
  selectedKeys: readonly string[]
): RecoveryRestoreResult {
  const selected = new Set(selectedKeys);
  const result: RecoveryRestoreResult = {
    restored: [],
    identical: [],
    conflicts: [],
    quarantined: [],
  };

  for (const entry of bundle.entries) {
    if (!selected.has(entry.key)) continue;
    const inspected = inspectEntry(entry);
    if (
      entry.classification !== 'retained-only' &&
      (!inspected.validJson || inspected.futureVersion)
    ) {
      result.quarantined.push(entry.key);
      continue;
    }
    const current = target.getItem(entry.key);
    if (current === null) {
      target.setItem(entry.key, entry.rawValue);
      result.restored.push(entry.key);
    } else if (current === entry.rawValue) {
      result.identical.push(entry.key);
    } else {
      result.conflicts.push(entry.key);
    }
  }
  return result;
}

export async function activateRecoveryGeneration(
  runId: string,
  confirmed: boolean,
  repository: RecoveryGenerationControl
): Promise<void> {
  if (!confirmed) {
    throw new Error(
      'Recovery generation activation requires explicit confirmation'
    );
  }
  await repository.activateGeneration(runId);
}

export async function assertStorageMigrationRecoveryGate(
  source: StorageSource,
  bundle: DeviceBackupV1,
  receipts: RecoveryGateReceiptStore
): Promise<void> {
  const hasReceipt = await receipts.hasDownloadReceipt(bundle.manifestHash);
  if (!hasReceipt) {
    throw new Error('Storage migration requires a matching recovery download');
  }
  const current = await captureDeviceBackup(source, {
    appVersion: bundle.appVersion,
    runId: bundle.runId,
    timestamp: bundle.createdAt,
  });
  if (current.manifestHash !== bundle.manifestHash) {
    throw new Error(
      'Storage migration refused because the source manifest changed'
    );
  }
}

export async function captureDeviceBackup(
  source: StorageSource,
  options: CaptureDeviceBackupOptions
): Promise<DeviceBackupV1> {
  const selected = sourceEntries(source)
    .map(([key, rawValue]) => ({
      key,
      rawValue,
      classification: classificationForKey(key),
    }))
    .filter(
      (entry): entry is Omit<DeviceBackupEntry, 'byteCount' | 'sha256'> =>
        entry.classification !== null
    )
    .sort((left, right) => left.key.localeCompare(right.key));

  const entries = await Promise.all(
    selected.map(async entry => ({
      ...entry,
      byteCount: utf8.encode(entry.rawValue).byteLength,
      sha256: await sha256(entry.rawValue),
    }))
  );
  const manifestHash = await sha256(manifestPayload(entries));
  const inspected = entries.map(inspectEntry);

  return {
    format: DEVICE_BACKUP_FORMAT,
    formatVersion: DEVICE_BACKUP_FORMAT_VERSION,
    appVersion: options.appVersion,
    runId: options.runId,
    createdAt: options.timestamp,
    entries,
    manifestHash,
    validation: {
      entryCount: entries.length,
      totalBytes: entries.reduce((total, entry) => total + entry.byteCount, 0),
      validJsonCount: inspected.filter(result => result.validJson).length,
      malformedJsonCount: inspected.filter(
        (result, index) =>
          entries[index].classification !== 'retained-only' && !result.validJson
      ).length,
      futureVersionCount: inspected.filter(result => result.futureVersion)
        .length,
      retainedOnlyCount: entries.filter(
        entry => entry.classification === 'retained-only'
      ).length,
    },
  };
}
