import { isCalendarClientVisible } from './slice11bFlags';

export interface CalendarProjectionAuthorityMarker {
  version: 1;
  authority: 'indexedDB' | 'postgres' | 'legacy_restored';
  epoch: number;
  campaignId: string;
  namespace?: `user:${string}`;
}

export function calendarProjectionAuthorityKey(campaignCode: string) {
  return `rollkeeper:calendar-projection-authority:${campaignCode}`;
}

export function readCalendarProjectionAuthority(
  storage: Pick<Storage, 'getItem'>,
  campaignCode: string
): CalendarProjectionAuthorityMarker | null {
  if (!isCalendarClientVisible()) return null;
  const raw = storage.getItem(calendarProjectionAuthorityKey(campaignCode));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CalendarProjectionAuthorityMarker>;
    if (
      value.version !== 1 ||
      !['indexedDB', 'postgres', 'legacy_restored'].includes(
        value.authority ?? ''
      ) ||
      !Number.isSafeInteger(value.epoch) ||
      typeof value.campaignId !== 'string'
    )
      return null;
    return value as CalendarProjectionAuthorityMarker;
  } catch {
    return null;
  }
}

export function writeCalendarProjectionAuthority(
  storage: Pick<Storage, 'setItem'>,
  campaignCode: string,
  marker: CalendarProjectionAuthorityMarker
) {
  storage.setItem(
    calendarProjectionAuthorityKey(campaignCode),
    JSON.stringify(marker)
  );
}

export function legacyCalendarProjectionAllowed(
  storage: Pick<Storage, 'getItem'>,
  campaignCode: string
) {
  return (
    readCalendarProjectionAuthority(storage, campaignCode)?.authority !==
    'postgres'
  );
}

export function calendarUsesIndexedDbAuthority(
  storage: Pick<Storage, 'getItem'>,
  campaignCode: string
) {
  const authority = readCalendarProjectionAuthority(
    storage,
    campaignCode
  )?.authority;
  return authority === 'indexedDB' || authority === 'postgres';
}
