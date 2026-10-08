import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CALIBRATION_STORAGE_KEY,
  DEFAULT_CSS_PX_PER_SQUARE,
  DEFAULT_SQUARE_MM,
  loadCalibrationSettings,
  parseCalibrationSettings,
  saveCalibrationSettings,
} from '../calibration/settings';
import {
  deriveCalibrationReport,
  getCalibrationStore,
  resetCalibrationStores,
} from '../calibration/session';
import type { EnvironmentSnapshot } from '../calibration/environment';

const ENV: EnvironmentSnapshot = {
  fullscreen: true,
  devicePixelRatio: 1,
  viewportScale: 1,
  screenWidth: 1920,
  screenHeight: 1080,
  orientation: 'landscape-primary',
  screenX: 1920,
  screenY: 0,
  originLeft: 0,
  originTop: 0,
};
const SQUARE = { kind: 'square', cellSize: 50, zoom: 1.92 } as const;
const HEX = { kind: 'unsupported', reason: 'grid' } as const;

beforeEach(() => {
  window.localStorage.clear();
  resetCalibrationStores();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  resetCalibrationStores();
});

describe('saved values (P2)', () => {
  it('validates C in [8, 1000] and squareMm in [5, 100]; malformed is ignored', () => {
    const valid = {
      v: 1,
      cssPxPerSquare: 96,
      squareMm: 25.4,
      preferCalibrated: true,
      savedAt: 1_700_000_000_000,
    };
    expect(parseCalibrationSettings(valid)).toEqual({
      cssPxPerSquare: 96,
      squareMm: 25.4,
      preferCalibrated: true,
      savedAt: 1_700_000_000_000,
    });
    for (const broken of [
      { ...valid, v: 2 },
      { ...valid, cssPxPerSquare: 7.9 },
      { ...valid, cssPxPerSquare: 1000.1 },
      { ...valid, cssPxPerSquare: Number.NaN },
      { ...valid, cssPxPerSquare: '96' },
      { ...valid, squareMm: 4.9 },
      { ...valid, squareMm: 100.1 },
      { ...valid, preferCalibrated: 'yes' },
      { ...valid, savedAt: Number.POSITIVE_INFINITY },
      null,
      [],
      'x',
    ])
      expect(parseCalibrationSettings(broken)).toBeNull();
    expect(DEFAULT_SQUARE_MM).toBe(25.4);
    expect(DEFAULT_CSS_PX_PER_SQUARE).toBe(96);
  });

  it('stores only non-secret numbers under the namespaced key', () => {
    expect(
      saveCalibrationSettings({
        cssPxPerSquare: 97.5,
        squareMm: 25.4,
        preferCalibrated: true,
        savedAt: 5,
      })
    ).toBe(true);
    const raw = JSON.parse(
      window.localStorage.getItem(CALIBRATION_STORAGE_KEY)!
    );
    expect(raw).toEqual({
      v: 1,
      cssPxPerSquare: 97.5,
      squareMm: 25.4,
      preferCalibrated: true,
      savedAt: 5,
    });
    expect(Object.keys(window.localStorage)).toEqual([CALIBRATION_STORAGE_KEY]);
    window.localStorage.setItem(CALIBRATION_STORAGE_KEY, '{not json');
    expect(loadCalibrationSettings()).toEqual({
      settings: null,
      available: true,
    });
  });

  it('unavailable storage is session-only, never throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(loadCalibrationSettings()).toEqual({
      settings: null,
      available: false,
    });
    expect(
      saveCalibrationSettings({
        cssPxPerSquare: 96,
        squareMm: 25.4,
        preferCalibrated: true,
        savedAt: 1,
      })
    ).toBe(false);
    const store = getCalibrationStore('CAMP1');
    expect(store.getState().storageAvailable).toBe(false);
    store.confirm({
      cssPxPerSquare: 96,
      squareMm: 25.4,
      environment: ENV,
      now: 1,
    });
    expect(deriveCalibrationReport(store.getState(), SQUARE)).toBe('verified');
  });
});

describe('session verification flag (P1, R3-1)', () => {
  it('derives the reported state from preference, session and geometry independently', () => {
    const store = getCalibrationStore('CAMP1');
    expect(deriveCalibrationReport(store.getState(), SQUARE)).toBe(
      'uncalibrated'
    );
    store.confirm({
      cssPxPerSquare: 96,
      squareMm: 25.4,
      environment: ENV,
      now: 10,
    });
    expect(deriveCalibrationReport(store.getState(), SQUARE)).toBe('verified');
    // Geometry never clears the session: hex → unsupported, square → verified.
    expect(deriveCalibrationReport(store.getState(), HEX)).toBe('unsupported');
    expect(deriveCalibrationReport(store.getState(), null)).toBe('verified');
    expect(deriveCalibrationReport(store.getState(), SQUARE)).toBe('verified');
    store.invalidate();
    expect(deriveCalibrationReport(store.getState(), SQUARE)).toBe(
      'verify-required'
    );
    // C7-2: session null on an unsupported scene still reports verify-required.
    expect(deriveCalibrationReport(store.getState(), HEX)).toBe(
      'verify-required'
    );
    store.useUncalibrated();
    expect(deriveCalibrationReport(store.getState(), SQUARE)).toBe(
      'uncalibrated'
    );
    expect(store.getState().settings).toMatchObject({
      cssPxPerSquare: 96,
      preferCalibrated: false,
    });
  });

  it('a fresh page with saved values is verify-required, never verified, and offers the prior C', () => {
    window.localStorage.setItem(
      CALIBRATION_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        cssPxPerSquare: 101.25,
        squareMm: 25,
        preferCalibrated: true,
        savedAt: 3,
      })
    );
    const store = getCalibrationStore('CAMP1');
    expect(store.getState().session).toBeNull();
    expect(store.getState().settings?.cssPxPerSquare).toBe(101.25);
    expect(deriveCalibrationReport(store.getState(), SQUARE)).toBe(
      'verify-required'
    );
  });

  it('survives controller/shell recreation (same page) but not a new page', () => {
    const first = getCalibrationStore('CAMP1');
    first.confirm({
      cssPxPerSquare: 96,
      squareMm: 25.4,
      environment: ENV,
      now: 1,
    });
    expect(getCalibrationStore('CAMP1')).toBe(first);
    expect(getCalibrationStore('CAMP1').getState().session).not.toBeNull();
    expect(getCalibrationStore('OTHER').getState().session).toBeNull();
    resetCalibrationStores();
    const fresh = getCalibrationStore('CAMP1');
    expect(fresh.getState().session).toBeNull();
    expect(deriveCalibrationReport(fresh.getState(), SQUARE)).toBe(
      'verify-required'
    );
  });

  it('notifies subscribers on each change and stops after unsubscribe', () => {
    const store = getCalibrationStore('CAMP1');
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.confirm({
      cssPxPerSquare: 96,
      squareMm: 25.4,
      environment: ENV,
      now: 1,
    });
    store.invalidate();
    store.invalidate();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.useUncalibrated();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
