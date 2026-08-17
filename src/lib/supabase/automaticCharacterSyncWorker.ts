import type { Json } from '@/types/database.generated';

import {
  type AutomaticCharacterOutboxEntry,
  type IndexedDbAutomaticCharacterSyncRepository,
} from '@/lib/indexeddb/automaticCharacterSyncRepository';
import type { StorageNamespace } from '@/lib/indexeddb/shadowJournal';

import type { CharacterCloudRow } from './characterCloudCodec';
import {
  copyJsonForRecovery,
  fingerprintCharacterPayload,
} from './characterCloudCodec';
import { CharacterCloudGatewayError } from './characterCloudGateway';
import type {
  CharacterMutationRequest,
  CharacterMutationResult,
  PutCharacterRequest,
} from './manualCharacterCloudService';

export interface AutomaticCharacterSyncGateway {
  put(request: PutCharacterRequest): Promise<CharacterMutationResult>;
  archive(request: CharacterMutationRequest): Promise<CharacterMutationResult>;
  fetch(cloudId: string): Promise<CharacterCloudRow | null>;
  list(): Promise<CharacterCloudRow[]>;
}

interface WorkerOptions {
  namespace: StorageNamespace;
  featureEnabled: boolean;
  repository: IndexedDbAutomaticCharacterSyncRepository;
  gateway: AutomaticCharacterSyncGateway;
  now?: () => number;
  random?: () => number;
  fingerprint?: (payload: Json) => Promise<string>;
}

export type AutomaticSyncRunResult =
  | 'disabled'
  | 'idle'
  | 'synced'
  | 'offline'
  | 'auth-required'
  | 'failed'
  | 'conflict'
  | 'quarantined';

function retryDelay(attempt: number, random: () => number): number {
  const exponential = Math.min(300_000, 2_000 * 2 ** Math.max(0, attempt - 1));
  return Math.min(
    300_000,
    exponential + Math.floor(exponential * 0.25 * random())
  );
}

function nameFromPayload(payload: Json | null, fallback: string): string {
  if (
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    typeof payload.name === 'string' &&
    payload.name.trim()
  ) {
    return payload.name.trim();
  }
  return fallback;
}

export class AutomaticCharacterSyncWorker {
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly fingerprint: (payload: Json) => Promise<string>;
  private firstDrain = true;

  constructor(private readonly options: WorkerOptions) {
    this.now = options.now ?? (() => Date.now());
    this.random = options.random ?? (() => Math.random());
    this.fingerprint =
      options.fingerprint ?? (payload => fingerprintCharacterPayload(payload));
  }

  async runOnce(): Promise<AutomaticSyncRunResult> {
    if (!this.options.featureEnabled) return 'disabled';
    if (this.options.namespace === 'guest') return 'idle';
    const entry = await this.options.repository.nextRunnable(
      this.options.namespace,
      this.now(),
      this.firstDrain
    );
    this.firstDrain = false;
    if (!entry) return 'idle';
    await this.options.repository.markInflight(entry.mutationId);
    try {
      const result = await this.push(entry);
      if (result.status !== 'success') {
        const remote = await this.fetchRequired(result.characterId);
        await this.options.repository.preserveConflict(
          entry,
          remote,
          new Date(this.now()).toISOString()
        );
        return 'conflict';
      }
      const remote = await this.fetchRequired(result.characterId);
      await this.validateAcknowledgement(entry, result, remote);
      await this.options.repository.acknowledge(
        entry,
        result.characterId,
        result.serverVersion
      );
      return 'synced';
    } catch (cause) {
      const category =
        cause instanceof CharacterCloudGatewayError ? cause.category : 'failed';
      if (category === 'auth-required') {
        await this.options.repository.updateWork(entry.mutationId, {
          state: 'auth-required',
          attemptCount: entry.attemptCount + 1,
          lastError: 'Authentication required',
          inflightAt: null,
        });
        return 'auth-required';
      }
      if (category === 'offline') {
        await this.options.repository.updateWork(entry.mutationId, {
          state: 'offline',
          attemptCount: entry.attemptCount + 1,
          nextAttemptAt: this.now(),
          lastError: 'Network unavailable',
          inflightAt: null,
        });
        return 'offline';
      }
      const attemptCount = entry.attemptCount + 1;
      await this.options.repository.updateWork(entry.mutationId, {
        state: 'retry',
        attemptCount,
        nextAttemptAt: this.now() + retryDelay(attemptCount, this.random),
        lastError: cause instanceof Error ? cause.message : 'Cloud sync failed',
        inflightAt: null,
      });
      return 'failed';
    }
  }

  retryNow(legacyId?: string): Promise<void> {
    return this.options.repository.retryNow(this.options.namespace, legacyId);
  }

  resumeAfterAuthentication(): Promise<void> {
    return this.options.repository.resumeAfterAuthentication(
      this.options.namespace
    );
  }

  private push(
    entry: AutomaticCharacterOutboxEntry
  ): Promise<CharacterMutationResult> {
    if (!entry.cloudId) {
      throw new Error('Automatic sync work has no cloud identity');
    }
    if (entry.operation === 'delete') {
      return this.options.gateway.archive({
        mutationId: entry.mutationId,
        cloudId: entry.cloudId,
        expectedServerVersion: entry.baseServerVersion,
      });
    }
    if (entry.payload === null) {
      throw new Error('Automatic sync work has no character payload');
    }
    return this.options.gateway.put({
      mutationId: entry.mutationId,
      cloudId: entry.cloudId,
      legacyId: entry.legacyId,
      name: nameFromPayload(entry.payload, entry.legacyId),
      payload: entry.payload,
      schemaVersion: entry.schemaVersion,
      clientRevision: entry.localRevision,
      expectedServerVersion: entry.baseServerVersion,
    });
  }

  private async fetchRequired(cloudId: string): Promise<CharacterCloudRow> {
    const row = await this.options.gateway.fetch(cloudId);
    if (!row) throw new Error('Cloud acknowledgement could not be refetched');
    return row;
  }

  private async validateAcknowledgement(
    entry: AutomaticCharacterOutboxEntry,
    result: CharacterMutationResult,
    remote: CharacterCloudRow
  ): Promise<void> {
    const cloudIdentityMatches =
      remote.id === entry.cloudId || entry.baseServerVersion === 0;
    if (
      remote.id !== result.characterId ||
      !cloudIdentityMatches ||
      remote.legacy_client_id !== entry.legacyId ||
      remote.server_version !== result.serverVersion ||
      result.serverVersion <= entry.baseServerVersion ||
      remote.schema_version !== entry.schemaVersion ||
      !Number.isInteger(remote.client_revision) ||
      remote.client_revision < 0 ||
      (entry.operation !== 'delete' &&
        remote.client_revision !== entry.localRevision)
    ) {
      throw new Error('Cloud acknowledgement identity or version is invalid');
    }
    if (entry.operation === 'delete') {
      if (!remote.deleted_at) {
        throw new Error('Cloud tombstone acknowledgement is invalid');
      }
      return;
    }
    if (remote.deleted_at) {
      throw new Error(
        'Cloud acknowledgement unexpectedly returned a tombstone'
      );
    }
    const fingerprint = await this.fingerprint(
      copyJsonForRecovery(remote.payload)
    );
    if (fingerprint !== entry.contentFingerprint) {
      throw new Error('Cloud acknowledgement fingerprint is invalid');
    }
  }
}
