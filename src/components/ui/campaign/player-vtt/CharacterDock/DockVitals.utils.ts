import { hpTier } from '@/utils/hpState';

/**
 * Card background/border by HP percentage, on the shared HP tiers: healthy
 * from 75%, bloodied from 25%, critical below.
 */
export function getHpCardClasses(percent: number): string {
  switch (hpTier(percent)) {
    case 'high':
      return 'bg-accent-emerald-bg border-accent-emerald-border';
    case 'mid':
    case 'low':
      return 'bg-accent-amber-bg border-accent-amber-border';
    case 'critical':
      return 'bg-accent-red-bg border-accent-red-border';
  }
}

/** Parses a raw HP-editor input string; returns null for NaN/empty/non-positive. */
export function parseHpAmount(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isNaN(n) || n <= 0 ? null : n;
}
