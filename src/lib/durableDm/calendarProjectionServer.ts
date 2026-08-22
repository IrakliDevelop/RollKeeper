import { isHybridGuestServerEnabled } from '@/lib/guestSessionSecurity';
import { getRawRedis } from '@/lib/redis';
import {
  callCalendarRpc,
  createCalendarApplicationClient,
  type CalendarRpcClient,
} from '@/lib/supabase/calendarServer';

import {
  asCalendarProjectionRedis,
  publishCalendarProjection,
} from './calendarProjection';
import { isCalendarWorkerEnabled } from './slice11bFlags';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function calendarProjectionDispatcherEnabled() {
  return isCalendarWorkerEnabled() && isHybridGuestServerEnabled();
}

export async function drainCalendarProjectionQueue(limit = 10) {
  if (!calendarProjectionDispatcherEnabled())
    return { status: 'disabled' as const };
  const client = createCalendarApplicationClient();
  if (!client) return { status: 'unavailable' as const };
  const workerId = crypto.randomUUID();
  const data = await callCalendarRpc(
    client,
    'claim_calendar_projection_events',
    {
      p_worker_id: workerId,
      p_limit: Math.min(25, Math.max(1, limit)),
      p_lease_seconds: 30,
    }
  );
  if (!Array.isArray(data))
    throw new Error('Invalid calendar projection claim');
  let acknowledged = 0;
  let failed = 0;
  for (const raw of data) {
    if (!record(raw)) continue;
    try {
      const result = await publishCalendarProjection(
        asCalendarProjectionRedis(getRawRedis()),
        {
          campaignCode: String(raw.campaign_code),
          epoch: Number(raw.cutover_epoch),
          version: Number(raw.server_version),
          sourceFingerprint: String(raw.source_fingerprint),
          payload: raw.payload as never,
          tombstoned: raw.tombstoned === true,
        }
      );
      if (['divergent', 'stale-epoch', 'poison'].includes(result.status)) {
        await fail(client, String(raw.event_id), workerId, result.status);
        failed += 1;
      } else {
        await callCalendarRpc(
          client,
          'ack_campaign_document_projection_event',
          {
            p_event_id: raw.event_id,
            p_worker_id: workerId,
            p_projection_fingerprint: result.projectionFingerprint,
          }
        );
        acknowledged += 1;
      }
    } catch {
      await fail(client, String(raw.event_id), workerId, 'publication-failed');
      failed += 1;
    }
  }
  return {
    status: 'drained' as const,
    claimed: data.length,
    acknowledged,
    failed,
  };
}

async function fail(
  client: CalendarRpcClient,
  eventId: string,
  workerId: string,
  code: string
) {
  const incident =
    code === 'divergent'
      ? 'equal_version_divergence'
      : code === 'stale-epoch'
        ? 'stale_epoch'
        : code === 'poison'
          ? 'poison_event'
          : null;
  await callCalendarRpc(client, 'fail_calendar_projection_event', {
    p_event_id: eventId,
    p_worker_id: workerId,
    p_error_code: code,
    p_incident_kind: incident,
  });
}

export function validCalendarProjectionDispatcherSecret(
  authorization: string | null
) {
  const configured = process.env.CALENDAR_PROJECTION_DISPATCH_SECRET;
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
import { timingSafeEqual } from 'node:crypto';
