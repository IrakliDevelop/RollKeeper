import type { HpTier } from '@/utils/hpState';

/** How a token's HP renders: bar-only, bar+numbers, or a state chip ("Bloodied"). */
export type TokenHpView =
  | { kind: 'bar'; percent: number; tier: HpTier }
  | {
      kind: 'exact';
      percent: number;
      tier: HpTier;
      current: number;
      max: number;
    }
  | { kind: 'label'; text: string; tier: HpTier };

export interface TokenDecoration {
  /** Omit → no name row. Player screens receive the policy-filtered displayName. */
  name?: string;
  /** Omit → no HP row (e.g. enemyHpDisplay 'off'). */
  hp?: TokenHpView;
  /** Dim the decoration and replace the HP row with a skull glyph. */
  isDead?: boolean;
}
