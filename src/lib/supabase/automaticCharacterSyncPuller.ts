import type { IndexedDbAutomaticCharacterSyncRepository } from '@/lib/indexeddb/automaticCharacterSyncRepository';
import type { StorageNamespace } from '@/lib/indexeddb/shadowJournal';

import type { AutomaticCharacterSyncGateway } from './automaticCharacterSyncWorker';
import { validateAutomaticCharacterCandidate } from './automaticCharacterSyncValidation';

interface PullerOptions {
  namespace: StorageNamespace;
  repository: IndexedDbAutomaticCharacterSyncRepository;
  gateway: AutomaticCharacterSyncGateway;
  now?: () => string;
}

export type AutomaticSyncPullResult =
  | 'idle'
  | 'updated'
  | 'conflict'
  | 'quarantined';

export class AutomaticCharacterSyncPuller {
  private readonly now: () => string;

  constructor(private readonly options: PullerOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async pull(): Promise<AutomaticSyncPullResult> {
    if (this.options.namespace === 'guest') return 'idle';
    const documents = await this.options.repository.listDocuments(
      this.options.namespace
    );
    const participants = documents.filter(
      document => document.syncPolicy !== 'off' && document.cloudId
    );
    if (participants.length === 0) return 'idle';
    const rows = await this.options.gateway.list();
    const outbox = await this.options.repository.listOutbox(
      this.options.namespace
    );
    let result: AutomaticSyncPullResult = 'idle';

    for (const document of participants) {
      const remote = rows.find(row => row.id === document.cloudId);
      if (!remote) continue;
      if (remote.legacy_client_id !== document.legacyId) {
        await this.options.repository.quarantineCloudCandidate(
          this.options.namespace,
          document.legacyId,
          remote,
          'Cloud candidate identity does not match the selected character',
          this.now()
        );
        result = 'quarantined';
        continue;
      }
      const validation = await validateAutomaticCharacterCandidate(
        remote,
        document.legacyId
      );
      if (validation.status !== 'supported') {
        await this.options.repository.quarantineCloudCandidate(
          this.options.namespace,
          document.legacyId,
          validation.rawValue,
          validation.reason,
          this.now()
        );
        result = 'quarantined';
        continue;
      }
      if (remote.server_version <= document.baseServerVersion) continue;
      const { decoded } = validation;
      const pending = outbox.find(
        entry => entry.legacyId === document.legacyId
      );
      if (pending) {
        await this.options.repository.preserveConflict(
          pending,
          remote,
          this.now()
        );
        if (result !== 'quarantined') result = 'conflict';
        continue;
      }
      await this.options.repository.adoptCloudCandidate(document, {
        payload: decoded.rawPayload,
        schemaVersion: remote.schema_version,
        localRevision: remote.client_revision,
        serverVersion: remote.server_version,
        contentFingerprint: decoded.contentFingerprint,
        deletedAt: remote.deleted_at,
        updatedAt: remote.updated_at,
      });
      if (result === 'idle') result = 'updated';
    }
    return result;
  }
}
