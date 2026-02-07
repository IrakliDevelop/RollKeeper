'use client';

import React from 'react';
import {
  ExtendedFeature,
  FeatureCategory,
  CharacterState,
} from '@/types/character';
import { ChevronDown, ChevronRight } from 'lucide-react';
import DragDropList from '@/components/ui/layout/DragDropList';
import FeatureCard from './FeatureCard';

interface FeatureCategorySectionProps {
  category: FeatureCategory;
  character: CharacterState;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onUpdateFeature: (
    id: string,
    updates: Partial<FeatureCategory['features'][0]>
  ) => void;
  onDeleteFeature: (id: string) => void;
  onUseFeature: (id: string) => void;
  onReorderFeatures: (sourceIndex: number, destinationIndex: number) => void;
  readonly?: boolean;
}

export default function FeatureCategorySection({
  category,
  character,
  isCollapsed,
  onToggleCollapse,
  onUpdateFeature,
  onDeleteFeature,
  onUseFeature,
  onReorderFeatures,
  readonly = false,
}: FeatureCategorySectionProps) {
  const { features, label, description } = category;
  const usedCount = features.filter(f => f.usedUses > 0).length;

  if (features.length === 0) {
    return null;
  }

  return (
    <div className="border-divider bg-surface-raised rounded-lg border shadow-sm">
      {/* Category Header */}
      <button
        onClick={onToggleCollapse}
        className="hover:bg-surface-hover flex w-full items-center justify-between p-4 text-left transition-colors"
      >
        <div className="flex items-center gap-3">
          {isCollapsed ? (
            <ChevronRight className="text-muted h-5 w-5" />
          ) : (
            <ChevronDown className="text-muted h-5 w-5" />
          )}
          <div>
            <h3 className="text-heading font-semibold">{label}</h3>
            <p className="text-muted text-sm">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-accent-blue-bg text-accent-blue-text rounded-full px-2 py-1 text-xs font-medium">
            {features.length} feature{features.length !== 1 ? 's' : ''}
          </span>
          {usedCount > 0 && (
            <span className="bg-accent-orange-bg text-accent-orange-text rounded-full px-2 py-1 text-xs font-medium">
              {usedCount} used
            </span>
          )}
        </div>
      </button>

      {/* Category Content */}
      {!isCollapsed && (
        <div className="border-divider border-t p-6">
          <DragDropList
            items={features}
            onReorder={onReorderFeatures}
            keyExtractor={feature => feature.id}
            disabled={readonly}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            showDragHandle={!readonly}
            renderItem={(feature, index, isDragging) => (
              <FeatureCard
                feature={feature}
                character={character}
                onUpdate={(updates: Partial<ExtendedFeature>) =>
                  onUpdateFeature(feature.id, updates)
                }
                onDelete={() => onDeleteFeature(feature.id)}
                onUse={() => onUseFeature(feature.id)}
                readonly={readonly}
                isDragging={isDragging}
              />
            )}
          />
        </div>
      )}
    </div>
  );
}
