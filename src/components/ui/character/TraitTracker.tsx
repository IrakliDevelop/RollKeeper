'use client';

import React from 'react';
import { TrackableTrait } from '@/types/character';
import { TraitTracker as SharedTraitTracker } from '@/components/shared/character';

interface TraitTrackerProps {
  traits: TrackableTrait[];
  characterLevel: number;
  onAddTrait: (
    trait: Omit<TrackableTrait, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onUpdateTrait: (id: string, updates: Partial<TrackableTrait>) => void;
  onDeleteTrait: (id: string) => void;
  onUseTrait: (id: string) => void;
  onResetTraits: (restType: 'short' | 'long') => void;
  className?: string;
  // Display options
  readonly?: boolean;
  hideAddButton?: boolean;
  hideControls?: boolean;
}

export default function TraitTracker({
  traits,
  characterLevel,
  onAddTrait,
  onUpdateTrait,
  onDeleteTrait,
  onUseTrait,
  onResetTraits,
  className = '',
  readonly = false,
  hideAddButton = false,
  hideControls = false,
}: TraitTrackerProps) {
  // Use the shared TraitTracker component with full functionality
  return (
    <SharedTraitTracker
      traits={traits}
      characterLevel={characterLevel}
      onAddTrait={onAddTrait}
      onUpdateTrait={onUpdateTrait}
      onDeleteTrait={onDeleteTrait}
      onUseTrait={onUseTrait}
      onResetTraits={onResetTraits}
      readonly={readonly}
      compact={false}
      hideControls={hideControls}
      hideAddButton={hideAddButton}
      hideResetButtons={false}
      showOnlyUsed={false}
      className={className}
    />
  );
}
