'use client';

import React from 'react';
import { TrackableTrait } from '@/types/character';
import { TraitTracker as SharedTraitTracker } from '@/components/shared/character';

interface TraitTrackerProps {
  traits: TrackableTrait[];
  characterLevel: number;
  onAddTrait: (trait: Omit<TrackableTrait, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTrait: (id: string, updates: Partial<TrackableTrait>) => void;
  onDeleteTrait: (id: string) => void;
  onUseTrait: (id: string) => void;
  onResetTraits: (restType: 'short' | 'long') => void;
  className?: string;
}

export default function TraitTracker({
  traits,
  characterLevel,
  onAddTrait,
  onUpdateTrait,
  onDeleteTrait,
  onUseTrait,
  onResetTraits,
  className = ''
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
      readonly={false}
      compact={false}
      hideControls={false}
      hideAddButton={false}
      hideResetButtons={false}
      showOnlyUsed={false}
      className={className}
    />
  );
}