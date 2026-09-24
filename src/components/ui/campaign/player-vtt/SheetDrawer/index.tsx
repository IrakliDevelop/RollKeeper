'use client';

import { SideDrawer } from '@/components/ui/feedback/SideDrawer';
import type { ToastData } from '@/components/ui/feedback/Toast';
import { useCharacterStore } from '@/store/characterStore';

import { OwnSheet } from './OwnSheet';

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
}

export function SheetDrawer({ open, onClose, ...rest }: SheetDrawerProps) {
  const name = useCharacterStore(s => s.character.name);
  return (
    <SideDrawer
      open={open}
      onOpenChange={next => {
        if (!next) onClose();
      }}
      title={`${name} character sheet`}
    >
      {/* Radix unmounts content when closed, so OwnSheet's lock state resets per open. */}
      <OwnSheet onClose={onClose} {...rest} />
    </SideDrawer>
  );
}
