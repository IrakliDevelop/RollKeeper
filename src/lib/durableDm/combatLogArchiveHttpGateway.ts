import type { CombatLogArchiveOutboxEntry } from '@/lib/indexeddb/combatLogArchiveRepository';

import { combatLogArchiveApi } from './combatLogArchiveApi';
import type {
  CombatLogArchiveCloudAcknowledgement,
  CombatLogArchiveCloudGateway,
} from './combatLogArchiveSyncService';

export class CombatLogArchiveHttpGateway
  implements CombatLogArchiveCloudGateway
{
  put(entry: CombatLogArchiveOutboxEntry) {
    return combatLogArchiveApi<CombatLogArchiveCloudAcknowledgement>({
      action: 'put',
      mutationId: entry.mutationId,
      campaignId: entry.campaignId,
      expectedEpoch: entry.cutoverEpoch,
      legacyId: entry.legacyId,
      operation: entry.operation,
      expectedServerVersion: entry.baseServerVersion,
      schemaVersion: entry.schemaVersion,
      payload: entry.payload,
      payloadFingerprint: entry.contentFingerprint,
    });
  }
}
