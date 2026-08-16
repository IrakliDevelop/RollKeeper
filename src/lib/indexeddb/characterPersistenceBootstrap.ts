import {
  readCharacterAuthority,
  retryCharacterMirrorJournal,
} from './characterAuthority';
import { isCharacterFamilyKey } from './characterFamily';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from './localDatabase';
import { runCharacterIndexedDbMigration } from './characterMigrationEngine';
import { setCharacterRuntimeAuthority } from './characterPersistenceRuntime';
import { validateLegacyEnvelope } from './migrationValidation';
import { reconcileStaleCharacterMirrorWrite } from './characterStaleMirror';
import type { StorageNamespace } from './shadowJournal';

export interface BootstrapCharacterPersistenceOptions {
  factory: IDBFactory;
  storage: Storage;
  namespace: StorageNamespace;
  runId: string;
  ownerId: string;
  now: () => string;
  nowMs: () => number;
  recoveryGate: { hasDownloadReceipt(hash: string): Promise<boolean> };
  requiredRecoveryManifestHash?: string;
  activatedEpoch?: number;
  locks?: Parameters<typeof runCharacterIndexedDbMigration>[0]['locks'];
  storageManager?: Parameters<
    typeof runCharacterIndexedDbMigration
  >[0]['storageManager'];
}

const inFlightByFactory = new WeakMap<
  IDBFactory,
  Map<StorageNamespace, Promise<unknown>>
>();

async function runCharacterPersistenceBootstrap(
  options: BootstrapCharacterPersistenceOptions
) {
  const database = await openRollkeeperDatabase({ factory: options.factory });
  try {
    const authority = await readCharacterAuthority(database, options.namespace);
    if (authority.authority === 'indexedDB') {
      setCharacterRuntimeAuthority(authority);
      try {
        const transaction = database.transaction('kvGenerations', 'readonly');
        const rows = (await requestResult(
          transaction.objectStore('kvGenerations').getAll()
        )) as Array<{
          namespace: StorageNamespace;
          generation: string;
          key: string;
          presence: boolean;
          rawValue: string | null;
        }>;
        await transactionComplete(transaction);
        const activeRows = rows.filter(
          row =>
            row.namespace === options.namespace &&
            row.generation === authority.generation &&
            isCharacterFamilyKey(row.key)
        );
        if (
          activeRows.length === 0 ||
          activeRows.some(
            row =>
              row.presence &&
              (row.rawValue === null ||
                validateLegacyEnvelope(row.key, row.rawValue).status ===
                  'quarantined')
          )
        ) {
          throw new Error('Active character generation is corrupt');
        }
        for (const row of activeRows) {
          if (!row.presence || row.rawValue === null) continue;
          const mirror = options.storage.getItem(row.key);
          if (mirror === row.rawValue) continue;
          await reconcileStaleCharacterMirrorWrite(database, options.storage, {
            namespace: options.namespace,
            key: row.key,
            observedRawValue: mirror,
            conflictId: crypto.randomUUID(),
            now: options.now,
          });
        }
        await retryCharacterMirrorJournal(
          database,
          options.storage,
          options.namespace
        );
        return { state: 'IDB_PRIMARY' as const, ...authority };
      } catch (cause) {
        const keys = `migration-state:${options.namespace}:character`;
        const transaction = database.transaction('meta', 'readwrite');
        transaction.objectStore('meta').put({
          key: keys,
          state: 'RECOVERY_REQUIRED',
          runId: authority.generation,
          checkpointAt: options.now(),
        });
        await transactionComplete(transaction);
        return {
          state: 'RECOVERY_REQUIRED' as const,
          ...authority,
          error: cause instanceof Error ? cause.message : String(cause),
        };
      }
    }
    if (authority.rollbackGeneration) {
      setCharacterRuntimeAuthority({
        authority: 'localStorage',
        epoch: authority.epoch,
      });
      return { state: 'ROLLED_BACK' as const, ...authority };
    }
  } finally {
    database.close();
  }

  const result = await runCharacterIndexedDbMigration({
    factory: options.factory,
    storage: options.storage,
    namespace: options.namespace,
    runId: options.runId,
    ownerId: options.ownerId,
    now: options.now,
    nowMs: options.nowMs,
    recoveryGate: options.recoveryGate,
    requiredRecoveryManifestHash: options.requiredRecoveryManifestHash,
    locks: options.locks,
    storageManager: options.storageManager,
  });
  setCharacterRuntimeAuthority({ authority: 'localStorage', epoch: 0 });
  return result;
}

export function bootstrapCharacterPersistence(
  options: BootstrapCharacterPersistenceOptions
) {
  let namespaces = inFlightByFactory.get(options.factory);
  if (!namespaces) {
    namespaces = new Map();
    inFlightByFactory.set(options.factory, namespaces);
  }
  const current = namespaces.get(options.namespace);
  if (current)
    return current as ReturnType<typeof runCharacterPersistenceBootstrap>;
  const pending = runCharacterPersistenceBootstrap(options)
    .catch(cause => {
      if (options.activatedEpoch === undefined) throw cause;
      return {
        state: 'RECOVERY_REQUIRED' as const,
        authority: 'indexedDB' as const,
        namespace: options.namespace,
        family: 'character' as const,
        epoch: options.activatedEpoch,
        error: cause instanceof Error ? cause.message : String(cause),
      };
    })
    .finally(() => {
      namespaces!.delete(options.namespace);
    });
  namespaces.set(options.namespace, pending);
  return pending;
}
