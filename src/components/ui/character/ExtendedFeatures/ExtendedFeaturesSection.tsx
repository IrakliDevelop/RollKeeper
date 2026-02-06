'use client';

import React, { useState } from 'react';
import {
  ExtendedFeature,
  FeatureCategory,
  groupFeaturesBySource,
  CharacterState,
} from '@/types/character';
import { ChevronDown, ChevronRight, Plus, Settings } from 'lucide-react';
import FeatureCategorySection from '@/components/ui/character/ExtendedFeatures/FeatureCategorySection';
import UnifiedFeatureModal from '@/components/ui/character/ExtendedFeatures/UnifiedFeatureModal';
import { Button } from '@/components/ui/forms';

interface ExtendedFeaturesSectionProps {
  features: ExtendedFeature[];
  character: CharacterState;
  onAddFeature: (
    feature: Omit<ExtendedFeature, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onUpdateFeature: (id: string, updates: Partial<ExtendedFeature>) => void;
  onDeleteFeature: (id: string) => void;
  onUseFeature: (id: string) => void;
  onResetFeatures: (restType: 'short' | 'long') => void;
  onReorderFeatures: (
    sourceIndex: number,
    destinationIndex: number,
    sourceType?: string
  ) => void;
  readonly?: boolean;
  className?: string;
}

export default function ExtendedFeaturesSection({
  features,
  character,
  onAddFeature,
  onUpdateFeature,
  onDeleteFeature,
  onUseFeature,
  onResetFeatures,
  onReorderFeatures,
  readonly = false,
  className = '',
}: ExtendedFeaturesSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );

  // Group features by source type
  const categories: FeatureCategory[] = groupFeaturesBySource(features);
  const totalFeatures = features.length;
  const usedFeatures = features.filter(f => f.usedUses > 0).length;

  const toggleCategoryCollapse = (sourceType: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(sourceType)) {
      newCollapsed.delete(sourceType);
    } else {
      newCollapsed.add(sourceType);
    }
    setCollapsedCategories(newCollapsed);
  };

  return (
    <section
      className={`border-accent-indigo-border from-accent-indigo-bg to-accent-purple-bg rounded-xl border-2 bg-gradient-to-br p-6 shadow-lg transition-all duration-300 ${className}`}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-heading hover:text-body flex items-center gap-2 text-xl font-bold transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
          Character Features
          {totalFeatures > 0 && (
            <span className="bg-accent-indigo-bg-strong text-accent-indigo-text rounded-full px-2 py-1 text-sm font-medium">
              {totalFeatures}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {/* Usage summary */}
          {totalFeatures > 0 && !isCollapsed && (
            <div className="text-accent-indigo-text-muted text-sm">
              {usedFeatures > 0 && (
                <span className="bg-accent-orange-bg text-accent-orange-text-muted rounded px-2 py-1">
                  {usedFeatures} used
                </span>
              )}
            </div>
          )}

          {/* Action buttons */}
          {!readonly && !isCollapsed && (
            <div className="flex gap-2">
              <Button
                onClick={() => setIsAddModalOpen(true)}
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                className="bg-accent-indigo-text hover:bg-accent-indigo-text-muted"
                title="Add new feature"
              >
                Add Feature
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="space-y-4">
          {categories.length === 0 ? (
            <div className="border-divider-strong rounded-lg border-2 border-dashed p-8 text-center">
              <div className="text-muted">
                <Settings className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="mb-2 text-lg font-medium">No features yet</p>
                <p className="text-sm">
                  Add class features, racial abilities, feats, and more to
                  organize your character&apos;s capabilities.
                </p>
                {!readonly && (
                  <Button
                    onClick={() => setIsAddModalOpen(true)}
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus className="h-4 w-4" />}
                    className="bg-accent-indigo-text hover:bg-accent-indigo-text-muted mt-4"
                  >
                    Add Your First Feature
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map(category => (
                <FeatureCategorySection
                  key={category.sourceType}
                  category={category}
                  character={character}
                  isCollapsed={collapsedCategories.has(category.sourceType)}
                  onToggleCollapse={() =>
                    toggleCategoryCollapse(category.sourceType)
                  }
                  onUpdateFeature={onUpdateFeature}
                  onDeleteFeature={onDeleteFeature}
                  onUseFeature={onUseFeature}
                  onReorderFeatures={(
                    sourceIndex: number,
                    destinationIndex: number
                  ) =>
                    onReorderFeatures(
                      sourceIndex,
                      destinationIndex,
                      category.sourceType
                    )
                  }
                  readonly={readonly}
                />
              ))}
            </div>
          )}

          {/* Reset buttons */}
          {!readonly && features.some(f => f.usedUses > 0) && (
            <div className="border-divider-strong mt-4 flex gap-2 border-t pt-4">
              <Button
                onClick={() => onResetFeatures('short')}
                variant="success"
                size="sm"
              >
                Short Rest Reset
              </Button>
              <Button
                onClick={() => onResetFeatures('long')}
                variant="primary"
                size="sm"
                className="bg-accent-blue-text hover:bg-accent-blue-text-muted"
              >
                Long Rest Reset
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add Feature Modal */}
      <UnifiedFeatureModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={onAddFeature}
        existingFeatures={features}
        character={character}
      />
    </section>
  );
}
