import { isCalendarClientVisible } from '@/lib/durableDm/slice11bFlags';

import type { StorageNamespace } from './shadowJournal';

interface SelectionStorage {
  getItem(key: string): string | null;
}

interface WritableSelectionStorage extends SelectionStorage {
  setItem(key: string, value: string): void;
}

export interface CalendarSelection {
  version: 1;
  namespace: StorageNamespace;
  campaignId: string;
  family: 'calendar';
  selectedAt: string;
  recovery: { runId: string; manifestHash: string; createdAt: string };
}

export function calendarSelectionKey(
  namespace: StorageNamespace,
  campaignId: string
) {
  return `rollkeeper:calendar-selection:${namespace}:${campaignId}`;
}

export function hasCalendarSelection(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
) {
  const raw = storage.getItem(calendarSelectionKey(namespace, campaignId));
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Partial<CalendarSelection>;
    return (
      parsed.version === 1 &&
      parsed.namespace === namespace &&
      parsed.campaignId === campaignId &&
      parsed.family === 'calendar' &&
      typeof parsed.selectedAt === 'string' &&
      typeof parsed.recovery?.runId === 'string' &&
      /^[a-f0-9]{64}$/u.test(parsed.recovery.manifestHash ?? '')
    );
  } catch {
    return false;
  }
}

export function readCalendarSelection(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
): CalendarSelection | null {
  if (!hasCalendarSelection(storage, namespace, campaignId)) return null;
  return JSON.parse(
    storage.getItem(calendarSelectionKey(namespace, campaignId))!
  ) as CalendarSelection;
}

export function selectCalendar(
  storage: WritableSelectionStorage,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    confirmed: boolean;
    recovery: CalendarSelection['recovery'];
    now: () => string;
  }
) {
  if (!options.confirmed)
    throw new Error('Calendar selection requires confirmation');
  if (!/^user:/u.test(options.namespace))
    throw new Error('Owner account namespace is required');
  if (!/^[a-f0-9]{64}$/u.test(options.recovery.manifestHash)) {
    throw new Error('Matching recovery manifest receipt is required');
  }
  storage.setItem(
    calendarSelectionKey(options.namespace, options.campaignId),
    JSON.stringify({
      version: 1,
      namespace: options.namespace,
      campaignId: options.campaignId,
      family: 'calendar',
      selectedAt: options.now(),
      recovery: options.recovery,
    } satisfies CalendarSelection)
  );
}

export function isCalendarParticipant(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
) {
  return (
    isCalendarClientVisible() &&
    hasCalendarSelection(storage, namespace, campaignId)
  );
}
