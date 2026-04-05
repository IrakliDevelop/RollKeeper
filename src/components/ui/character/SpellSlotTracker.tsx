'use client';

import React from 'react';
import { SpellSlots, PactMagic } from '@/types/character';
import { SpellSlotTracker as SharedSpellSlotTracker } from '@/components/shared/spells';

interface SpellSlotTrackerProps {
  spellSlots: SpellSlots;
  pactMagic?: PactMagic;
  onSpellSlotChange: (level: keyof SpellSlots, used: number) => void;
  onPactMagicChange?: (used: number) => void;
  onResetSpellSlots: () => void;
  onResetPactMagic?: () => void;
  compact?: boolean;
  hideTitle?: boolean;
  className?: string;
}

export default function SpellSlotTracker({
  spellSlots,
  pactMagic,
  onSpellSlotChange,
  onPactMagicChange,
  onResetSpellSlots,
  onResetPactMagic,
  compact = false,
  hideTitle = false,
  className = '',
}: SpellSlotTrackerProps) {
  return (
    <SharedSpellSlotTracker
      spellSlots={spellSlots}
      pactMagic={pactMagic}
      onSpellSlotChange={onSpellSlotChange}
      onPactMagicChange={onPactMagicChange}
      onResetSpellSlots={onResetSpellSlots}
      onResetPactMagic={onResetPactMagic}
      readonly={false}
      compact={compact}
      hideControls={false}
      hideResetButtons={false}
      hideTitle={hideTitle}
      showOnlyUsed={false}
      maxLevelToShow={9}
      className={className}
    />
  );
}
