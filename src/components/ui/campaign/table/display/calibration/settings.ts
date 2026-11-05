/**
 * PR07 P2 / O7-1d: saved ruler values. Display-local, non-secret numbers
 * only: C (CSS px per square) and the square size in mm. They are offered
 * only when the DM chooses Calibrate minis and never auto-apply. U is never
 * stored (it is read live from the scene grid), and nothing here identifies
 * a monitor, a capability or a campaign secret. A legacy `preferCalibrated`
 * key (pre-O7 shape of this unreleased key) is tolerated and ignored.
 */

export const CALIBRATION_STORAGE_KEY = 'rollkeeper:table-calibration:v1';
export const DEFAULT_SQUARE_MM = 25.4;
/** CSS reference pixel: 96 px per inch (one 25.4 mm square). */
export const DEFAULT_CSS_PX_PER_SQUARE = 96;
export const CSS_PX_RANGE = { min: 8, max: 1000 } as const;
export const SQUARE_MM_RANGE = { min: 5, max: 100 } as const;

export interface CalibrationSettings {
  cssPxPerSquare: number;
  squareMm: number;
  /** Epoch ms of the last Confirm (display wording only). */
  savedAt: number;
}

const KEYS = new Set(['v', 'cssPxPerSquare', 'squareMm', 'savedAt']);
const LEGACY_KEYS = new Set(['preferCalibrated']);

const inRange = (value: unknown, range: { min: number; max: number }) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= range.min &&
  value <= range.max;

export const isValidCssPxPerSquare = (value: unknown): value is number =>
  inRange(value, CSS_PX_RANGE);
export const isValidSquareMm = (value: unknown): value is number =>
  inRange(value, SQUARE_MM_RANGE);

export function parseCalibrationSettings(
  value: unknown
): CalibrationSettings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some(key => !KEYS.has(key) && !LEGACY_KEYS.has(key)) ||
    record.v !== 1 ||
    !isValidCssPxPerSquare(record.cssPxPerSquare) ||
    !isValidSquareMm(record.squareMm) ||
    typeof record.savedAt !== 'number' ||
    !Number.isFinite(record.savedAt)
  )
    return null;
  return {
    cssPxPerSquare: record.cssPxPerSquare,
    squareMm: record.squareMm,
    savedAt: record.savedAt,
  };
}

/** Reads the saved values; `available: false` → session-only (never throws). */
export function loadCalibrationSettings(): {
  settings: CalibrationSettings | null;
  available: boolean;
} {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
  } catch {
    return { settings: null, available: false };
  }
  if (raw === null) return { settings: null, available: true };
  try {
    return {
      settings: parseCalibrationSettings(JSON.parse(raw)),
      available: true,
    };
  } catch {
    return { settings: null, available: true };
  }
}

/** Persists the values; false when storage is unavailable or full. */
export function saveCalibrationSettings(
  settings: CalibrationSettings
): boolean {
  try {
    window.localStorage.setItem(
      CALIBRATION_STORAGE_KEY,
      JSON.stringify({ v: 1, ...settings })
    );
    return true;
  } catch {
    return false;
  }
}
