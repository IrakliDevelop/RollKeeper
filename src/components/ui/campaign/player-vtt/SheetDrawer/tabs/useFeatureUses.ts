'use client';

import { useCharacterStore } from '@/store/characterStore';

import type { FeatureRowView } from '../SheetDrawer.types';

/**
 * Shared spend/restore handlers for a feature-or-trait use pip, dispatching
 * to the extended-feature or trackable-trait store actions by row kind. Used
 * by the Features tab and by the Overview tab's pinned favorites.
 */
export function useFeatureUses() {
  const expendFeature = useCharacterStore(s => s.useExtendedFeature);
  const updateExtendedFeature = useCharacterStore(s => s.updateExtendedFeature);
  const expendTrait = useCharacterStore(s => s.useTrackableTrait);
  const updateTrackableTrait = useCharacterStore(s => s.updateTrackableTrait);

  const spend = (feature: FeatureRowView) =>
    feature.kind === 'extended'
      ? expendFeature(feature.id)
      : expendTrait(feature.id);

  // Absolute usedUses write under the cross-tab single-writer model (as on
  // the full sheet); a canonical restore action is a follow-up.
  const restore = (feature: FeatureRowView) =>
    feature.kind === 'extended'
      ? updateExtendedFeature(feature.id, { usedUses: feature.usedUses - 1 })
      : updateTrackableTrait(feature.id, { usedUses: feature.usedUses - 1 });

  return { spend, restore };
}
