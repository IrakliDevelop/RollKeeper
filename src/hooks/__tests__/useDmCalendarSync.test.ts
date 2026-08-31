import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDmCalendarSync } from '@/hooks/useDmCalendarSync';
import { legacyCalendarProjectionAllowed } from '@/lib/durableDm/calendarLegacyProjection';
import { useCalendarStore } from '@/store/calendarStore';
import { CALENDAR_PRESETS } from '@/utils/calendarPresets';

vi.mock('@/lib/durableDm/calendarLegacyProjection', () => ({
  legacyCalendarProjectionAllowed: vi.fn(),
}));

describe('useDmCalendarSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useCalendarStore.setState({ calendars: [] });
    vi.mocked(legacyCalendarProjectionAllowed).mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not send a pending legacy push after cloud projection takes authority', async () => {
    renderHook(() => useDmCalendarSync('MANUAL', 'synthetic-dm'));

    vi.mocked(legacyCalendarProjectionAllowed).mockReturnValue(false);
    act(() => {
      useCalendarStore.setState({
        calendars: [
          {
            campaignCode: 'MANUAL',
            config: CALENDAR_PRESETS[0].create(),
            currentTime: 1,
            startTime: 0,
            events: [],
          },
        ],
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(fetch).not.toHaveBeenCalled();
  });
});
