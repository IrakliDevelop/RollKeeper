import type { NpcOutboxEntry } from '@/lib/indexeddb/npcRepository';

import { npcApi } from './npcApi';
import type {
  NpcCloudAcknowledgement,
  NpcCloudGateway,
} from './npcSyncService';

export class NpcHttpGateway implements NpcCloudGateway {
  put(entry: NpcOutboxEntry) {
    return npcApi<NpcCloudAcknowledgement>({
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
