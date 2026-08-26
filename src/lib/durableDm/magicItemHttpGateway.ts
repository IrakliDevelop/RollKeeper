import type { MagicItemOutboxEntry } from '@/lib/indexeddb/magicItemRepository';

import { magicItemApi } from './magicItemApi';
import type {
  MagicItemCloudAcknowledgement,
  MagicItemCloudGateway,
} from './magicItemSyncService';

export class MagicItemHttpGateway implements MagicItemCloudGateway {
  put(entry: MagicItemOutboxEntry) {
    return magicItemApi<MagicItemCloudAcknowledgement>({
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
