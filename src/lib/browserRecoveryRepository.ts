import { computeManifestHash } from '@/lib/deviceRecovery';
import type {
  DeviceBackupEntry,
  RecoveryDownloadReceipt,
  StagedRecoveryGeneration,
} from '@/lib/deviceRecovery';

const DATABASE_NAME = 'rollkeeper-recovery';
const DATABASE_VERSION = 1;
const GENERATIONS_STORE = 'generations';
const RECEIPTS_STORE = 'downloadReceipts';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(GENERATIONS_STORE)) {
        database.createObjectStore(GENERATIONS_STORE, { keyPath: 'runId' });
      }
      if (!database.objectStoreNames.contains(RECEIPTS_STORE)) {
        database.createObjectStore(RECEIPTS_STORE, {
          keyPath: 'manifestHash',
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () =>
      reject(new Error('IndexedDB recovery database is blocked'));
  });
}

export class BrowserRecoveryRepository {
  async recordDownloadReceipt(receipt: RecoveryDownloadReceipt): Promise<void> {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(RECEIPTS_STORE, 'readwrite');
      transaction.objectStore(RECEIPTS_STORE).put(receipt);
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }

  async hasDownloadReceipt(manifestHash: string): Promise<boolean> {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(RECEIPTS_STORE, 'readonly');
      const receipt = await requestResult(
        transaction.objectStore(RECEIPTS_STORE).get(manifestHash)
      );
      await transactionComplete(transaction);
      return receipt !== undefined;
    } finally {
      database.close();
    }
  }

  async verifyDownloadReceipt(receipt: {
    runId: string;
    manifestHash: string;
    verifiedAt: string;
  }): Promise<void> {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(RECEIPTS_STORE, 'readwrite');
      const store = transaction.objectStore(RECEIPTS_STORE);
      const initiated = await requestResult<
        RecoveryDownloadReceipt | undefined
      >(store.get(receipt.manifestHash));
      if (!initiated || initiated.runId !== receipt.runId) {
        transaction.abort();
        throw new Error('A matching initiated recovery download is required');
      }
      store.put({ ...initiated, verifiedAt: receipt.verifiedAt });
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }

  async hasVerifiedDownloadReceipt(manifestHash: string): Promise<boolean> {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(RECEIPTS_STORE, 'readonly');
      const receipt = await requestResult<RecoveryDownloadReceipt | undefined>(
        transaction.objectStore(RECEIPTS_STORE).get(manifestHash)
      );
      await transactionComplete(transaction);
      return typeof receipt?.verifiedAt === 'string';
    } finally {
      database.close();
    }
  }

  async readVerifiedDownloadReceipt(
    manifestHash: string
  ): Promise<RecoveryDownloadReceipt | null> {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(RECEIPTS_STORE, 'readonly');
      const receipt = await requestResult<RecoveryDownloadReceipt | undefined>(
        transaction.objectStore(RECEIPTS_STORE).get(manifestHash)
      );
      await transactionComplete(transaction);
      // An initiated-only receipt is not a receipt a migration run may resume
      // on: the file was never re-selected and checked against the bundle.
      return typeof receipt?.verifiedAt === 'string' ? receipt : null;
    } finally {
      database.close();
    }
  }

  /**
   * Attaches an entry vector to an already-verified receipt that predates
   * this slice (so it was written with no `entries` field). This is evidence
   * recovery, not a wizard-state write: the caller must re-derive `entries`
   * from an actual re-capture of the browser's storage, and the write is
   * accepted only when that re-capture's aggregate hash still reproduces the
   * receipt's own `manifestHash` — proof the browser's data has not moved
   * since the original verified download.
   */
  async enrichVerifiedDownloadReceiptEntries(
    manifestHash: string,
    entries: DeviceBackupEntry[]
  ): Promise<void> {
    const readDatabase = await openDatabase();
    let receipt: RecoveryDownloadReceipt | undefined;
    try {
      const transaction = readDatabase.transaction(RECEIPTS_STORE, 'readonly');
      receipt = await requestResult<RecoveryDownloadReceipt | undefined>(
        transaction.objectStore(RECEIPTS_STORE).get(manifestHash)
      );
      await transactionComplete(transaction);
    } finally {
      readDatabase.close();
    }

    if (!receipt || typeof receipt.verifiedAt !== 'string') {
      throw new Error(
        'A verified recovery download receipt is required before its entry vector can be enriched'
      );
    }
    if (receipt.entries) {
      throw new Error(
        'Recovery download receipt already carries an entry vector'
      );
    }
    const aggregateHash = await computeManifestHash(entries);
    if (aggregateHash !== receipt.manifestHash) {
      throw new Error(
        'Recovery entry vector does not match the receipt manifest hash'
      );
    }

    const writeDatabase = await openDatabase();
    try {
      const transaction = writeDatabase.transaction(
        RECEIPTS_STORE,
        'readwrite'
      );
      transaction.objectStore(RECEIPTS_STORE).put({
        ...receipt,
        entries: entries.map(({ key, byteCount, sha256 }) => ({
          key,
          byteCount,
          sha256,
        })),
      });
      await transactionComplete(transaction);
    } finally {
      writeDatabase.close();
    }
  }

  async stageGeneration(generation: StagedRecoveryGeneration): Promise<void> {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(GENERATIONS_STORE, 'readwrite');
      const store = transaction.objectStore(GENERATIONS_STORE);
      const existing = await requestResult<
        StagedRecoveryGeneration | undefined
      >(store.get(generation.runId));
      if (
        existing &&
        existing.bundle.manifestHash !== generation.bundle.manifestHash
      ) {
        transaction.abort();
        throw new Error(
          `Recovery generation collision for run ID: ${generation.runId}`
        );
      }
      if (!existing) store.add(generation);
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }

  async getGeneration(runId: string): Promise<StagedRecoveryGeneration | null> {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(GENERATIONS_STORE, 'readonly');
      const generation = await requestResult<
        StagedRecoveryGeneration | undefined
      >(transaction.objectStore(GENERATIONS_STORE).get(runId));
      await transactionComplete(transaction);
      return generation ?? null;
    } finally {
      database.close();
    }
  }

  async activateGeneration(runId: string): Promise<void> {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(GENERATIONS_STORE, 'readwrite');
      const store = transaction.objectStore(GENERATIONS_STORE);
      const generations = await requestResult<StagedRecoveryGeneration[]>(
        store.getAll()
      );
      const selected = generations.find(
        generation => generation.runId === runId
      );
      if (!selected) {
        transaction.abort();
        throw new Error(`Recovery generation not found: ${runId}`);
      }
      for (const generation of generations) {
        store.put({
          ...generation,
          status: generation.runId === runId ? 'active' : 'inactive',
        });
      }
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }
}

export const browserRecoveryRepository = new BrowserRecoveryRepository();
