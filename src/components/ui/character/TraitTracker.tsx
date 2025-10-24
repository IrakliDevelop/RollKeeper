'use client';

import React from 'react';
import { TrackableTrait, ExtendedFeature } from '@/types/character';
import { TraitTracker as SharedTraitTracker } from '@/components/shared/character';

type TraitType = TrackableTrait | ExtendedFeature;

interface TraitTrackerProps<T extends TraitType = TrackableTrait> {
  traits: T[];
  characterLevel: number;
  onAddTrait: (trait: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTrait: (id: string, updates: Partial<T>) => void;
  onDeleteTrait: (id: string) => void;
  onUseTrait: (id: string) => void;
  onResetTraits: (restType: 'short' | 'long') => void;
  className?: string;
  // Display options
  readonly?: boolean;
  hideAddButton?: boolean;
  hideControls?: boolean;
}

export default function TraitTracker<T extends TraitType = TrackableTrait>({
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
}: TraitTrackerProps<T>) {
  return (
    <SharedTraitTracker
      traits={traits as TrackableTrait[]}
      characterLevel={characterLevel}
      onAddTrait={onAddTrait as (trait: Omit<TrackableTrait, 'id' | 'createdAt' | 'updatedAt'>) => void}
      onUpdateTrait={onUpdateTrait as (id: string, updates: Partial<TrackableTrait>) => void}
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
