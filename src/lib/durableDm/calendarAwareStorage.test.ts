import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCalendarAwareStorage } from './calendarAwareStorage';
import {
  calendarProjectionAuthorityKey,
  writeCalendarProjectionAuthority,
} from './calendarLegacyProjection';

function envelope(a: number, b = 0) {
  return JSON.stringify({
    state: {
      calendars: [
        {
          campaignCode: 'AAA111',
          config: {},
          currentTime: a,
          startTime: 0,
          events: [],
        },
        {
          campaignCode: 'BBB222',
          config: {},
          currentTime: b,
          startTime: 0,
          events: [],
        },
      ],
    },
    version: 3,
  });
}

describe('calendar authority-aware Zustand storage', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('retains byte-compatible legacy writes when the flag is off', () => {
    const backing = new Map<string, string>();
    const storage = {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, value),
      removeItem: (key: string) => void backing.delete(key),
      clear: () => backing.clear(),
      key: () => null,
      length: 0,
    } as Storage;
    backing.set('rollkeeper-calendar-data', envelope(0));
    backing.set(
      calendarProjectionAuthorityKey('AAA111'),
      JSON.stringify({
        version: 1,
        authority: 'postgres',
        epoch: 1,
        campaignId: 'cloud-a',
      })
    );
    createCalendarAwareStorage(storage).setItem(
      'rollkeeper-calendar-data',
      envelope(5)
    );
    expect(backing.get('rollkeeper-calendar-data')).toBe(envelope(5));
  });

  it('preserves only the selected calendar mirror after scoped cutover', () => {
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'true');
    const backing = new Map<string, string>();
    const storage = {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, value),
      removeItem: (key: string) => void backing.delete(key),
      clear: () => backing.clear(),
      key: () => null,
      length: 0,
    } as Storage;
    backing.set('rollkeeper-calendar-data', envelope(0, 0));
    writeCalendarProjectionAuthority(storage, 'AAA111', {
      version: 1,
      authority: 'postgres',
      epoch: 1,
      campaignId: 'cloud-a',
    });
    createCalendarAwareStorage(storage).setItem(
      'rollkeeper-calendar-data',
      envelope(9, 7)
    );
    const persisted = JSON.parse(backing.get('rollkeeper-calendar-data')!);
    expect(persisted.state.calendars).toEqual([
      expect.objectContaining({ campaignCode: 'AAA111', currentTime: 0 }),
      expect.objectContaining({ campaignCode: 'BBB222', currentTime: 7 }),
    ]);
  });

  it('passes unrelated, first, malformed, and unselected writes through safely', () => {
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'true');
    const backing = new Map<string, string>();
    const storage = {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, value),
      removeItem: (key: string) => void backing.delete(key),
      clear: () => backing.clear(),
      key: () => null,
      length: 0,
    } as Storage;
    const aware = createCalendarAwareStorage(storage);
    aware.setItem('unrelated', 'value');
    expect(backing.get('unrelated')).toBe('value');
    aware.setItem('rollkeeper-calendar-data', envelope(1));
    expect(backing.get('rollkeeper-calendar-data')).toBe(envelope(1));
    backing.set('rollkeeper-calendar-data', '{bad');
    aware.setItem('rollkeeper-calendar-data', envelope(2));
    expect(backing.get('rollkeeper-calendar-data')).toBe(envelope(2));
    aware.setItem('rollkeeper-calendar-data', envelope(3));
    expect(backing.get('rollkeeper-calendar-data')).toBe(envelope(3));
  });
});
