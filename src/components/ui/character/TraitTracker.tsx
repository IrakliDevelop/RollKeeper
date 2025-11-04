'use client';

import React, { useState } from 'react';
import { TrackableTrait, ExtendedFeature } from '@/types/character';
import { TraitTracker as SharedTraitTracker } from '@/components/shared/character';
import FeatureModal from '@/components/ui/character/ExtendedFeatures/FeatureModal';

type TraitType = TrackableTrait | ExtendedFeature;

interface TraitTrackerProps<T extends TraitType = TrackableTrait> {
  traits: T[];
  characterLevel: number;
  onUpdateTrait: (id: string, updates: Partial<T>) => void;
  onDeleteTrait: (id: string) => void;
  onUseTrait: (id: string) => void;
  onResetTraits: (restType: 'short' | 'long') => void;
  className?: string;
  // Display options
  readonly?: boolean;
  hideControls?: boolean;
  enableViewModal?: boolean; // New prop to enable click-to-view functionality
}

export default function TraitTracker<T extends TraitType = TrackableTrait>({
  traits,
  characterLevel,
  onUpdateTrait,
  onDeleteTrait,
  onUseTrait,
  onResetTraits,
  className = '',
  readonly = false,
  hideControls = false,
  enableViewModal = false,
}: TraitTrackerProps<T>) {
  const [viewingTrait, setViewingTrait] = useState<T | null>(null);

  const handleModalClose = () => {
    setViewingTrait(null);
  };

  const handleModalUpdate = (updates: Partial<ExtendedFeature>) => {
    if (viewingTrait) {
      onUpdateTrait(viewingTrait.id, updates as Partial<T>);
      setViewingTrait({ ...viewingTrait, ...updates } as T);
    }
  };

  const handleModalDelete = () => {
    if (viewingTrait) {
      onDeleteTrait(viewingTrait.id);
      setViewingTrait(null);
    }
  };

  const handleModalUse = () => {
    if (viewingTrait) {
      onUseTrait(viewingTrait.id);
    }
  };

  // Check if trait is an ExtendedFeature (has sourceType property)
  const isExtendedFeature = (trait: TraitType): trait is ExtendedFeature => {
    return 'sourceType' in trait;
  };

  return (
    <>
      <SharedTraitTracker
          traits={traits as TrackableTrait[]}
          characterLevel={characterLevel}
          onUpdateTrait={onUpdateTrait as (id: string, updates: Partial<TrackableTrait>) => void}
          onDeleteTrait={onDeleteTrait}
          onUseTrait={onUseTrait}
          onResetTraits={onResetTraits}
          onTraitClick={enableViewModal ? (trait) => setViewingTrait(trait as T) : undefined}
          readonly={readonly}
          compact={false}
          hideControls={hideControls}
          showOnlyUsed={false}
          className={className}
        />
      {enableViewModal && viewingTrait && isExtendedFeature(viewingTrait) && (
        <FeatureModal
          feature={viewingTrait}
          isOpen={true}
          mode="view"
          characterLevel={characterLevel}
          onClose={handleModalClose}
          onUpdate={handleModalUpdate}
          onDelete={handleModalDelete}
          onUse={handleModalUse}
          readonly={hideControls} // If controls are hidden, make modal readonly too
        />
      )}
    </>
  );
}
