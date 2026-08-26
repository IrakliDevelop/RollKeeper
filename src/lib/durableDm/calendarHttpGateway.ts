import type { CalendarOutboxEntry } from '@/lib/indexeddb/calendarRepository';

import { calendarApi } from './calendarApi';
import type {
  CalendarCloudAcknowledgement,
  CalendarCloudGateway,
} from './calendarSyncService';

export class CalendarHttpGateway implements CalendarCloudGateway {
  put(entry: CalendarOutboxEntry) {
    return calendarApi<CalendarCloudAcknowledgement>({
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
