'use client';

import { useMemo } from 'react';

import { hpPercent, hpTier } from '@/utils/hpState';

import type { EnemyHpDisplay } from '@/types/encounter';
import type {
  SharedInitiativeState,
  SharedTurnEntry,
} from '@/types/sharedState';
import type {
  TokenDecoration,
  TokenHpView,
} from './TokenDecorationLayer.types';

function hpViewFor(
  entry: SharedTurnEntry,
  mode: EnemyHpDisplay
): TokenHpView | undefined {
  if (entry.type === 'player') {
    if (entry.currentHp === undefined || entry.maxHp === undefined)
      return undefined;
    const percent = hpPercent(entry.currentHp, entry.maxHp);
    return {
      kind: 'exact',
      current: entry.currentHp,
      max: entry.maxHp,
      percent,
      tier: hpTier(percent),
    };
  }
  // Non-players: exactly what the DM's enemyHpDisplay policy shares — a
  // missing field for the mode (stale share) omits the row, never breaks it.
  switch (mode) {
    case 'off':
      return undefined;
    case 'label':
      return entry.hpState && entry.hpTier
        ? { kind: 'label', text: entry.hpState, tier: entry.hpTier }
        : undefined;
    case 'bar':
    case 'percent':
      return entry.hpPercent !== undefined && entry.hpTier
        ? { kind: 'bar', percent: entry.hpPercent, tier: entry.hpTier }
        : undefined;
    case 'exact': {
      if (entry.currentHp === undefined || entry.maxHp === undefined)
        return undefined;
      const percent = hpPercent(entry.currentHp, entry.maxHp);
      return {
        kind: 'exact',
        current: entry.currentHp,
        max: entry.maxHp,
        percent,
        tier: entry.hpTier ?? hpTier(percent),
      };
    }
  }
}

/** Player-side decorations from the policy-filtered shared initiative. */
export function usePlayerTokenDecorations(
  initiative: SharedInitiativeState | null
): ReadonlyMap<string, TokenDecoration> {
  return useMemo(() => {
    const map = new Map<string, TokenDecoration>();
    if (!initiative) return map;
    for (const entry of initiative.turnOrder) {
      const deco: TokenDecoration = {
        name: entry.displayName,
        hp: hpViewFor(entry, initiative.enemyHpMode),
        isDead: entry.isDead ?? false,
        chessPiece: entry.chessPiece,
        pieceColor: entry.tokenColor,
      };
      map.set(entry.entityId, deco);
      if (entry.playerCharacterId) map.set(entry.playerCharacterId, deco);
    }
    return map;
  }, [initiative]);
}
