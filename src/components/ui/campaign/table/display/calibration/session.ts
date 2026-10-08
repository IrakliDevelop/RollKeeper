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
 * The session flag is independent of the preference and of the current
 * scene's geometry; the reported state is derived from all three.
 */

export type CalibrationReport = DisplayCalibrationReport;

export interface CalibrationSession {
  cssPxPerSquare: number;
  squareMm: number;
  environment: EnvironmentSnapshot;
  verifiedAt: number;
}

export interface CalibrationPageState {
  settings: CalibrationSettings | null;
  /** False → values live for this page only (small notice on the display). */
  storageAvailable: boolean;
  session: CalibrationSession | null;
}

export interface CalibrationStore {
  getState(): CalibrationPageState;
  subscribe(listener: () => void): () => void;
  /** Ruler Confirm: saves C/squareMm, prefers calibrated, sets the session. */
  confirm(input: {
    cssPxPerSquare: number;
    squareMm: number;
    environment: EnvironmentSnapshot;
    now: number;
  }): void;
  /** "Use uncalibrated view": PR05 behaviour; drops the session. */
  useUncalibrated(): void;
  /** A detected invalidation (P5) or grid change: clears the session. */
  invalidate(): void;
}

export const preferCalibrated = (state: CalibrationPageState): boolean =>
  state.settings?.preferCalibrated === true;

/** R3-1 derivation; `geometry` null = no scene attached (blank/waiting). */
export function deriveCalibrationReport(
  state: CalibrationPageState,
  geometry: SceneGeometry | null
): CalibrationReport {
  if (!preferCalibrated(state)) return 'uncalibrated';
  if (!state.session) return 'verify-required';
  if (geometry && geometry.kind !== 'square') return 'unsupported';
  return 'verified';
}

function createStore(): CalibrationStore {
  const loaded = loadCalibrationSettings();
  let state: CalibrationPageState = {
    settings: loaded.settings,
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
        preferCalibrated: true,
        savedAt: now,
      };
      const saved = persist(settings);
      set({
        settings,
        storageAvailable: saved,
        session: { cssPxPerSquare, squareMm, environment, verifiedAt: now },
      });
    },
    useUncalibrated() {
      if (!state.session && !preferCalibrated(state)) return;
      const settings = state.settings
        ? { ...state.settings, preferCalibrated: false }
        : null;
      const saved = settings ? persist(settings) : state.storageAvailable;
      set({ settings, storageAvailable: saved, session: null });
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
