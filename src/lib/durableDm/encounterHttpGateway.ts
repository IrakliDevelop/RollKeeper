import type { EncounterOutboxEntry } from '@/lib/indexeddb/encounterRepository';

import { encounterApi } from './encounterApi';
import type {
  EncounterCloudAcknowledgement,
  EncounterCloudGateway,
} from './encounterSyncService';

export class EncounterHttpGateway implements EncounterCloudGateway {
  put(entry: EncounterOutboxEntry) {
    return encounterApi<EncounterCloudAcknowledgement>({
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
