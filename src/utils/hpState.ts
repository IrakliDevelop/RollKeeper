import type { EnemyHpDisplay, HpStateBand } from '@/types/encounter';
import type { SharedTurnEntry } from '@/types/sharedState';

/** Current HP as a clamped 0-100 percentage of max. */
export function hpPercent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (current / max) * 100));
}

export type HpTier = 'high' | 'mid' | 'low' | 'critical';

/**
 * Coarse health tier from a 0-100 percentage, for colour-coding. Each
 * threshold is inclusive (75% is still `high`), matching the `>=` rule of
 * the DM's HP state bands so a label and its colour never disagree.
 */
export function hpTier(percent: number): HpTier {
  if (percent >= 75) return 'high';
  if (percent >= 50) return 'mid';
  if (percent >= 25) return 'low';
  return 'critical';
}

/** The four HP statuses a viewer can be told about. */
export type HpStatus = 'healthy' | 'bloodied' | 'critical' | 'down';

/** The word shown for each status wherever there's room for one. */
export const HP_STATUS_LABELS: Record<HpStatus, string> = {
  healthy: 'Healthy',
  bloodied: 'Bloodied',
  critical: 'Critical',
  down: 'Down',
};

/**
 * Status for current/max HP: `down` at 0 HP or below, otherwise the tier
 * (`mid` and `low` are both `bloodied`).
 */
export function hpStatus(current: number, max: number): HpStatus {
  if (current <= 0) return 'down';
  switch (hpTier(hpPercent(current, max))) {
    case 'high':
      return 'healthy';
    case 'mid':
    case 'low':
      return 'bloodied';
    case 'critical':
      return 'critical';
  }
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

/**
 * The HP display mode that applies to one shared turn entry. A per-entry
 * override (the DM toggled "show exact HP to players" on that entity) wins over
 * the campaign-wide mode; payloads without `hpMode` fall back to the
 * state-level mode.
 */
export function resolveEntryHpMode(
  entry: Pick<SharedTurnEntry, 'hpMode'>,
  stateMode: EnemyHpDisplay
): EnemyHpDisplay {
  return entry.hpMode ?? stateMode;
}
