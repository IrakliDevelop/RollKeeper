'use client';

import { useCallback, useSyncExternalStore, type FocusEvent } from 'react';

const subscribe = () => () => {};

/**
 * Whether the browser sizes inputs to their content (`field-sizing`). The
 * server and the first client render assume it doesn't, so hydration
 * matches; browsers without it get a measured `ch` width instead.
 */
export function useSupportsFieldSizing(): boolean {
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('field-sizing', 'content'),
    () => false
  );
}

/**
 * Selects the field's text once focus has settled. iOS Safari ignores
 * select() called inside the focus handler, so this waits a frame, and
 * skips it if the player has already started typing.
 */
export function useSelectOnFocus() {
  return useCallback((event: FocusEvent<HTMLInputElement>) => {
    const field = event.currentTarget;
    const before = field.value;
    requestAnimationFrame(() => {
      if (document.activeElement !== field || field.value !== before) return;
      field.setSelectionRange(0, field.value.length);
    });
  }, []);
}
