'use client';

import { useEffect, useSyncExternalStore, type RefObject } from 'react';

function subscribe(onChange: () => void) {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  viewport.addEventListener('resize', onChange);
  viewport.addEventListener('scroll', onChange);
  return () => {
    viewport.removeEventListener('resize', onChange);
    viewport.removeEventListener('scroll', onChange);
  };
}

function readInset() {
  const viewport = window.visualViewport;
  if (!viewport) return 0;
  return Math.max(
    0,
    Math.round(window.innerHeight - viewport.height - viewport.offsetTop)
  );
}

/**
 * How much of the bottom of the layout viewport the on-screen keyboard
 * covers. iOS Safari shrinks only the visual viewport when the keyboard
 * opens, so fixed elements at the bottom would sit behind it.
 */
export function useKeyboardInset(): number {
  return useSyncExternalStore(subscribe, readInset, () => 0);
}

/** Keeps the field in view while the keyboard opens or closes. */
export function useKeepInView(
  ref: RefObject<HTMLElement | null>,
  inset: number
) {
  useEffect(() => {
    if (inset > 0) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [ref, inset]);
}
