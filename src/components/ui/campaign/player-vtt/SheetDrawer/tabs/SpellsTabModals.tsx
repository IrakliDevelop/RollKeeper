import type { ToastData } from '@/components/ui/feedback/Toast';
import { SpellCastModal } from '@/components/ui/game/SpellCastModal';
import SpellDetailsModal from '@/components/ui/game/SpellDetailsModal';
import { getTotalLevel } from '@/utils/multiclass';
import type { CharacterState, Spell } from '@/types/character';

export interface SpellsTabModalsProps {
  character: CharacterState;
  castingSpell: Spell | null;
  viewingSpell: Spell | null;
  closeCastModal: () => void;
  closeDetailsModal: () => void;
  handleModalCast: (
    level: number,
    useFreecast: boolean,
    isRitual?: boolean,
    usePact?: boolean
  ) => void;
  handleCastClick: (spell: Spell) => void;
  addToast: (toast: Omit<ToastData, 'id'>) => void;
}

/** SpellCastModal / SpellDetailsModal, rendered exactly as the dock's cast flow. */
export function SpellsTabModals({
  character,
  castingSpell,
  viewingSpell,
  closeCastModal,
  closeDetailsModal,
  handleModalCast,
  handleCastClick,
  addToast,
}: SpellsTabModalsProps) {
  return (
    <>
      {castingSpell && (
        <SpellCastModal
          isOpen
          onClose={closeCastModal}
          spell={castingSpell}
          spellSlots={character.spellSlots}
          concentration={character.concentration}
          pactMagic={character.pactMagic}
          hasUsedReaction={character.reaction?.hasUsedReaction}
          onCastSpell={handleModalCast}
          onReactionSpellCast={() => {
            // Toast only. Reaction state is owned by useCastSpell (invoked via
            // handleModalCast), which already marks reaction spells used —
            // toggling here too would flip it straight back to available.
            addToast({
              type: 'info',
              title: `Reaction used — ${castingSpell.name}`,
              message: '',
            });
          }}
        />
      )}

      {viewingSpell && (
        <SpellDetailsModal
          spell={viewingSpell}
          isOpen
          onClose={closeDetailsModal}
          onCast={() => handleCastClick(viewingSpell)}
          characterLevel={getTotalLevel(character)}
        />
      )}
    </>
  );
}
