import { timingSafeEqual } from 'node:crypto';

import { isHybridGuestServerEnabled } from '@/lib/guestSessionSecurity';
import { getRawRedis } from '@/lib/redis';
import {
  callCampaignSettingsRpc,
  createCampaignSettingsApplicationClient,
  type CampaignSettingsRpcClient,
} from '@/lib/supabase/campaignSettingsServer';

import { isCampaignSettingsWorkerEnabled } from './slice11aFlags';
import {
  asProjectionRedis,
  CampaignSettingsProjectionWorker,
  publishCampaignSettingsProjection,
  type ClaimedCampaignSettingsProjection,
} from './campaignSettingsProjection';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class SupabaseProjectionQueue {
  constructor(private readonly client: CampaignSettingsRpcClient) {}

  async claim(
    workerId: string,
    limit: number
  ): Promise<ClaimedCampaignSettingsProjection[]> {
    const data = await callCampaignSettingsRpc(
      this.client,
      'claim_campaign_document_projection_events',
      {
        p_worker_id: workerId,
        p_limit: Math.min(100, Math.max(1, limit)),
        p_lease_seconds: 30,
      }
    );
    if (!Array.isArray(data))
      throw new Error('Invalid projection claim response');
    return data.map(value => {
      if (!record(value)) throw new Error('Invalid projection event');
      return {
        eventId: String(value.event_id),
        campaignCode: String(value.campaign_code),
        epoch: Number(value.cutover_epoch),
        version: Number(value.server_version),
        sourceFingerprint: String(value.source_fingerprint),
        payload: value.payload,
        tombstoned: value.tombstoned === true,
      };
    });
  }

  async acknowledge(eventId: string, workerId: string, fingerprint: string) {
    await callCampaignSettingsRpc(
      this.client,
      'ack_campaign_document_projection_event',
      {
        p_event_id: eventId,
        p_worker_id: workerId,
        p_projection_fingerprint: fingerprint,
      }
    );
  }

  async fail(
    eventId: string,
    workerId: string,
    errorCode: string,
    incidentKind:
      | 'equal_version_divergence'
      | 'poison_event'
      | 'stale_epoch'
      | null
  ) {
    await callCampaignSettingsRpc(
      this.client,
      'fail_campaign_document_projection_event',
      {
        p_event_id: eventId,
        p_worker_id: workerId,
        p_error_code: errorCode,
        p_incident_kind: incidentKind,
      }
    );
  }
}

export function campaignSettingsProjectionDispatcherEnabled() {
  return isCampaignSettingsWorkerEnabled() && isHybridGuestServerEnabled();
}

export async function drainCampaignSettingsProjectionQueue(limit = 10) {
  if (!campaignSettingsProjectionDispatcherEnabled())
    return { status: 'disabled' as const };
  const client = createCampaignSettingsApplicationClient();
  if (!client) return { status: 'unavailable' as const };
  const workerId = crypto.randomUUID();
  const worker = new CampaignSettingsProjectionWorker({
    queue: new SupabaseProjectionQueue(client),
    publish: input =>
      publishCampaignSettingsProjection(
        asProjectionRedis(getRawRedis()),
        input
      ),
    workerId,
  });
  return {
    status: 'drained' as const,
    ...(await worker.drain(Math.min(25, Math.max(1, limit)))),
  };
}

export function validProjectionDispatcherSecret(authorization: string | null) {
  const configured = process.env.CAMPAIGN_SETTINGS_PROJECTION_DISPATCH_SECRET;
  if (
    !configured ||
    Buffer.byteLength(configured, 'utf8') < 32 ||
    !authorization?.startsWith('Bearer ')
  )
    return false;
  const supplied = authorization.slice('Bearer '.length);
  const left = Buffer.from(configured, 'utf8');
  const right = Buffer.from(supplied, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
