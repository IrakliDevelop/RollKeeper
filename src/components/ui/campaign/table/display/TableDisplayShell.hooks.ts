'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Viewport } from '@fieldnotes/core';

import {
  attachCameraInputGuard,
  CAMERA_ZOOM_SHORTCUTS,
  type CameraInputMode,
} from './calibration/cameraInputGuard';
import {
  browserEnvironmentHost,
  readEnvironment,
  startEnvironmentMonitor,
} from './calibration/environment';
import {
  getCalibrationStore,
  type CalibrationPageState,
  type CalibrationSession,
  type CalibrationStore,
} from './calibration/session';

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

/** PR07 P1: the per-page calibration store and its state (client-only). */
export function useCalibrationState(code: string): {
  store: CalibrationStore | null;
  state: CalibrationPageState | null;
} {
  const [value, setValue] = useState<{
    store: CalibrationStore | null;
    state: CalibrationPageState | null;
  }>({ store: null, state: null });
  useEffect(() => {
    // localStorage is read here (an effect), never during render/hydration.
    const store = getCalibrationStore(code);
    const sync = () => setValue({ store, state: store.getState() });
    sync();
    return store.subscribe(sync);
  }, [code]);
  return value;
}

/**
 * PR07 P5 / R3-1 / C7-3: while the session verification flag is held, the
 * physical-setup signals are watched for the page lifetime (whatever is
 * shown); the origin target is the always-mounted shell root. Any mismatch
 * clears the session. Re-registration re-compares at once.
 */
export function useCalibrationMonitor(
  store: CalibrationStore | null,
  rootRef: RefObject<HTMLElement | null>
): void {
  useEffect(() => {
    if (!store) return;
    let stopMonitor: (() => void) | null = null;
    let watched: CalibrationSession | null = null;
    const sync = () => {
      const session = store.getState().session;
      if (session === watched) return;
      stopMonitor?.();
      stopMonitor = null;
      watched = session;
      if (!session) return;
      const host = browserEnvironmentHost();
      stopMonitor = startEnvironmentMonitor({
        host,
        readSnapshot: () => readEnvironment(host, rootRef.current),
        baseline: session.environment,
        onMismatch: () => store.invalidate(),
      });
    };
    const unsubscribe = store.subscribe(sync);
    sync();
    return () => {
      unsubscribe();
      stopMonitor?.();
    };
  }, [store, rootRef]);
}

/** PR07 P7 / R3-2: capture-phase guard plus keyboard zoom shortcuts. */
export function useCameraInputPolicy(
  containerRef: RefObject<HTMLElement | null>,
  viewport: Viewport | null,
  mode: CameraInputMode
): void {
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    return attachCameraInputGuard(container, () => modeRef.current);
  }, [containerRef]);
  useEffect(() => {
    const shortcuts = viewport?.shortcuts;
    if (!shortcuts) return;
    for (const action of CAMERA_ZOOM_SHORTCUTS)
      if (mode === 'free') shortcuts.reset(action);
      else shortcuts.disable(action);
  }, [viewport, mode]);
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
