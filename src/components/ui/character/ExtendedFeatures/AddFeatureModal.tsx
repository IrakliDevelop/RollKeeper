'use client';

import React, { useState } from 'react';
import { ExtendedFeature, FeatureSourceType, FEATURE_SOURCE_LABELS, createDefaultExtendedFeature } from '@/types/character';
import { Plus, Settings } from 'lucide-react';
import { Modal } from '@/components/ui/feedback';

interface AddFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (feature: Omit<ExtendedFeature, 'id' | 'createdAt' | 'updatedAt'>) => void;
  existingFeatures: ExtendedFeature[];
}

export default function AddFeatureModal({
  isOpen,
  onClose,
  onAdd,
  existingFeatures,
}: AddFeatureModalProps) {
  const [newFeature, setNewFeature] = useState(() => createDefaultExtendedFeature());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newFeature.name.trim()) return;

    // Calculate display order for the new feature
    const featuresOfSameType = existingFeatures.filter(f => f.sourceType === newFeature.sourceType);
    const maxOrder = featuresOfSameType.length > 0 
      ? Math.max(...featuresOfSameType.map(f => f.displayOrder))
      : -1;

    onAdd({
      ...newFeature,
      name: newFeature.name.trim(),
      description: newFeature.description?.trim() || undefined,
      sourceDetail: newFeature.sourceDetail?.trim() || undefined,
      category: newFeature.category?.trim() || undefined,
      displayOrder: maxOrder + 1,
      proficiencyMultiplier: newFeature.scaleWithProficiency ? newFeature.proficiencyMultiplier : undefined,
    });

    // Reset form
    setNewFeature(createDefaultExtendedFeature());
    onClose();
  };

  const handleCancel = () => {
    setNewFeature(createDefaultExtendedFeature());
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Add New Feature"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Feature Name *
            </label>
            <input
              type="text"
              value={newFeature.name}
              onChange={(e) => setNewFeature({ ...newFeature, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g., Action Surge, Darkvision, Lucky"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Type *
              </label>
              <select
                value={newFeature.sourceType}
                onChange={(e) => setNewFeature({ ...newFeature, sourceType: e.target.value as FeatureSourceType })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                required
              >
                {Object.entries(FEATURE_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Detail
              </label>
              <input
                type="text"
                value={newFeature.sourceDetail || ''}
                onChange={(e) => setNewFeature({ ...newFeature, sourceDetail: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g., Fighter Level 2, Hill Dwarf, +1 Sword"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category (Optional)
            </label>
            <input
              type="text"
              value={newFeature.category || ''}
              onChange={(e) => setNewFeature({ ...newFeature, category: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g., Combat, Utility, Social"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={newFeature.description || ''}
              onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Describe what this feature does, how it works, and any important details..."
            />
          </div>
        </div>

        {/* Usage Configuration */}
        <div className="rounded-lg border border-gray-200 p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Usage Configuration
          </h4>

          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newFeature.isPassive || false}
                onChange={(e) => setNewFeature({ ...newFeature, isPassive: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm">
                Passive ability (always active, no usage tracking)
              </span>
            </label>

            {!newFeature.isPassive && (
              <div className="space-y-3 pl-6 border-l-2 border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Uses
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newFeature.maxUses}
                      onChange={(e) => setNewFeature({ ...newFeature, maxUses: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Set to 0 for unlimited uses
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Recharges On
                    </label>
                    <select
                      value={newFeature.restType}
                      onChange={(e) => setNewFeature({ ...newFeature, restType: e.target.value as 'short' | 'long' })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="short">Short Rest</option>
                      <option value="long">Long Rest</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={newFeature.scaleWithProficiency || false}
                      onChange={(e) => setNewFeature({ ...newFeature, scaleWithProficiency: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">
                      Scale uses with proficiency bonus
                    </span>
                  </label>

                  {newFeature.scaleWithProficiency && (
                    <div className="pl-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Proficiency Multiplier
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={newFeature.proficiencyMultiplier || 1}
                        onChange={(e) => setNewFeature({ 
                          ...newFeature, 
                          proficiencyMultiplier: parseFloat(e.target.value) || 1 
                        })}
                        className="w-32 rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Maximum uses = base uses + (proficiency × multiplier)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!newFeature.name.trim()}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Add Feature
          </button>
        </div>
      </form>
    </Modal>
  );
}
