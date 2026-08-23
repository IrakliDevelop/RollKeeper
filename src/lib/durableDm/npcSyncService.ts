import type {
  IndexedDbNpcRepository,
  NpcMutation,
  NpcOutboxEntry,
} from '@/lib/indexeddb/npcRepository';

export interface NpcCloudAcknowledgement {
  serverVersion: number;
  cutoverEpoch: number;
  payloadFingerprint: string;
  cloudSaved: true;
  playerView: 'not-applicable';
}

export interface NpcCloudGateway {
  put(entry: NpcOutboxEntry): Promise<NpcCloudAcknowledgement>;
}

export class NpcSyncService {
  constructor(
    private readonly options: {
      enabled: boolean;
      repository: IndexedDbNpcRepository;
      gateway: NpcCloudGateway;
    }
  ) {}

  async commit(mutation: NpcMutation) {
    if (!this.options.enabled) return { status: 'disabled' as const };
    const local = await this.options.repository.commit(mutation);
    if (!local.saved)
      return { status: 'local-failed' as const, reason: local.reason };
    const [entry] = (
      await this.options.repository.listOutbox(
        mutation.namespace,
        mutation.campaignId
      )
    ).filter(value => value.mutationId === local.mutationId);
    if (!entry)
      return { status: 'local-failed' as const, reason: 'failed' as const };
    return this.push(entry);
  }

  async flush(namespace: NpcMutation['namespace'], campaignId: string) {
    if (!this.options.enabled) return { status: 'disabled' as const };
    const entry = await this.options.repository.nextRunnable(
      namespace,
      campaignId,
      Date.now()
    );
    if (!entry) return { status: 'idle' as const };
    return this.push(entry);
  }

  private async push(entry: NpcOutboxEntry) {
    await this.options.repository.updateWork(entry.mutationId, {
      state: 'inflight',
      inflightAt: new Date().toISOString(),
      attemptCount: entry.attemptCount + 1,
    });
    try {
      const acknowledgement = await this.options.gateway.put(entry);
      await this.options.repository.acknowledge(
        entry.mutationId,
        acknowledgement
      );
      return {
        status: 'cloud-saved' as const,
        playerView: acknowledgement.playerView,
        serverVersion: acknowledgement.serverVersion,
      };
    } catch (error) {
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? Number(error.status)
          : 0;
      if (status === 409) {
        await this.options.repository.preserveCloudConflict(entry, {
          category: 'stale-base-version',
        });
        return { status: 'conflict' as const };
      }
      await this.options.repository.updateWork(entry.mutationId, {
        state: status === 401 ? 'auth-required' : 'retry',
        nextAttemptAt: Date.now() + 2_000,
        inflightAt: null,
        lastError: status === 401 ? 'auth-required' : 'cloud-unavailable',
      });
      return {
        status: 'queued' as const,
        reason:
          status === 401 ? ('auth-required' as const) : ('offline' as const),
      };
    }
  }
}
