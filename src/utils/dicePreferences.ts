import type { LabelSet } from 'pollyroll/render';
import type { DicePreferences } from '@/types/dice';

export const DEFAULT_DICE_PREFERENCES: DicePreferences = { sound: 0 };

export const DICE_LABEL_COUNTS: Record<LabelSet, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100tens: 10,
  d100ones: 10,
  dF: 3,
  d2: 2,
  dc: 2,
};

/** Only bounded, serializable renderer preferences may enter character storage. */
export function parseDicePreferences(
  input: unknown
): DicePreferences | undefined | null {
  if (input === undefined) return undefined;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  const result: DicePreferences = {};
  for (const key of ['sound', 'maxDpr'] as const) {
    const value = record[key];
    if (value === undefined) continue;
    const min = key === 'sound' ? 0 : 1;
    const max = key === 'sound' ? 1 : 2;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < min ||
      value > max
    )
      return null;
    result[key] = value;
  }
  for (const key of ['shadows', 'announce'] as const) {
    if (record[key] === undefined) continue;
    if (typeof record[key] !== 'boolean') return null;
    result[key] = record[key];
  }
  const motion = record.reducedMotion;
  if (motion !== undefined) {
    if (motion !== 'auto' && motion !== 'always' && motion !== 'never')
      return null;
    result.reducedMotion = motion;
  }
  const fade = record.fadeAfterMs;
  if (fade !== undefined) {
    if (
      fade !== null &&
      (typeof fade !== 'number' ||
        !Number.isFinite(fade) ||
        fade < 0 ||
        fade > 60000)
    )
      return null;
    result.fadeAfterMs = fade;
  }
  if (record.labels !== undefined) {
    if (
      !record.labels ||
      typeof record.labels !== 'object' ||
      Array.isArray(record.labels)
    )
      return null;
    result.labels = {};
    for (const [key, value] of Object.entries(record.labels)) {
      if (!Object.hasOwn(DICE_LABEL_COUNTS, key)) return null;
      const labelSet = key as LabelSet;
      if (
        !Array.isArray(value) ||
        value.length !== DICE_LABEL_COUNTS[labelSet] ||
        !value.every(item => typeof item === 'string' && item.length <= 16)
      )
        return null;
      result.labels[labelSet] = value;
    }
  }
  return result;
}
