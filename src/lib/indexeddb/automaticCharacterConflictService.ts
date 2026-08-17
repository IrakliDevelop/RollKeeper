import type { Json } from '@/types/database.generated';

import type { CharacterCloudRow } from '@/lib/supabase/characterCloudCodec';
import { validateAutomaticCharacterCandidate } from '@/lib/supabase/automaticCharacterSyncValidation';

import {
  type AutomaticCharacterConflict,
  type AutomaticCharacterDocument,
  type AutomaticCharacterOutboxEntry,
} from './automaticCharacterSyncRepository';
import { requestResult, transactionComplete } from './localDatabase';

export type AutomaticConflictResolution =
  | 'keep-mine'
  | 'use-cloud'
  | 'keep-both';

interface ConflictServiceOptions {
  randomId?: () => string;
  now?: () => string;
}

interface ConflictSnapshot {
  runId: string;
  key: string;
  captureNumber: number;
  presence: true;
  rawValue: string;
  byteCount: number;
  capturedAt: string;
  immutable: true;
}

interface AutomaticSyncQuarantine {
  quarantineId: string;
  conflictId: string;
  namespace: string;
  family: 'character';
  legacyId: string;
  rawValue: string;
  reason: string;
  detectedAt: string;
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

function snapshot(
  conflictId: string,
  candidate: 'local' | 'cloud',
  value: unknown,
  now: string
): ConflictSnapshot {
  const rawValue = json(value);
  return {
    runId: conflictId,
    key: `automatic-sync-discarded-${candidate}`,
    captureNumber: 1,
    presence: true,
    rawValue,
    byteCount: new TextEncoder().encode(rawValue).byteLength,
    capturedAt: now,
    immutable: true,
  };
}

function copyPayload(payload: Json, legacyId: string): Json {
  if (
    payload === null ||
    Array.isArray(payload) ||
    typeof payload !== 'object'
  ) {
    return payload;
  }
  const copy = structuredClone(payload) as Record<string, Json | undefined>;
  copy.id = legacyId;
  if (
    copy.characterData &&
    typeof copy.characterData === 'object' &&
    !Array.isArray(copy.characterData)
  ) {
    copy.characterData = { ...copy.characterData, id: legacyId };
  }
  return copy as Json;
}

export class AutomaticCharacterConflictService {
  private readonly randomId: () => string;
  private readonly now: () => string;

