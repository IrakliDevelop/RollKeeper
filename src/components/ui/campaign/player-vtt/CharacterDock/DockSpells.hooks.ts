import { useState } from 'react';

import { useCastSpell } from '@/hooks/useCastSpell';
import type { ToastData } from '@/components/ui/feedback/Toast';
import type { Spell } from '@/types/character';
import type { SpellAoe } from '@/types/spellAoe';

import { describeCastPayment } from './DockSpells.utils';

export interface UseDockSpellCastingArgs {
  addToast: (toast: Omit<ToastData, 'id'>) => void;
  onCastPlacement: (spellName: string, aoe: NonNullable<SpellAoe>) => void;
  connectionLive: boolean;
  hasPendingPlacement: boolean;
  onCancelPlacement: () => void;
}

/**
 * Owns the dock's cast flow: cantrip = immediate cast, leveled = opens
 * `SpellCastModal`, and the post-cast placement/toast/concentration-cancel
 * side effects described in spec §4/§6.
 */
export function useDockSpellCasting({
  addToast,
  onCastPlacement,
  connectionLive,
  hasPendingPlacement,
  onCancelPlacement,
}: UseDockSpellCastingArgs) {
  const { castSpell } = useCastSpell();
  const [castingSpell, setCastingSpell] = useState<Spell | null>(null);
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null);

  const finishCast = (
    spell: Spell,
    level: number,
    useFreecast?: boolean,
    isRitual?: boolean,
    usePact?: boolean
  ) => {
    // A second concentration cast always cancels a stale pending placement
    // first — regardless of whether this cast is itself an AoE, and
    // regardless of connection state — so a leftover template-arm banner
    // never survives past the moment concentration would break it.
    if (spell.concentration && hasPendingPlacement) {
      onCancelPlacement();
    }

    if (spell.aoe) {
      if (connectionLive) {
        // Replaces whatever pending placement remains (including the one
        // just cancelled above) with this cast's own placement.
        onCastPlacement(spell.name, spell.aoe);
      } else {
        addToast({
          type: 'info',
          title: `${spell.name} cast`,
          message: 'Offline — template not placed',
        });
      }
      return;
    }

    addToast({
      type: 'success',
      title: `${spell.name} cast`,
      message: describeCastPayment(level, useFreecast, isRitual, usePact),
    });
  };

  const handleCastClick = (spell: Spell) => {
    if (spell.level === 0) {
      if (!castSpell(spell, { level: spell.level })) {
        addToast({
          type: 'error',
          title: `Cannot cast ${spell.name}`,
          message: 'The linked inventory item is missing or out of stock.',
        });
        return;
      }
      finishCast(spell, spell.level);
      return;
    }
    setCastingSpell(spell);
  };

  const handleModalCast = (
    level: number,
    useFreecast: boolean,
    isRitual?: boolean,
    usePact?: boolean
  ) => {
    if (!castingSpell) return;
    if (!castSpell(castingSpell, { level, useFreecast, isRitual, usePact })) {
      addToast({
        type: 'error',
        title: `Cannot cast ${castingSpell.name}`,
        message: 'The linked inventory item is missing or out of stock.',
      });
      return;
    }
    finishCast(castingSpell, level, useFreecast, isRitual, usePact);
  };

  return {
    castingSpell,
    viewingSpell,
    setViewingSpell,
    handleCastClick,
    handleModalCast,
    closeCastModal: () => setCastingSpell(null),
    closeDetailsModal: () => setViewingSpell(null),
  };
}
