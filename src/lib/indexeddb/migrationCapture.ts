import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

export const LEGACY_EXACT_KEYS = [
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
] as const;

export interface LegacySnapshot {
  runId: string;
  key: string;
  captureNumber: number;
  presence: boolean;
  rawValue: string | null;
  sha256: string;
  byteCount: number;
  timestamp: string;
}

export interface SourceManifest {
  runId: string;
  createdAt: string;
  entries: LegacySnapshot[];
  manifestHash: string;
  recoveryManifestHash: string;
}

export interface CaptureLegacySourcesOptions {
  database: IDBDatabase;
  storage: Storage;
  runId: string;
  now: () => string;
  afterRead?: (key: string, captureNumber: number) => void | Promise<void>;
  maxCapturesPerKey?: number;
}

const encoder = new TextEncoder();

export async function sha256Bytes(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function storageKeys(storage: Storage): string[] {
  const discovered: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (
      key &&
      (key.startsWith('rollkeeper-') ||
        key.startsWith('location-canvas-') ||
        key.startsWith('battlemap-canvas-'))
    ) {
      discovered.push(key);
    }
  }
  return [...new Set([...LEGACY_EXACT_KEYS, ...discovered])].sort();
}

async function createSnapshot(
  runId: string,
  key: string,
  captureNumber: number,
  rawValue: string | null,
  timestamp: string
): Promise<LegacySnapshot> {
  return {
    runId,
    key,
    captureNumber,
    presence: rawValue !== null,
    rawValue,
    sha256: await sha256Bytes(rawValue ?? ''),
    byteCount: rawValue === null ? 0 : encoder.encode(rawValue).byteLength,
    timestamp,
  };
}

async function addSnapshot(
  database: IDBDatabase,
  snapshot: LegacySnapshot
): Promise<void> {
  const transaction = database.transaction('legacySnapshots', 'readwrite');
  transaction.objectStore('legacySnapshots').add(snapshot);
  await transactionComplete(transaction);
}

async function existingSnapshots(
  database: IDBDatabase,
  runId: string
): Promise<LegacySnapshot[]> {
  const transaction = database.transaction('legacySnapshots', 'readonly');
  const values = (await requestResult(
    transaction.objectStore('legacySnapshots').getAll()
  )) as LegacySnapshot[];
  await transactionComplete(transaction);
  return values.filter(snapshot => snapshot.runId === runId);
}

async function existingManifest(
  database: IDBDatabase,
  runId: string
): Promise<SourceManifest | null> {
  const transaction = database.transaction('meta', 'readonly');
  const record = (await requestResult(
    transaction.objectStore('meta').get(`source-manifest:${runId}`)
  )) as { value?: SourceManifest } | undefined;
  await transactionComplete(transaction);
  return record?.value ?? null;
}

export async function captureLegacySources(
  options: CaptureLegacySourcesOptions
): Promise<SourceManifest> {
  const committed = await existingManifest(options.database, options.runId);
  if (committed) return committed;

  const maximum = options.maxCapturesPerKey ?? 8;
  const previous = await existingSnapshots(options.database, options.runId);
  const finalEntries: LegacySnapshot[] = [];

  for (const key of storageKeys(options.storage)) {
    const keySnapshots = previous
      .filter(snapshot => snapshot.key === key)
      .sort((left, right) => left.captureNumber - right.captureNumber);
    let latest = keySnapshots.at(-1);
    let raw = options.storage.getItem(key);
    let captureNumber = latest?.captureNumber ?? 0;

    if (!latest || latest.rawValue !== raw) {
      captureNumber += 1;
      latest = await createSnapshot(
        options.runId,
        key,
        captureNumber,
        raw,
        options.now()
      );
      await addSnapshot(options.database, latest);
    }

    for (;;) {
      await options.afterRead?.(key, captureNumber);
      const reread = options.storage.getItem(key);
      if (reread === raw) break;
      if (captureNumber >= maximum) {
        throw new Error(`Legacy source changed during capture: ${key}`);
      }
      raw = reread;
      captureNumber += 1;
      latest = await createSnapshot(
        options.runId,
        key,
        captureNumber,
        raw,
        options.now()
      );
      await addSnapshot(options.database, latest);
    }
    finalEntries.push(latest);
  }

  const createdAt = options.now();
  const manifestHash = await sha256Bytes(
    JSON.stringify(
      finalEntries.map(
        ({ key, captureNumber, presence, sha256, byteCount }) => ({
          key,
          captureNumber,
          presence,
          sha256,
          byteCount,
        })
      )
    )
  );
  const recoveryManifestHash = await sha256Bytes(
    JSON.stringify(
      finalEntries
        .filter(entry => entry.presence)
        .map(({ key, byteCount, sha256 }) => ({
          key,
          byteCount,
          sha256,
          classification:
            key.startsWith('location-canvas-') ||
            key.startsWith('battlemap-canvas-')
              ? 'canvas'
              : LEGACY_EXACT_KEYS.includes(
                    key as (typeof LEGACY_EXACT_KEYS)[number]
                  ) || key.startsWith('rollkeeper-character:')
                ? 'managed'
                : 'retained-only',
        }))
    )
  );
  const manifest: SourceManifest = {
    runId: options.runId,
    createdAt,
    entries: finalEntries,
    manifestHash,
    recoveryManifestHash,
  };
  const transaction = options.database.transaction('meta', 'readwrite');
  transaction.objectStore('meta').add({
    key: `source-manifest:${options.runId}`,
    value: manifest,
  });
  await transactionComplete(transaction);
  return manifest;
}

export async function verifyPersistedCapture(options: {
  factory: IDBFactory;
  runId: string;
}): Promise<SourceManifest> {
  const database = await openRollkeeperDatabase({ factory: options.factory });
  try {
    const manifest = await existingManifest(database, options.runId);
    if (!manifest) throw new Error('Source manifest is missing after reopen');
    const snapshots = await existingSnapshots(database, options.runId);
    for (const entry of manifest.entries) {
      const persisted = snapshots.find(
        candidate =>
          candidate.key === entry.key &&
          candidate.captureNumber === entry.captureNumber
      );
      if (!persisted) {
        throw new Error(
          `Persisted capture mismatch after reopen: ${entry.key}`
        );
      }
      const actualHash = await sha256Bytes(persisted.rawValue ?? '');
      if (actualHash !== persisted.sha256) {
        throw new Error(`Persisted capture checksum mismatch: ${entry.key}`);
      }
      if (persisted.rawValue !== entry.rawValue) {
        throw new Error(`Persisted capture checksum mismatch: ${entry.key}`);
      }
    }
    return manifest;
  } finally {
    database.close();
  }
}
