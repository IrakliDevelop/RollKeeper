'use client';

import React from 'react';
import { HeroicInspiration } from '@/types/character';
import { HeroicInspirationTracker as SharedHeroicInspirationTracker } from '@/components/shared/character';

interface HeroicInspirationTrackerProps {
  inspiration: HeroicInspiration;
  onUpdateInspiration: (updates: Partial<HeroicInspiration>) => void;
  onAddInspiration: (amount?: number) => void;
  onUseInspiration: () => void;
  onResetInspiration: () => void;
  stackable: boolean;
  showStackableControl?: boolean;
  dmControlled?: boolean;
  onToggleStackable?: (enabled: boolean) => void;
  className?: string;
}

export default function HeroicInspirationTracker({
  inspiration,
  onUpdateInspiration,
  onAddInspiration,
  onUseInspiration,
  onResetInspiration,
  stackable,
  showStackableControl,
  dmControlled,
  onToggleStackable,
  className = '',
}: HeroicInspirationTrackerProps) {
  // Use the shared HeroicInspirationTracker component with full functionality
  return (
    <SharedHeroicInspirationTracker
      inspiration={inspiration}
      onUpdateInspiration={onUpdateInspiration}
      onAddInspiration={onAddInspiration}
      onUseInspiration={onUseInspiration}
      onResetInspiration={onResetInspiration}
      stackable={stackable}
      showStackableControl={showStackableControl}
      dmControlled={dmControlled}
      onToggleStackable={onToggleStackable}
      readonly={false}
      compact={false}
      hideControls={false}
      hideSettings={false}
      hideHelperText={false}
      className={className}
    />
  );
}
