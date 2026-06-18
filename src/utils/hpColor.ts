import type { HpTier } from './hpState';

/**
 * Tailwind background class for an HP bar, by current/max ratio.
 * Green > 50%, amber > 25%, red at/below 25%. Shared by the party HP sidebar
 * and the initiative panel so player HP reads consistently across the app.
 */
export function getHpBarColor(current: number, max: number): string {
  if (max <= 0) return 'bg-surface-secondary';
  const pct = current / max;
  if (pct > 0.5) return 'bg-green-600 dark:bg-green-500';
  if (pct > 0.25) return 'bg-amber-500 dark:bg-amber-400';
  return 'bg-red-600 dark:bg-red-500';
}

/** Semantic text-colour token for a coarse health tier (enemy status labels). */
export function getHpTierTextColor(tier: HpTier): string {
  switch (tier) {
    case 'high':
      return 'text-accent-emerald-text';
    case 'mid':
      return 'text-accent-amber-text';
    case 'low':
      return 'text-accent-orange-text';
    case 'critical':
      return 'text-accent-red-text';
  }
}
