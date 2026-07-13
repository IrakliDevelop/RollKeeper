import type { ChessPiece } from '@/types/encounter';
import type { SharedCondition } from '@/types/sharedState';
import type { HpTier } from '@/utils/hpState';

/** Token decoration visibility: full (bar + chips), compact (bar only), off (nothing). */
export type TokenInfoMode = 'full' | 'compact' | 'off';

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
  /** Chess piece icon for map correlation — omit → no piece glyph. */
  chessPiece?: ChessPiece;
  /** Piece tint; falls back to a neutral color when omitted. */
  pieceColor?: string;
  /** Active conditions, already policy-filtered. Omit/empty → no strip. */
  conditions?: SharedCondition[];
  /** Entity is concentrating → purple ring around the token. */
  isConcentrating?: boolean;
}
