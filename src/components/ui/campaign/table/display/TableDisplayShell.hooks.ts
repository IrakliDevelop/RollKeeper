'use client';

import { useEffect, useState, type RefObject } from 'react';
import type { Viewport } from '@fieldnotes/core';

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
    window.addEventListener('pointermove', handleMove, true);
    return () => {
      window.removeEventListener('pointermove', handleMove, true);
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

const CAMERA_ATTRIBUTES = [
  'data-camera-x',
  'data-camera-y',
  'data-camera-zoom',
] as const;

/** PR07 P12: the public camera transform on the display container (e2e). */
export function useCameraAttributes(
  rootRef: RefObject<HTMLElement | null>,
  viewport: Viewport | null
): void {
  useEffect(() => {
    const root = rootRef.current;
    const camera = viewport?.camera;
    if (!root || !camera) return;
    const write = () => {
      const { x, y } = camera.position;
      root.setAttribute('data-camera-x', String(x));
      root.setAttribute('data-camera-y', String(y));
      root.setAttribute('data-camera-zoom', String(camera.zoom));
    };
    write();
    const off = camera.onChange(write);
    return () => {
      off();
      for (const name of CAMERA_ATTRIBUTES) root.removeAttribute(name);
    };
  }, [rootRef, viewport]);
}
