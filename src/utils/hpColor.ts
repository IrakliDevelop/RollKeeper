import { hpPercent, hpTier, type HpTier } from './hpState';

/**
 * HP colours by tier, in Felt and Brass roles: verdigris while healthy,
 * ember while bloodied (`mid` and `low`), blood when critical. Every HP
 * readout, bar and status word takes its colour from here.
 */

/** Bar fill for a health tier. */
export function getHpTierBarColor(tier: HpTier): string {
  switch (tier) {
    case 'high':
      return 'bg-verdigris-fill';
    case 'mid':
    case 'low':
      return 'bg-ember-fill';
    case 'critical':
      return 'bg-blood-fill';
  }
}

/** Text colour for a status word ("Healthy", "Bloodied", "Critical"). */
export function getHpTierTextColor(tier: HpTier): string {
  switch (tier) {
    case 'high':
      return 'text-verdigris-text';
    case 'mid':
    case 'low':
      return 'text-ember-text';
    case 'critical':
      return 'text-blood-text';
  }
}

/**
 * Text colour for an HP number. It stays the heading colour while healthy:
 * red is kept for real danger.
 */
export function getHpTierNumberColor(tier: HpTier): string {
  switch (tier) {
    case 'high':
      return 'text-heading';
    case 'mid':
    case 'low':
      return 'text-ember-text';
    case 'critical':
      return 'text-blood-text';
  }
}

/** Bar fill for current/max HP; a neutral track colour when there is no max. */
export function getHpBarColor(current: number, max: number): string {
  if (max <= 0) return 'bg-surface-secondary';
  return getHpTierBarColor(hpTier(hpPercent(current, max)));
}

/** Text colour for a current-HP number out of max (blood when there is no max). */
export function getHpNumberColor(current: number, max: number): string {
  return getHpTierNumberColor(hpTier(hpPercent(current, max)));
}
