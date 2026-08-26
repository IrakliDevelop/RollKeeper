import type { CampaignSettingsOutboxEntry } from '@/lib/indexeddb/campaignSettingsRepository';

import { campaignSettingsApi } from './campaignSettingsApi';
import type {
  CampaignSettingsCloudAcknowledgement,
  CampaignSettingsCloudGateway,
} from './campaignSettingsSyncService';

export class CampaignSettingsHttpGateway
  implements CampaignSettingsCloudGateway
{
  put(entry: CampaignSettingsOutboxEntry) {
    return campaignSettingsApi<CampaignSettingsCloudAcknowledgement>({
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
