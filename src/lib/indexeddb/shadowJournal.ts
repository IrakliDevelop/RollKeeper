import {
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

export type StorageNamespace = 'guest' | `user:${string}`;

export interface ShadowJournalEntry {
  journalId: string;
  namespace: StorageNamespace;
  generation: string;
  key: string;
  rawValue: string;
  legacyAck: boolean;
  idbAck: boolean;
  attempts: number;
  updatedAt: string;
}

export interface StaleShadowCandidate {
  conflictId?: string;
  namespace: StorageNamespace;
  generation: string;
  key: string;
  rawValue: string;
  currentRawValue: string | null;
  detectedAt: string;
}

export interface ShadowJournalRepository {
  put(entry: ShadowJournalEntry): Promise<void>;
  delete(journalId: string): Promise<void>;
  list(namespace: StorageNamespace): Promise<ShadowJournalEntry[]>;
  preserveStale(candidate: StaleShadowCandidate): Promise<void>;
}

export class MemoryShadowJournalRepository implements ShadowJournalRepository {
  private readonly entries = new Map<string, ShadowJournalEntry>();
  readonly staleCandidates: StaleShadowCandidate[] = [];

  async put(entry: ShadowJournalEntry): Promise<void> {
    this.entries.set(entry.journalId, structuredClone(entry));
  }

  async delete(journalId: string): Promise<void> {
    this.entries.delete(journalId);
  }

  async list(namespace: StorageNamespace): Promise<ShadowJournalEntry[]> {
    return [...this.entries.values()]
      .filter(entry => entry.namespace === namespace)
      .map(entry => structuredClone(entry));
  }

  async preserveStale(candidate: StaleShadowCandidate): Promise<void> {
    this.staleCandidates.push(structuredClone(candidate));
  }
}

export class IndexedDbShadowJournalRepository
  implements ShadowJournalRepository
{
  constructor(private readonly database: IDBDatabase) {}

  async put(entry: ShadowJournalEntry): Promise<void> {
    const transaction = this.database.transaction('journal', 'readwrite');
    transaction.objectStore('journal').put(entry);
    await transactionComplete(transaction);
  }

  async delete(journalId: string): Promise<void> {
    const transaction = this.database.transaction('journal', 'readwrite');
    transaction.objectStore('journal').delete(journalId);
    await transactionComplete(transaction);
  }

  async list(namespace: StorageNamespace): Promise<ShadowJournalEntry[]> {
    const transaction = this.database.transaction('journal', 'readonly');
    const entries = (await requestResult(
      transaction.objectStore('journal').getAll()
    )) as ShadowJournalEntry[];
    await transactionComplete(transaction);
    return entries.filter(entry => entry.namespace === namespace);
  }

  async preserveStale(candidate: StaleShadowCandidate): Promise<void> {
    const transaction = this.database.transaction('conflicts', 'readwrite');
    transaction.objectStore('conflicts').add({
      ...candidate,
      conflictId:
        candidate.conflictId ??
        `${candidate.namespace}:${candidate.generation}:${candidate.key}:${candidate.detectedAt}`,
      kind: 'stale-shadow-write',
      resolutionState: 'unresolved',
    });
    await transactionComplete(transaction);
  }
}

interface LegacyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface ShadowWriteCoordinatorOptions {
  namespace: StorageNamespace;
  generation: string;
  storage: LegacyStorage;
  repository: ShadowJournalRepository;
  writeShadow: (key: string, rawValue: string) => Promise<void>;
  now: () => string;
  randomId: () => string;
}

export interface ShadowWriteResult {
  saved: boolean;
  legacyAck: boolean;
  idbAck: boolean;
  stale: boolean;
}

export class ShadowWriteCoordinator {
  constructor(private readonly options: ShadowWriteCoordinatorOptions) {}

  async write(
    key: string,
    rawValue: string,
    guard: { expectedRawValue?: string | null } = {}
  ): Promise<ShadowWriteResult> {
    const current = this.options.storage.getItem(key);
    if ('expectedRawValue' in guard && current !== guard.expectedRawValue) {
      await this.options.repository.preserveStale({
        namespace: this.options.namespace,
        generation: this.options.generation,
        key,
        rawValue,
        currentRawValue: current,
        detectedAt: this.options.now(),
      });
      return { saved: false, legacyAck: false, idbAck: false, stale: true };
    }

    let legacyAck = false;
    try {
      this.options.storage.setItem(key, rawValue);
      legacyAck = true;
    } catch {
      // The result remains unsaved even if the non-authoritative shadow succeeds.
    }

    const entry: ShadowJournalEntry = {
      journalId: this.options.randomId(),
      namespace: this.options.namespace,
      generation: this.options.generation,
      key,
      rawValue,
      legacyAck,
      idbAck: false,
      attempts: 1,
      updatedAt: this.options.now(),
    };
    await this.options.repository.put(entry);
    try {
      await this.options.writeShadow(key, rawValue);
      entry.idbAck = true;
    } catch {
      // Durable journal retains the unacknowledged shadow operation.
    }
    if (entry.legacyAck && entry.idbAck) {
      await this.options.repository.delete(entry.journalId);
    } else {
      await this.options.repository.put(entry);
    }
    return {
      saved: legacyAck,
      legacyAck,
      idbAck: entry.idbAck,
      stale: false,
    };
  }

  async retryPending(): Promise<void> {
    const entries = await this.options.repository.list(this.options.namespace);
    for (const entry of entries) {
      const current = this.options.storage.getItem(entry.key);
      if (entry.legacyAck && current !== entry.rawValue) {
        await this.options.repository.preserveStale({
          namespace: entry.namespace,
          generation: entry.generation,
          key: entry.key,
          rawValue: entry.rawValue,
          currentRawValue: current,
          detectedAt: this.options.now(),
        });
        if (current === null) continue;
        entry.rawValue = current;
        entry.idbAck = false;
      }
      if (!entry.legacyAck) {
        try {
          this.options.storage.setItem(entry.key, entry.rawValue);
          entry.legacyAck = true;
        } catch {
          // Retry remains queued.
        }
      }
      if (!entry.idbAck) {
        try {
          await this.options.writeShadow(entry.key, entry.rawValue);
          entry.idbAck = true;
        } catch {
          // Retry remains queued.
        }
      }
      entry.attempts += 1;
      entry.updatedAt = this.options.now();
      if (entry.legacyAck && entry.idbAck) {
        await this.options.repository.delete(entry.journalId);
      } else {
        await this.options.repository.put(entry);
      }
    }
  }
}
