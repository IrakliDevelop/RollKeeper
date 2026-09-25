'use client';

import type { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';
import { SideDrawer } from '@/components/ui/feedback/SideDrawer';
import type { ToastData } from '@/components/ui/feedback/Toast';
import { useCharacterStore } from '@/store/characterStore';

import { OwnSheet } from './OwnSheet';
import { PartySheet } from './PartySheet';
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
  /** Which character's sheet is showing — own, or another party member's
   *  read-only limited view (`PartySheet`), resolved from `partyMembers` by
   *  `characterId`. */
  openTarget?: SheetOpenTarget | null;
  /** The live party roster the `PartySheet` branch resolves
   *  `openTarget.characterId` against. */
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
  openTarget,
  partyMembers = [],
}: SheetDrawerProps) {
  const ownName = useCharacterStore(s => s.character.name);
  const isParty = openTarget?.kind === 'party';
  const partyMember = isParty
    ? partyMembers.find(m => m.characterId === openTarget.characterId)
    : undefined;
  const title = isParty
    ? `${partyMember?.characterName ?? 'Party member'} limited view`
    : `${ownName} character sheet`;

  return (
    <SideDrawer
      open={open}
      onOpenChange={next => {
        if (!next) onClose();
      }}
      title={title}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {/* Radix unmounts content when closed, so OwnSheet's lock state resets per open. */}
      {isParty ? (
        <PartySheet member={partyMember} onClose={onClose} />
      ) : (
        <OwnSheet
          onClose={onClose}
          addToast={addToast}
          showAttackRoll={showAttackRoll}
          onRested={onRested}
          spellCasting={spellCasting}
        />
      )}
    </SideDrawer>
  );
}
