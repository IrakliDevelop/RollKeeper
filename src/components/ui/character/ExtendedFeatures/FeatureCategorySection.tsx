'use client';

import React from 'react';
import { ExtendedFeature, FeatureCategory } from '@/types/character';
import { ChevronDown, ChevronRight } from 'lucide-react';
import DragDropList from '@/components/ui/layout/DragDropList';
import FeatureCard from './FeatureCard';

interface FeatureCategorySectionProps {
  category: FeatureCategory;
  characterLevel: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onUpdateFeature: (id: string, updates: Partial<FeatureCategory['features'][0]>) => void;
  onDeleteFeature: (id: string) => void;
  onUseFeature: (id: string) => void;
  onReorderFeatures: (sourceIndex: number, destinationIndex: number) => void;
  readonly?: boolean;
}

export default function FeatureCategorySection({
  category,
  characterLevel,
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
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Category Header */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
          <div>
            <h3 className="font-semibold text-gray-900">{label}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
            {features.length} feature{features.length !== 1 ? 's' : ''}
          </span>
          {usedCount > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
              {usedCount} used
            </span>
          )}
        </div>
      </button>

      {/* Category Content */}
      {!isCollapsed && (
        <div className="border-t border-gray-100 p-6">
          <DragDropList
            items={features}
            onReorder={onReorderFeatures}
            keyExtractor={(feature) => feature.id}
            disabled={readonly}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            showDragHandle={!readonly}
            renderItem={(feature, index, isDragging) => (
              <FeatureCard
                feature={feature}
                characterLevel={characterLevel}
                onUpdate={(updates: Partial<ExtendedFeature>) => onUpdateFeature(feature.id, updates)}
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
