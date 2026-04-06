'use client';

import React, { useState } from 'react';
import { Zap, Eye, Clock, AlertCircle, CheckCircle2, Star } from 'lucide-react';
import { useCharacterStore } from '@/store/characterStore';
import { ExtendedFeature } from '@/types/character';
import { calculateTraitMaxUses } from '@/utils/calculations';
import FeatureModal from '@/components/ui/character/ExtendedFeatures/FeatureModal';
import { Button } from '@/components/ui/forms';

export function QuickFeatures() {
  const character = useCharacterStore(state => state.character);
  const spendFeature = useCharacterStore(state => state.useExtendedFeature);
  const toggleFavoriteFeature = useCharacterStore(
    state => state.toggleFavoriteFeature
  );

  const [viewingFeature, setViewingFeature] = useState<ExtendedFeature | null>(
    null
  );

  const favoriteIds = character.favoriteFeatureIds || [];
  const favoriteFeatures = (character.extendedFeatures || []).filter(f =>
    favoriteIds.includes(f.id)
  );

  if (favoriteFeatures.length === 0) {
    return (
      <div className="text-muted py-6 text-center text-sm">
        <Star className="mx-auto mb-2 h-8 w-8 opacity-40" />
        <p>No favorite features yet.</p>
        <p className="mt-1 text-xs opacity-70">
          Star features in the Features tab to pin them here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {favoriteFeatures.map(feature => (
          <QuickFeatureCard
            key={feature.id}
            feature={feature}
            characterLevel={character.level}
            onUse={() => spendFeature(feature.id)}
            onView={() => setViewingFeature(feature)}
            onUnfavorite={() => toggleFavoriteFeature(feature.id)}
          />
        ))}
      </div>

      {viewingFeature && (
        <FeatureModal
          feature={viewingFeature}
          isOpen={true}
          mode="view"
          characterLevel={character.level}
          onClose={() => setViewingFeature(null)}
          onUpdate={() => {}}
          onDelete={() => {}}
          onUse={() => spendFeature(viewingFeature.id)}
          readonly
        />
      )}
    </>
  );
}

function QuickFeatureCard({
  feature,
  characterLevel,
  onUse,
  onView,
  onUnfavorite,
}: {
  feature: ExtendedFeature;
  characterLevel: number;
  onUse: () => void;
  onView: () => void;
  onUnfavorite: () => void;
}) {
  const maxUses = calculateTraitMaxUses(feature, characterLevel);
  const usesRemaining = maxUses - feature.usedUses;
  const isExhausted = !feature.isPassive && usesRemaining <= 0;
  const hasUses = !feature.isPassive && maxUses > 0;

  return (
    <div
      className={`bg-surface-raised flex items-center gap-3 rounded-lg border-2 p-3 transition-all ${
        isExhausted
          ? 'border-accent-red-border bg-accent-red-bg opacity-70'
          : 'border-divider-strong hover:border-accent-amber-border'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="text-heading truncate text-sm font-semibold">
            {feature.name}
          </h4>
          {feature.sourceDetail && (
            <span className="bg-surface-inset text-muted hidden rounded px-1.5 py-0.5 text-[10px] sm:inline-block">
              {feature.sourceDetail}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-3 text-xs">
          {feature.isPassive ? (
            <span className="text-accent-blue-text-muted flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Passive
            </span>
          ) : hasUses ? (
            <span
              className={`flex items-center gap-1 ${
                isExhausted
                  ? 'text-accent-red-text-muted'
                  : usesRemaining <= 1
                    ? 'text-accent-orange-text-muted'
                    : 'text-accent-green-text-muted'
              }`}
            >
              {isExhausted ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              {usesRemaining}/{maxUses}
            </span>
          ) : (
            <span className="text-accent-blue-text-muted flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Unlimited
            </span>
          )}
          {hasUses && (
            <span className="text-muted flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span className="capitalize">{feature.restType}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        {!feature.isPassive && hasUses && !isExhausted && (
          <Button
            onClick={onUse}
            variant="primary"
            size="xs"
            className="bg-accent-indigo-text hover:bg-accent-indigo-text-muted"
            title="Use feature"
          >
            <Zap className="h-4 w-4" />
          </Button>
        )}
        <Button
          onClick={onView}
          variant="ghost"
          size="xs"
          className="text-muted hover:bg-surface-hover"
          title="View details"
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          onClick={onUnfavorite}
          variant="ghost"
          size="xs"
          className="text-accent-amber-text hover:bg-accent-amber-bg-strong"
          title="Remove from quick actions"
        >
          <Star className="h-4 w-4 fill-current" />
        </Button>
      </div>
    </div>
  );
}
