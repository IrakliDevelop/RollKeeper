'use client';

import React, { useState } from 'react';
import { ExtendedFeature, FeatureCategory, groupFeaturesBySource } from '@/types/character';
import { ChevronDown, ChevronRight, Plus, Settings } from 'lucide-react';
import FeatureCategorySection from '@/components/ui/character/ExtendedFeatures/FeatureCategorySection';
import AddFeatureModal from '@/components/ui/character/ExtendedFeatures/AddFeatureModal';
import { Button } from '@/components/ui/forms';

interface ExtendedFeaturesSectionProps {
  features: ExtendedFeature[];
  characterLevel: number;
  onAddFeature: (feature: Omit<ExtendedFeature, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateFeature: (id: string, updates: Partial<ExtendedFeature>) => void;
  onDeleteFeature: (id: string) => void;
  onUseFeature: (id: string) => void;
  onResetFeatures: (restType: 'short' | 'long') => void;
  onReorderFeatures: (sourceIndex: number, destinationIndex: number, sourceType?: string) => void;
  readonly?: boolean;
  className?: string;
}

export default function ExtendedFeaturesSection({
  features,
  characterLevel,
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
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

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
    <section className={`rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6 shadow-lg transition-all duration-300 ${className}`}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 text-xl font-bold text-indigo-900 transition-colors hover:text-indigo-700"
        >
          {isCollapsed ? (
            <ChevronRight className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
          Character Features
          {totalFeatures > 0 && (
            <span className="rounded-full bg-indigo-200 px-2 py-1 text-sm font-medium text-indigo-800">
              {totalFeatures}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {/* Usage summary */}
          {totalFeatures > 0 && !isCollapsed && (
            <div className="text-sm text-indigo-600">
              {usedFeatures > 0 && (
                <span className="rounded bg-orange-100 px-2 py-1 text-orange-700">
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
                className="bg-indigo-600 hover:bg-indigo-700"
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
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
              <div className="text-gray-500">
                <Settings className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No features yet</p>
                <p className="text-sm">
                  Add class features, racial abilities, feats, and more to organize your character&apos;s capabilities.
                </p>
                {!readonly && (
                  <Button
                    onClick={() => setIsAddModalOpen(true)}
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus className="h-4 w-4" />}
                    className="mt-4 bg-indigo-600 hover:bg-indigo-700"
                  >
                    Add Your First Feature
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <FeatureCategorySection
                  key={category.sourceType}
                  category={category}
                  characterLevel={characterLevel}
                  isCollapsed={collapsedCategories.has(category.sourceType)}
                  onToggleCollapse={() => toggleCategoryCollapse(category.sourceType)}
                  onUpdateFeature={onUpdateFeature}
                  onDeleteFeature={onDeleteFeature}
                  onUseFeature={onUseFeature}
                  onReorderFeatures={(sourceIndex: number, destinationIndex: number) => 
                    onReorderFeatures(sourceIndex, destinationIndex, category.sourceType)
                  }
                  readonly={readonly}
                />
              ))}
            </div>
          )}

          {/* Reset buttons */}
          {!readonly && features.some(f => f.usedUses > 0) && (
            <div className="mt-4 flex gap-2 pt-4 border-t border-indigo-200">
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
                className="bg-blue-600 hover:bg-blue-700"
              >
                Long Rest Reset
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add Feature Modal */}
      <AddFeatureModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={onAddFeature}
        existingFeatures={features}
      />
    </section>
  );
}
