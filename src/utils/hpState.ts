import type { HpStateBand } from '@/types/encounter';

/** Current HP as a clamped 0-100 percentage of max. */
export function hpPercent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (current / max) * 100));
}

export type HpTier = 'high' | 'mid' | 'low' | 'critical';

/** Coarse health tier from a 0-100 percentage, for colour-coding. */
export function hpTier(percent: number): HpTier {
  if (percent > 75) return 'high';
  if (percent > 50) return 'mid';
  if (percent > 25) return 'low';
  return 'critical';
}

/**
 * The player-facing HP-state label for the given HP, using the configured
 * bands. A band applies when the current percentage is at or above its
 * `minPercent`; the highest matching band wins. Returns '' when no bands exist.
 */
export function hpStateLabel(
  current: number,
  max: number,
  bands: HpStateBand[]
): string {
  if (bands.length === 0) return '';
  const pct = hpPercent(current, max);
  // Highest minPercent first; pick the first band the percentage reaches.
  const sorted = [...bands].sort((a, b) => b.minPercent - a.minPercent);
  const match = sorted.find(b => pct >= b.minPercent);
  // Fall back to the lowest band if somehow nothing matched.
  return (match ?? sorted[sorted.length - 1]).label;
}
