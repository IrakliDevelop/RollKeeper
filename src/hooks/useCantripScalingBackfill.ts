'use client';

import { useEffect } from 'react';

import { useCharacterStore } from '@/store/characterStore';
import { fetchSpells } from '@/hooks/useSpellsData';
import {
  extractCantripScaling,
  findScalingSpellMatch,
  isSafeScalingBackfillMatch,
} from '@/utils/cantripScaling';

/**
 * Lazily attaches damageScaling tables to already-stored cantrips that were
 * added before cantrip scaling existed (damageScaling === undefined). Runs at
 * most one fetch per mount and only when such a cantrip exists; null
 * (user-custom) entries are never touched. Homebrew cantrips with no JSON
 * match stay undefined — the spell fetch is module-cached, so re-checks are
 * free within a session.
 */
export function useCantripScalingBackfill(): void {
  const spells = useCharacterStore(state => state.character.spells);
  const backfillCantripScaling = useCharacterStore(
    state => state.backfillCantripScaling
  );

  const needsBackfill = spells.some(
    spell => spell.level === 0 && spell.damageScaling === undefined
  );

  useEffect(() => {
    if (!needsBackfill) return;
    let cancelled = false;

    fetchSpells()
      .then(processed => {
        if (cancelled) return;
        const entries: Array<{
          spellId: string;
          scaling: Record<number, string>;
        }> = [];
        for (const spell of spells) {
          if (spell.level !== 0 || spell.damageScaling !== undefined) continue;
          const match = findScalingSpellMatch(
            processed,
            spell.name,
            spell.source
          );
          if (!match || !isSafeScalingBackfillMatch(spell, match)) continue;
          const scaling = extractCantripScaling(
            match.scalingLevelDice,
            spell.damage
          );
          if (scaling) entries.push({ spellId: spell.id, scaling });
        }
        if (entries.length > 0) backfillCantripScaling(entries);
      })
      .catch(error => {
        console.warn('Cantrip scaling backfill skipped:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [needsBackfill, spells, backfillCantripScaling]);
}