  constructor(
    private readonly database: IDBDatabase,
    options: ConflictServiceOptions = {}
  ) {
    this.randomId = options.randomId ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async getConflict(conflictId: string): Promise<
    | (AutomaticCharacterConflict & {
        resolution?: AutomaticConflictResolution;
      })
    | null
  > {
    const transaction = this.database.transaction('conflicts', 'readonly');
    const conflict = (await requestResult(
      transaction.objectStore('conflicts').get(conflictId)
    )) as
      | (AutomaticCharacterConflict & {
          resolution?: AutomaticConflictResolution;
        })
      | undefined;
    await transactionComplete(transaction);
    return conflict ?? null;
  }

  async resolve(
    conflictId: string,
    resolution: AutomaticConflictResolution,
    options: { copyLegacyId?: string } = {}
  ): Promise<'resolved' | 'quarantined'> {
    const conflict = await this.getConflict(conflictId);
    if (!conflict) throw new Error('Automatic sync conflict was not found');
    if (conflict.resolutionState === 'resolved') return 'resolved';
    const remote = conflict.cloudCandidate as CharacterCloudRow;
    const validation = await validateAutomaticCharacterCandidate(
      remote,
      conflict.legacyId
    );
    if (validation.status !== 'supported') {
      const transaction = this.database.transaction('quarantine', 'readwrite');
      transaction.objectStore('quarantine').put({
        quarantineId: `automatic-sync-quarantine:${conflictId}`,
        conflictId,
        namespace: conflict.namespace,
        family: 'character',
        legacyId: conflict.legacyId,
        rawValue: validation.rawValue,
        reason: validation.reason,
        detectedAt: this.now(),
      } satisfies AutomaticSyncQuarantine);
      await transactionComplete(transaction);
      return 'quarantined';
    }
    const { decoded } = validation;
    if (
      remote.legacy_client_id !== conflict.legacyId ||
      remote.id !== conflict.localCandidate?.cloudId
    ) {
      throw new Error('Cloud conflict candidate identity is unsafe');
    }

    const now = this.now();
    const transaction = this.database.transaction(
      ['documents', 'outbox', 'conflicts', 'legacySnapshots'],
      'readwrite'
    );
    const documents = transaction.objectStore('documents');
    const outbox = transaction.objectStore('outbox');
    const conflicts = transaction.objectStore('conflicts');
    const snapshots = transaction.objectStore('legacySnapshots');
    const local = conflict.localCandidate;
    if (!local) {
      transaction.abort();
      throw new Error('Local conflict candidate is missing');
    }

    outbox.delete(conflict.mutationId);
    if (resolution === 'use-cloud') {
      snapshots.add(snapshot(conflictId, 'local', local, now));
      documents.put({
        ...local,
        payload: decoded.rawPayload,
        schemaVersion: remote.schema_version,
        localRevision: Math.max(local.localRevision, remote.client_revision),
        baseServerVersion: remote.server_version,
        contentFingerprint: decoded.contentFingerprint,
        updatedAt: now,
        deletedAt: remote.deleted_at,
      } satisfies AutomaticCharacterDocument);
    } else {
      if (resolution === 'keep-mine') {
        snapshots.add(snapshot(conflictId, 'cloud', remote, now));
      }
      const resumed: AutomaticCharacterDocument = {
        ...local,
        baseServerVersion: remote.server_version,
        updatedAt: now,
      };
      documents.put(resumed);
      const mutationId = this.randomId();
      outbox.put({
        ...resumed,
        mutationId,
        operation: resumed.deletedAt ? 'delete' : 'replace',
        state: 'queued',
        attemptCount: 0,
        nextAttemptAt: 0,
        lastError: null,
        inflightAt: null,
      } satisfies AutomaticCharacterOutboxEntry);

      if (resolution === 'keep-both') {
        if (!options.copyLegacyId) {
          transaction.abort();
          throw new Error('Keep both requires a new local character ID');
        }
        const copy: AutomaticCharacterDocument = {
          namespace: local.namespace,
          family: 'character',
          legacyId: options.copyLegacyId,
          operation: 'create',
          payload: copyPayload(decoded.rawPayload, options.copyLegacyId),
          schemaVersion: remote.schema_version,
          localRevision: 1,
          baseServerVersion: 0,
          contentFingerprint: decoded.contentFingerprint,
          syncPolicy: 'off',
          updatedAt: now,
          deletedAt: null,
        };
        documents.put(copy);
      }
    }
    conflicts.put({
      ...conflict,
      resolutionState: 'resolved',
      resolution,
      resolvedAt: now,
    });
    await transactionComplete(transaction);
    return 'resolved';
  }

  async listSnapshots(conflictId: string): Promise<ConflictSnapshot[]> {
    const transaction = this.database.transaction(
      'legacySnapshots',
      'readonly'
    );
    const snapshots = (await requestResult(
      transaction.objectStore('legacySnapshots').getAll()
    )) as ConflictSnapshot[];
    await transactionComplete(transaction);
    return snapshots.filter(candidate => candidate.runId === conflictId);
  }

  async exportQuarantine(conflictId: string): Promise<{
    format: 'rollkeeper-automatic-sync-quarantine';
    formatVersion: 1;
    reason: string;
    rawValue: string;
  }> {
    const transaction = this.database.transaction('quarantine', 'readonly');
    const row = (await requestResult(
      transaction
        .objectStore('quarantine')
        .get(`automatic-sync-quarantine:${conflictId}`)
    )) as AutomaticSyncQuarantine | undefined;
    await transactionComplete(transaction);
    if (!row) throw new Error('Quarantined cloud candidate was not found');
    return {
      format: 'rollkeeper-automatic-sync-quarantine',
      formatVersion: 1,
      reason: row.reason,
      rawValue: row.rawValue,
    };
  }
}
