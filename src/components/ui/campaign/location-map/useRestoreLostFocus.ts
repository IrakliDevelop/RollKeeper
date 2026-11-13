'use client';

import { useEffect, useRef, type RefObject } from 'react';

/** True when nothing useful holds focus (the browser fell back to `<body>`). */
export function focusWasLost() {
  const active = document.activeElement;
  return active === null || active === document.body;
}

/**
 * When `active` turns false and focus fell to `<body>`, focus `target`.
 *
 * Non-modal Radix popovers do not pull focus back when the focused control
 * unmounts or is disabled, and the next Tab from `<body>` would dismiss the
 * popover. Callers name the stretch during which focus may be lost (Views:
 * an inline edit is open; Export: an export is running) and the control
 * focus should return to once it ends.
 */
export function useRestoreLostFocus(
  active: boolean,
  target: RefObject<HTMLElement | null>
) {
  const wasActive = useRef(active);
  useEffect(() => {
    const ended = wasActive.current && !active;
    wasActive.current = active;
    if (ended && focusWasLost()) target.current?.focus();
  }, [active, target]);
}
