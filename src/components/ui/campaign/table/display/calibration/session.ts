import type { DisplayCalibrationReport } from '../displayRequests';
import type { EnvironmentSnapshot } from './environment';
import type { SceneGeometry } from './geometry';
import {
  loadCalibrationSettings,
  saveCalibrationSettings,
  type CalibrationSettings,
} from './settings';

/**
 * PR07 P1 / R3-1: the per-page calibration store, keyed by campaign code.
 * It lives at module level so React StrictMode controller/shell recreation
 * and reconnects keep the session verification flag; a reload or a new
 * window starts with no session (verification is session-only).
 *
 * O7-1 / O7-A1: every page load starts uncalibrated. The in-memory
 * `calibratedMode` flag (never persisted) is set only by Confirm and
 * cleared only by "Use uncalibrated view"; invalidation keeps it (frozen,
 * verify-required). The session flag is independent of that mode and of
 * the current scene's geometry; the reported state derives from all three.
 */

export type CalibrationReport = DisplayCalibrationReport;

export interface CalibrationSession {
  cssPxPerSquare: number;
  squareMm: number;
  environment: EnvironmentSnapshot;
  verifiedAt: number;
}

export interface CalibrationPageState {
  /** Saved ruler values, offered by Calibrate minis (never auto-applied). */
  settings: CalibrationSettings | null;
  /** O7-A1: page-lifetime calibrated mode (false on every page load). */
  calibratedMode: boolean;
  /** False → values live for this page only (small notice on the display). */
  storageAvailable: boolean;
  session: CalibrationSession | null;
}

export interface CalibrationStore {
  getState(): CalibrationPageState;
  subscribe(listener: () => void): () => void;
  /** Ruler Confirm: saves C/squareMm, enters calibrated mode, sets the session. */
  confirm(input: {
    cssPxPerSquare: number;
    squareMm: number;
    environment: EnvironmentSnapshot;
    now: number;
  }): void;
  /** "Use uncalibrated view": leaves calibrated mode (writes nothing). */
  useUncalibrated(): void;
  /** A detected invalidation (P5) or grid change: clears the session. */
  invalidate(): void;
}

export const inCalibratedMode = (state: CalibrationPageState): boolean =>
  state.calibratedMode;

/** R3-1 / O7-A1 derivation; `geometry` null = no scene shown (blank/waiting). */
export function deriveCalibrationReport(
  state: CalibrationPageState,
  geometry: SceneGeometry | null
): CalibrationReport {
  if (!state.calibratedMode) return 'uncalibrated';
  if (!state.session) return 'verify-required';
  if (geometry && geometry.kind !== 'square') return 'unsupported';
  return 'verified';
}

function createStore(): CalibrationStore {
  const loaded = loadCalibrationSettings();
  let state: CalibrationPageState = {
    settings: loaded.settings,
    calibratedMode: false,
    storageAvailable: loaded.available,
    session: null,
  };
  const listeners = new Set<() => void>();
  const set = (next: CalibrationPageState) => {
    state = next;
    for (const listener of [...listeners]) listener();
  };
  const persist = (settings: CalibrationSettings): boolean =>
    state.storageAvailable && saveCalibrationSettings(settings);

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    confirm({ cssPxPerSquare, squareMm, environment, now }) {
      const settings: CalibrationSettings = {
        cssPxPerSquare,
        squareMm,
        savedAt: now,
      };
      const saved = persist(settings);
      set({
        settings,
        calibratedMode: true,
        storageAvailable: saved,
        session: { cssPxPerSquare, squareMm, environment, verifiedAt: now },
      });
    },
    useUncalibrated() {
      if (!state.session && !state.calibratedMode) return;
      set({ ...state, calibratedMode: false, session: null });
    },
    invalidate() {
      if (!state.session) return;
      set({ ...state, session: null });
    },
  };
}

const stores = new Map<string, CalibrationStore>();

/** Call from effects/handlers only (reads localStorage on first use). */
export function getCalibrationStore(code: string): CalibrationStore {
  let store = stores.get(code);
  if (!store) {
    store = createStore();
    stores.set(code, store);
  }
  return store;
}

/** A new page: forget every session (tests; never called by product code). */
export function resetCalibrationStores(): void {
  stores.clear();
}
