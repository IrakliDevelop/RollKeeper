'use client';

import { useEffect, useState } from 'react';

const FIT_HIDE_MS = 3_000;

/** E11: the "Fit map" affordance shows on pointer movement, hides after 3 s. */
export function useFitMapVisibility(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleMove = () => {
      setVisible(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        setVisible(false);
      }, FIT_HIDE_MS);
    };
    window.addEventListener('pointermove', handleMove);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      if (timer) clearTimeout(timer);
    };
  }, []);
  return visible;
}

/** F toggles fullscreen (kept from the map-pinned display page). */
export function useFullscreenKey(): void {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'f' && event.key !== 'F') return;
      if (!document.fullscreenElement)
        document.documentElement.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.().catch(() => {});
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);
}
