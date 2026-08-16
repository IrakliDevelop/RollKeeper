import type { StateStorage } from 'zustand/middleware';

import {
  commitCharacterFamilyWrite,
  scopedCharacterAuthorityKeys,
  type CharacterWriteResult,
  type IndexedDbCharacterAuthority,
} from './characterAuthority';
import { isCharacterFamilyKey } from './characterFamily';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from './localDatabase';
import { createSafeStorage } from '../safeStorage';
import { readCharacterCutoverSelection } from './characterCutoverSelection';

type RuntimeAuthority =
  | IndexedDbCharacterAuthority
  | { authority: 'localStorage'; epoch: number };

let runtimeAuthority: RuntimeAuthority = {
  authority: 'localStorage',
  epoch: 0,
};
let pendingWrite: Promise<void> = Promise.resolve();
let latestWriteSaved = true;
let activeBootstrapPending = false;
let cutoverBarrier:
  | { promise: Promise<void>; release: () => void; released: boolean }
  | undefined;

export async function freezeCharacterPersistenceForCutover(): Promise<
  () => void
> {
  if (cutoverBarrier) throw new Error('Character cutover is already frozen');
  const writesBeforeFreeze = pendingWrite;
  let resolveBarrier!: () => void;
  const barrier = {
    promise: new Promise<void>(resolve => {
      resolveBarrier = resolve;
    }),
    release: resolveBarrier,
    released: false,
  };
  cutoverBarrier = barrier;
  await writesBeforeFreeze;
  return () => {
    if (barrier.released) return;
    barrier.released = true;
    if (cutoverBarrier === barrier) cutoverBarrier = undefined;
    barrier.release();
  };
}

export function setCharacterRuntimeAuthority(
  authority: RuntimeAuthority
): void {
  runtimeAuthority = authority;
}

function initializeActivatedRuntimeFromSelection(): void {
  if (
    runtimeAuthority.authority === 'indexedDB' ||
    typeof localStorage === 'undefined'
  ) {
    return;
  }
  const selection = readCharacterCutoverSelection(localStorage, 'guest');
  if (
    selection?.activatedEpoch === undefined ||
    !selection.activatedGeneration
  ) {
    return;
  }
  runtimeAuthority = {
    authority: 'indexedDB',
    namespace: 'guest',
    family: 'character',
    generation: selection.activatedGeneration,
    epoch: selection.activatedEpoch,
    committedAt: selection.selectedAt,
  };
  activeBootstrapPending = true;
}

export function finishCharacterPersistenceBootstrap(): void {
  activeBootstrapPending = false;
}

export async function awaitCharacterPersistence(): Promise<boolean> {
  await pendingWrite;
  return latestWriteSaved;
}

interface RuntimeStorageOptions {
  backing: Storage;
  participant: boolean;
  openDatabase?: () => Promise<IDBDatabase>;
  commit?: typeof commitCharacterFamilyWrite;
  randomId?: () => string;
  now?: () => string;
  shadowLegacyWrite?: (key: string, value: string) => Promise<void>;
  readActive?: (
    authority: IndexedDbCharacterAuthority,
    key: string
  ) => Promise<string | null>;
}

async function readActiveCharacterFamilyValue(
  authority: IndexedDbCharacterAuthority,
  key: string
): Promise<string | null> {
  const database = await openRollkeeperDatabase();
  try {
    const transaction = database.transaction(
      ['meta', 'kvGenerations'],
      'readonly'
    );
    const pointer = (await requestResult(
      transaction
        .objectStore('meta')
        .get(scopedCharacterAuthorityKeys(authority.namespace).pointer)
    )) as IndexedDbCharacterAuthority | undefined;
    const row = (await requestResult(
      transaction
        .objectStore('kvGenerations')
        .get([authority.namespace, authority.generation, key])
    )) as { presence?: boolean; rawValue?: string | null } | undefined;
    await transactionComplete(transaction);
    if (
      pointer?.authority !== 'indexedDB' ||
      pointer.generation !== authority.generation ||
      pointer.epoch !== authority.epoch
    ) {
      throw new Error('Character authority changed during hydration');
    }
    return row?.presence === true ? (row.rawValue ?? null) : null;
  } finally {
    database.close();
  }
}

export function createCharacterFamilyStateStorage(
  options: RuntimeStorageOptions
): StateStorage {
  const legacy = createSafeStorage(options.backing);
  if (!options.participant) return legacy;
  initializeActivatedRuntimeFromSelection();

  return {
    getItem: key => {
      if (!isCharacterFamilyKey(key)) return null;
      if (runtimeAuthority.authority === 'localStorage') {
        return options.backing.getItem(key);
      }
      return (options.readActive ?? readActiveCharacterFamilyValue)(
        runtimeAuthority,
        key
      );
    },
    setItem: (key, value) => {
      if (!isCharacterFamilyKey(key)) return;
      if (activeBootstrapPending) {
        latestWriteSaved = false;
        return Promise.resolve();
      }
      if (cutoverBarrier) {
        const barrier = cutoverBarrier.promise;
        const queuedBehind = pendingWrite;
        latestWriteSaved = false;
        pendingWrite = queuedBehind.then(async () => {
          await barrier;
          await createCharacterFamilyStateStorage(options).setItem(key, value);
        });
        return pendingWrite;
      }
      if (runtimeAuthority.authority === 'localStorage') {
        legacy.setItem(key, value);
        const shadow =
          options.shadowLegacyWrite ??
          (async (shadowKey: string, shadowValue: string) => {
            const { recordAuthoritativeShadowWrite } = await import(
              './browserShadowWriter'
            );
            await recordAuthoritativeShadowWrite(shadowKey, shadowValue, {
              namespace: 'guest',
              family: 'character',
            });
          });
        pendingWrite = shadow(key, value).catch(() => undefined);
        latestWriteSaved = options.backing.getItem(key) === value;
        return pendingWrite;
      }

      const authority = runtimeAuthority;
      const open = options.openDatabase ?? (() => openRollkeeperDatabase());
      const commit = options.commit ?? commitCharacterFamilyWrite;
      pendingWrite = (async () => {
        let database: IDBDatabase | undefined;
        try {
          database = await open();
          const result: CharacterWriteResult = await commit(
            database,
            options.backing,
            {
              namespace: authority.namespace,
              key,
              rawValue: value,
              expectedEpoch: authority.epoch,
              journalId: (options.randomId ?? (() => crypto.randomUUID()))(),
              now: options.now ?? (() => new Date().toISOString()),
            }
          );
          latestWriteSaved = result.saved;
        } catch {
          latestWriteSaved = false;
        } finally {
          database?.close();
        }
      })();
      return pendingWrite;
    },
    removeItem: () => {
      // Character deletion is represented by roster tombstones. Immutable
      // family keys are never physically removed by the cutover adapter.
    },
  };
}

export function resetCharacterPersistenceRuntimeForTests(): void {
  runtimeAuthority = { authority: 'localStorage', epoch: 0 };
  pendingWrite = Promise.resolve();
  latestWriteSaved = true;
  activeBootstrapPending = false;
  cutoverBarrier?.release();
  cutoverBarrier = undefined;
}
