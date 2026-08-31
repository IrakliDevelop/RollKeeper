import { useCallback } from 'react';

import { useCharacterStore } from '@/store/characterStore';

import type { Spell, SpellSlots } from '@/types/character';

export interface CastSpellOptions {
  /** Slot level chosen; pass spell.level for cantrip/free/ritual/pact casts. */
  level: number;
  useFreecast?: boolean;
  isRitual?: boolean;
  usePact?: boolean;
}

/**
 * Shared cast bookkeeping (extracted from QuickSpells): concentration
 * replacement, payment (free cast / ritual / pact slot / spell slot), and
 * reaction auto-use. Pure state effects — UI (toasts, template placement)
 * belongs to the caller.
 */
export function useCastSpell() {
  const character = useCharacterStore(s => s.character);
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const spendSpellSlot = useCharacterStore(s => s.spendSpellSlot);
  const spendPactMagicSlot = useCharacterStore(s => s.spendPactMagicSlot);
  const startConcentration = useCharacterStore(s => s.startConcentration);
  const stopConcentration = useCharacterStore(s => s.stopConcentration);
  const toggleReaction = useCharacterStore(s => s.toggleReaction);
  const consumeInventoryCost = useCharacterStore(s => s.consumeInventoryCost);

  const castSpell = useCallback(
    (spell: Spell, options: CastSpellOptions) => {
      if (!consumeInventoryCost(spell.inventoryCost)) return false;
      if (spell.concentration) {
        if (character.concentration.isConcentrating) {
          stopConcentration();
        }
        startConcentration(spell.name, spell.id, options.level);
      }

      if (options.useFreecast) {
        if (spell.freeCastMax && spell.freeCastMax > 0) {
          updateCharacter({
            spells: character.spells.map(s =>
              s.id === spell.id
                ? { ...s, freeCastsUsed: (s.freeCastsUsed || 0) + 1 }
                : s
            ),
          });
        }
        // at-will (freeCastMax === 0): nothing to track
      } else if (options.isRitual) {
        // ritual casting spends no slot
      } else if (options.usePact) {
        if (!character.pactMagic) {
          console.warn(
            '[useCastSpell] usePact without pactMagic — spending nothing'
          );
        } else {
          spendPactMagicSlot();
        }
      } else if (spell.level > 0) {
        const level = options.level as keyof SpellSlots;
        spendSpellSlot(level);
      }

      if (
        spell.castingTime?.toLowerCase().includes('reaction') &&
        !character.reaction?.hasUsedReaction
      ) {
        toggleReaction();
      }
      return true;
    },
    [
      character,
      updateCharacter,
      spendSpellSlot,
      spendPactMagicSlot,
      startConcentration,
      stopConcentration,
      toggleReaction,
      consumeInventoryCost,
    ]
  );

  return { castSpell };
}
