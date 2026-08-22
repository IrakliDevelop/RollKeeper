import { afterEach, describe, expect, it } from 'vitest';

import {
  isCalendarClientVisible,
  isCalendarServerEnabled,
  isCalendarWorkerEnabled,
} from './slice11bFlags';

afterEach(() => {
  delete process.env.NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE;
  delete process.env.SUPABASE_CALENDAR_SYNC_ENABLED;
  delete process.env.CALENDAR_PROJECTION_WORKER_ENABLED;
});

describe('Slice 11B flags', () => {
  it('keeps every calendar path disabled by default', () => {
    expect(isCalendarClientVisible()).toBe(false);
    expect(isCalendarServerEnabled()).toBe(false);
    expect(isCalendarWorkerEnabled()).toBe(false);
  });

  it('requires the exact independent opt-in values', () => {
    process.env.NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE = 'true';
    process.env.SUPABASE_CALENDAR_SYNC_ENABLED = 'true';
    process.env.CALENDAR_PROJECTION_WORKER_ENABLED = 'true';
    expect(isCalendarClientVisible()).toBe(true);
    expect(isCalendarServerEnabled()).toBe(true);
    expect(isCalendarWorkerEnabled()).toBe(true);
  });
});
