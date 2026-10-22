import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';

import { useCalendarStore } from '@/store/calendarStore';
import { useCharacterStore } from '@/store/characterStore';
import { getMsPerDay } from '@/utils/calendarCalculations';
import { CALENDAR_PRESETS } from '@/utils/calendarPresets';
import { getRestSlots } from '@/utils/calculations';
import { CALENDAR_ADVANCED_DETAIL } from '@/utils/longRestCalendar';

import { useVttRest } from '../useVttRest';

const CHARACTER_ID = 'char-1';
const config = CALENDAR_PRESETS[0].create();

function setup(
  opts: {
    campaignCode?: string;
    sharedCalendar?: object | null;
    seed?: boolean;
  } = {}
) {
  if (opts.seed !== false) {
    useCalendarStore.getState().initCalendar(CHARACTER_ID, config);
  }
  const addToast = vi.fn();
  const showShortRest = vi.fn();
  const { result } = renderHook(() =>
    useVttRest({
      campaignCode: opts.campaignCode ?? '',
      characterId: CHARACTER_ID,
      sharedCalendar: opts.sharedCalendar ?? null,
      addToast,
      showShortRest,
    })
  );
  return { rest: result.current, addToast, showShortRest };
}

const time = () =>
  useCalendarStore.getState().getCalendar(CHARACTER_ID)?.currentTime;

describe('useVttRest', () => {
  beforeEach(() => {
    useCalendarStore.setState({ calendars: [] });
  });
  afterEach(cleanup);

  it('advances an unsynced local calendar on a long rest and adds the line', () => {
    const { rest, addToast } = setup();
    const before = time() as number;
    rest('long');
    expect(time()).toBe(before + getMsPerDay(config));
    expect(addToast).toHaveBeenCalledTimes(1);
    const { details } = addToast.mock.calls[0][0];
    expect(details[details.length - 1]).toBe(CALENDAR_ADVANCED_DETAIL);
  });

  it('leaves the calendar alone when the DM shares one', () => {
    const { rest, addToast } = setup({
      campaignCode: 'ABC123',
      sharedCalendar: { currentTime: 0, startTime: 0, config },
    });
    const before = time();
    rest('long');
    expect(time()).toBe(before);
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast.mock.calls[0][0].details ?? []).not.toContain(
      CALENDAR_ADVANCED_DETAIL
    );
  });

  it('treats a campaign with no shared calendar as unsynced', () => {
    const { rest, addToast } = setup({
      campaignCode: 'ABC123',
      sharedCalendar: null,
    });
    const before = time() as number;
    rest('long');
    expect(time()).toBe(before + getMsPerDay(config));
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast.mock.calls[0][0].details).toContain(
      CALENDAR_ADVANCED_DETAIL
    );
  });

  it('does not throw or add the line without a local calendar', () => {
    const { rest, addToast } = setup({ seed: false });
    expect(() => rest('long')).not.toThrow();
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast.mock.calls[0][0].details ?? []).not.toContain(
      CALENDAR_ADVANCED_DETAIL
    );
  });

  it('only shows the short rest toast on a short rest', () => {
    const { rest, addToast, showShortRest } = setup();
    const before = time();
    rest('short');
    expect(showShortRest).toHaveBeenCalledTimes(1);
    expect(showShortRest).toHaveBeenCalledWith(
      getRestSlots(useCharacterStore.getState().character)
    );
    expect(addToast).not.toHaveBeenCalled();
    expect(time()).toBe(before);
  });
});
