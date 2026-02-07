'use client';

import React, { useState } from 'react';
import {
  ExtendedFeature,
  FeatureSourceType,
  FEATURE_SOURCE_LABELS,
  createDefaultExtendedFeature,
} from '@/types/character';
import { Plus, Settings } from 'lucide-react';
import { Modal } from '@/components/ui/feedback';

interface AddFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (
    feature: Omit<ExtendedFeature, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  existingFeatures: ExtendedFeature[];
}

export default function AddFeatureModal({
  isOpen,
  onClose,
  onAdd,
  existingFeatures,
}: AddFeatureModalProps) {
  const [newFeature, setNewFeature] = useState(() =>
    createDefaultExtendedFeature()
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newFeature.name.trim()) return;

    // Calculate display order for the new feature
    const featuresOfSameType = existingFeatures.filter(
      f => f.sourceType === newFeature.sourceType
    );
    const maxOrder =
      featuresOfSameType.length > 0
        ? Math.max(...featuresOfSameType.map(f => f.displayOrder))
        : -1;

    onAdd({
      ...newFeature,
      name: newFeature.name.trim(),
      description: newFeature.description?.trim() || undefined,
      sourceDetail: newFeature.sourceDetail?.trim() || undefined,
      category: newFeature.category?.trim() || undefined,
      displayOrder: maxOrder + 1,
      proficiencyMultiplier: newFeature.scaleWithProficiency
        ? newFeature.proficiencyMultiplier
        : undefined,
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
            <label className="text-body mb-1 block text-sm font-medium">
              Feature Name *
            </label>
            <input
              type="text"
              value={newFeature.name}
              onChange={e =>
                setNewFeature({ ...newFeature, name: e.target.value })
              }
              className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-border-strong w-full rounded-lg border px-3 py-2 focus:ring-1"
              placeholder="e.g., Action Surge, Darkvision, Lucky"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-body mb-1 block text-sm font-medium">
                Source Type *
              </label>
              <select
                value={newFeature.sourceType}
                onChange={e =>
                  setNewFeature({
                    ...newFeature,
                    sourceType: e.target.value as FeatureSourceType,
                  })
                }
                className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-border-strong w-full rounded-lg border px-3 py-2 focus:ring-1"
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
              <label className="text-body mb-1 block text-sm font-medium">
                Source Detail
              </label>
              <input
                type="text"
                value={newFeature.sourceDetail || ''}
                onChange={e =>
                  setNewFeature({ ...newFeature, sourceDetail: e.target.value })
                }
                className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-border-strong w-full rounded-lg border px-3 py-2 focus:ring-1"
                placeholder="e.g., Fighter Level 2, Hill Dwarf, +1 Sword"
              />
            </div>
          </div>

          <div>
            <label className="text-body mb-1 block text-sm font-medium">
              Category (Optional)
            </label>
            <input
              type="text"
              value={newFeature.category || ''}
              onChange={e =>
                setNewFeature({ ...newFeature, category: e.target.value })
              }
              className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-border-strong w-full rounded-lg border px-3 py-2 focus:ring-1"
              placeholder="e.g., Combat, Utility, Social"
            />
          </div>

          <div>
            <label className="text-body mb-1 block text-sm font-medium">
              Description
            </label>
            <textarea
              value={newFeature.description || ''}
              onChange={e =>
                setNewFeature({ ...newFeature, description: e.target.value })
              }
              rows={3}
              className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-border-strong w-full rounded-lg border px-3 py-2 focus:ring-1"
              placeholder="Describe what this feature does, how it works, and any important details..."
            />
          </div>
        </div>

        {/* Usage Configuration */}
        <div className="border-divider rounded-lg border p-4">
          <h4 className="text-heading mb-3 flex items-center gap-2 font-medium">
            <Settings className="h-4 w-4" />
            Usage Configuration
          </h4>

          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newFeature.isPassive || false}
                onChange={e =>
                  setNewFeature({ ...newFeature, isPassive: e.target.checked })
                }
                className="border-divider-strong rounded"
              />
              <span className="text-body text-sm">
                Passive ability (always active, no usage tracking)
              </span>
            </label>

            {!newFeature.isPassive && (
              <div className="border-divider space-y-3 border-l-2 pl-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-body mb-1 block text-sm font-medium">
                      Maximum Uses
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newFeature.maxUses}
                      onChange={e =>
                        setNewFeature({
                          ...newFeature,
                          maxUses: parseInt(e.target.value) || 0,
                        })
                      }
                      className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-border-strong w-full rounded-lg border px-3 py-2 focus:ring-1"
                    />
                    <p className="text-muted mt-1 text-xs">
                      Set to 0 for unlimited uses
                    </p>
                  </div>

                  <div>
                    <label className="text-body mb-1 block text-sm font-medium">
                      Recharges On
                    </label>
                    <select
                      value={newFeature.restType}
                      onChange={e =>
                        setNewFeature({
                          ...newFeature,
                          restType: e.target.value as 'short' | 'long',
                        })
                      }
                      className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-border-strong w-full rounded-lg border px-3 py-2 focus:ring-1"
                    >
                      <option value="short">Short Rest</option>
                      <option value="long">Long Rest</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newFeature.scaleWithProficiency || false}
                      onChange={e =>
                        setNewFeature({
                          ...newFeature,
                          scaleWithProficiency: e.target.checked,
                        })
                      }
                      className="border-divider-strong rounded"
                    />
                    <span className="text-body text-sm">
                      Scale uses with proficiency bonus
                    </span>
                  </label>

                  {newFeature.scaleWithProficiency && (
                    <div className="pl-6">
                      <label className="text-body mb-1 block text-sm font-medium">
                        Proficiency Multiplier
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={newFeature.proficiencyMultiplier || 1}
                        onChange={e =>
                          setNewFeature({
                            ...newFeature,
                            proficiencyMultiplier:
                              parseFloat(e.target.value) || 1,
                          })
                        }
                        className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-border-strong w-32 rounded-lg border px-3 py-2 focus:ring-1"
                      />
                      <p className="text-muted mt-1 text-xs">
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
        <div className="border-divider flex justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={handleCancel}
            className="border-divider-strong bg-surface-raised text-body hover:bg-surface-hover rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!newFeature.name.trim()}
            className="bg-accent-indigo-text text-inverse hover:bg-accent-indigo-text-muted flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add Feature
          </button>
        </div>
      </form>
    </Modal>
  );
}
