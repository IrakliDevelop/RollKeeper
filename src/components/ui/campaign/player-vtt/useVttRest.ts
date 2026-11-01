import { useCallback } from 'react';

import { longRestToast, type ToastData } from '@/components/ui/feedback/Toast';
import { useCalendarStore } from '@/store/calendarStore';
import { useCharacterStore } from '@/store/characterStore';
import { getRestSlots, type RestSlots } from '@/utils/calculations';
import {
  advanceLocalCalendarForLongRest,
  calendarRestDetails,
  getSyncedCalendar,
} from '@/utils/longRestCalendar';

interface UseVttRestArgs {
  campaignCode: string;
  characterId: string;
  /** The DM's shared calendar, if they have shared one. */
  sharedCalendar: object | null | undefined;
  addToast: (toast: Omit<ToastData, 'id'>) => void;
  showShortRest: (slots: RestSlots) => void;
}

/**
 * What the sheet drawer does after a rest is confirmed (the character store
 * has already applied it): the same toast as the HUD, and a long rest moves
 * an unsynced local calendar one day.
 */
export function useVttRest({
  campaignCode,
  characterId,
  sharedCalendar,
  addToast,
  showShortRest,
}: UseVttRestArgs) {
  const synced = getSyncedCalendar(campaignCode, sharedCalendar) !== null;
  return useCallback(
    (type: 'short' | 'long') => {
      const slots = getRestSlots(useCharacterStore.getState().character);
      if (type === 'short') {
        showShortRest(slots);
        return;
      }
      const advanced = advanceLocalCalendarForLongRest({
        synced,
        calendar: useCalendarStore.getState().getCalendar(characterId),
        advance: ms => useCalendarStore.getState().advanceTime(characterId, ms),
      });
      addToast(longRestToast(slots, calendarRestDetails(advanced)));
    },
    [synced, characterId, addToast, showShortRest]
  );
}
