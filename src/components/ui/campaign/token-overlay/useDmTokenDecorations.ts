'use client';

import { useMemo } from 'react';

import { toSharedConditions } from '@/utils/buildSharedInitiative';
import { hpPercent, hpTier } from '@/utils/hpState';

import type { EncounterEntity } from '@/types/encounter';
import type { TokenDecoration } from './TokenDecorationLayer.types';

/** DM-side decorations: full fidelity, always — real names, exact HP. */
export function useDmTokenDecorations(
  entities: EncounterEntity[]
): ReadonlyMap<string, TokenDecoration> {
  return useMemo(() => {
    const map = new Map<string, TokenDecoration>();
    for (const e of entities) {
      if (e.type === 'lair') continue; // no token presence
      const percent = hpPercent(e.currentHp, e.maxHp);
      const deco: TokenDecoration = {
        name: e.name,
        hp: {
          kind: 'exact',
          current: e.currentHp,
          max: e.maxHp,
          percent,
          tier: hpTier(percent),
        },
        isDead: e.currentHp <= 0,
        chessPiece: e.chessPiece,
        pieceColor: e.color,
      };
      if (e.conditions.length > 0)
        deco.conditions = toSharedConditions(e.conditions);
      if (e.concentrationSpell) deco.isConcentrating = true;
      map.set(e.id, deco);
      if (e.playerCharacterId) map.set(e.playerCharacterId, deco);
    }
    return map;
  }, [entities]);
}
