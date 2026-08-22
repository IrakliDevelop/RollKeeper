import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hasCalendarSelection,
  isCalendarParticipant,
  readCalendarSelection,
  selectCalendar,
} from '../calendarSelection';

describe('calendar explicit selection', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is disabled and unselected by default without reading storage', () => {
    const storage = { getItem: vi.fn(() => null) };
    expect(isCalendarParticipant(storage, 'user:a', 'campaign-a')).toBe(false);
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it('requires client visibility plus exact account/campaign selection', () => {
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'true');
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    expect(() =>
      selectCalendar(storage, {
        namespace: 'user:a',
        campaignId: 'campaign-a',
        confirmed: false,
        recovery: {
          runId: 'run',
          manifestHash: 'a'.repeat(64),
          createdAt: 'now',
        },
        now: () => 'now',
      })
    ).toThrow(/confirmation/i);
    selectCalendar(storage, {
      namespace: 'user:a',
      campaignId: 'campaign-a',
      confirmed: true,
      recovery: {
        runId: 'run',
        manifestHash: 'a'.repeat(64),
        createdAt: 'now',
      },
      now: () => 'now',
    });
    expect(hasCalendarSelection(storage, 'user:a', 'campaign-a')).toBe(true);
    expect(isCalendarParticipant(storage, 'user:a', 'campaign-a')).toBe(true);
    expect(isCalendarParticipant(storage, 'user:b', 'campaign-a')).toBe(false);
    expect(isCalendarParticipant(storage, 'user:a', 'campaign-b')).toBe(false);
    expect(
      readCalendarSelection(storage, 'user:a', 'campaign-a')
    ).toMatchObject({ family: 'calendar' });
  });

  it('rejects guest, invalid receipts, malformed records, and mismatched scopes', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const base = {
      campaignId: 'campaign-a',
      confirmed: true,
      recovery: {
        runId: 'run',
        manifestHash: 'a'.repeat(64),
        createdAt: 'now',
      },
      now: () => 'now',
    } as const;
    expect(() =>
      selectCalendar(storage, { ...base, namespace: 'guest' })
    ).toThrow(/owner/i);
    expect(() =>
      selectCalendar(storage, {
        ...base,
        namespace: 'user:a',
        recovery: { ...base.recovery, manifestHash: 'bad' },
      })
    ).toThrow(/receipt/i);
    values.set('rollkeeper:calendar-selection:user:a:campaign-a', '{');
    expect(readCalendarSelection(storage, 'user:a', 'campaign-a')).toBeNull();
    values.set(
      'rollkeeper:calendar-selection:user:a:campaign-a',
      JSON.stringify({
        version: 1,
        namespace: 'user:b',
        campaignId: 'campaign-a',
        family: 'calendar',
        selectedAt: 'now',
        recovery: base.recovery,
      })
    );
    expect(hasCalendarSelection(storage, 'user:a', 'campaign-a')).toBe(false);
  });
});
