'use client';

import type { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';
import { SideDrawer } from '@/components/ui/feedback/SideDrawer';
import type { ToastData } from '@/components/ui/feedback/Toast';
import { useCharacterStore } from '@/store/characterStore';

import { OwnSheet } from './OwnSheet';
import type {
  SheetOpenTarget,
  SheetSpellCastingProps,
} from './SheetDrawer.types';

export interface SheetDrawerProps {
  open: boolean;
  onClose: () => void;
  addToast: (t: Omit<ToastData, 'id'>) => void;
  showAttackRoll: (
    label: string,
    roll: number,
    bonus: number,
    isCrit: boolean
  ) => void;
  onRested: (type: 'short' | 'long') => void;
  spellCasting: SheetSpellCastingProps;
  /** Forwarded to SideDrawer; see its focus-return contract. */
  onCloseAutoFocus?: (event: Event) => void;
  /** Which character's sheet is showing — own or (Task 4+) a party member's
   *  limited view. Not yet consumed for branching here: this drawer still
   *  always renders `OwnSheet` (Task 4 adds the `PartySheet` branch). */
  openTarget?: SheetOpenTarget | null;
  /** The live party roster, forwarded through for the Task 4 `PartySheet`
   *  branch to resolve `openTarget.characterId` against. */
  partyMembers?: PartyMemberHP[];
}

export function SheetDrawer({
  open,
  onClose,
  onCloseAutoFocus,
  addToast,
  showAttackRoll,
  onRested,
  spellCasting,
}: SheetDrawerProps) {
  const name = useCharacterStore(s => s.character.name);
  return (
    <SideDrawer
      open={open}
      onOpenChange={next => {
        if (!next) onClose();
      }}
      title={`${name} character sheet`}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {/* Radix unmounts content when closed, so OwnSheet's lock state resets per open.
          `openTarget`/`partyMembers` are accepted above but not yet consumed here —
          Task 4 branches on `openTarget.kind` to render `PartySheet` instead. */}
      <OwnSheet
        onClose={onClose}
        addToast={addToast}
        showAttackRoll={showAttackRoll}
        onRested={onRested}
        spellCasting={spellCasting}
      />
    </SideDrawer>
  );
}
