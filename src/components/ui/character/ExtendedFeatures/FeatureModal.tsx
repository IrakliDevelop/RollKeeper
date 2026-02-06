'use client';

import React, { useState, useEffect } from 'react';
import {
  ExtendedFeature,
  FeatureSourceType,
  FEATURE_SOURCE_LABELS,
} from '@/types/character';
import { calculateTraitMaxUses } from '@/utils/calculations';
import {
  Edit3,
  Save,
  Trash2,
  Zap,
  Clock,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '@/components/ui/feedback';

interface FeatureModalProps {
  feature: ExtendedFeature;
  isOpen: boolean;
  mode: 'view' | 'edit';
  characterLevel: number;
  onClose: () => void;
  onUpdate: (updates: Partial<ExtendedFeature>) => void;
  onDelete: () => void;
  onUse: () => void;
  readonly?: boolean;
}

export default function FeatureModal({
  feature,
  isOpen,
  mode: initialMode,
  characterLevel,
  onClose,
  onUpdate,
  onDelete,
  onUse,
  readonly = false,
}: FeatureModalProps) {
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [editData, setEditData] = useState<Partial<ExtendedFeature>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const maxUses = calculateTraitMaxUses(feature, characterLevel);
  const usesRemaining = maxUses - feature.usedUses;
  const isExhausted = !feature.isPassive && usesRemaining <= 0;
  const hasUses = !feature.isPassive && maxUses > 0;

  // Reset edit data when modal opens or feature changes
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setEditData({
        name: feature.name,
        description: feature.description || '',
        sourceType: feature.sourceType,
        sourceDetail: feature.sourceDetail || '',
        category: feature.category || '',
        maxUses: feature.maxUses,
        restType: feature.restType,
        isPassive: feature.isPassive || false,
        scaleWithProficiency: feature.scaleWithProficiency || false,
        proficiencyMultiplier: feature.proficiencyMultiplier || 1,
      });
      setShowDeleteConfirm(false);
    }
  }, [feature, isOpen, initialMode]);

  const handleSave = () => {
    if (!editData.name?.trim()) return;

    onUpdate({
      name: editData.name.trim(),
      description: editData.description?.trim() || undefined,
      sourceType: editData.sourceType || feature.sourceType,
      sourceDetail: editData.sourceDetail?.trim() || undefined,
      category: editData.category?.trim() || undefined,
      maxUses: editData.maxUses || 0,
      restType: editData.restType || 'long',
      isPassive: editData.isPassive || false,
      scaleWithProficiency: editData.scaleWithProficiency || false,
      proficiencyMultiplier: editData.scaleWithProficiency
        ? editData.proficiencyMultiplier || 1
        : undefined,
    });
    setMode('view');
    onClose();
  };

  const handleCancel = () => {
    setMode('view');
    setEditData({
      name: feature.name,
      description: feature.description || '',
      sourceType: feature.sourceType,
      sourceDetail: feature.sourceDetail || '',
      category: feature.category || '',
      maxUses: feature.maxUses,
      restType: feature.restType,
      isPassive: feature.isPassive || false,
      scaleWithProficiency: feature.scaleWithProficiency || false,
      proficiencyMultiplier: feature.proficiencyMultiplier || 1,
    });
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Feature' : feature.name}
      size="lg"
    >
      <div className="space-y-8">
        {/* Header Actions */}
        <div className="border-divider mb-2 flex items-center justify-between border-b pb-8">
          <div className="flex items-center gap-3">
            <span className="bg-accent-indigo-bg-strong text-accent-indigo-text rounded-lg px-3 py-1.5 text-sm font-semibold">
              {FEATURE_SOURCE_LABELS[feature.sourceType]}
            </span>
            {feature.sourceDetail && (
              <span className="bg-surface-inset text-muted rounded px-2 py-1 text-sm font-medium">
                {feature.sourceDetail}
              </span>
            )}
          </div>

          {!readonly && mode === 'view' && (
            <div className="flex gap-3">
              {hasUses && !isExhausted && (
                <button
                  onClick={onUse}
                  className="bg-accent-indigo-text text-inverse hover:bg-accent-indigo-text-muted focus:ring-accent-indigo-border-strong flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
                >
                  <Zap className="h-4 w-4" />
                  Use Feature
                </button>
              )}
              <button
                onClick={() => setMode('edit')}
                className="bg-accent-blue-text text-inverse hover:bg-accent-blue-text-muted focus:ring-accent-blue-border-strong flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
              >
                <Edit3 className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-accent-red-text text-inverse hover:bg-accent-red-text-muted focus:ring-accent-red-border-strong flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}

          {mode === 'edit' && (
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="border-divider-strong bg-surface-raised text-body hover:bg-surface-hover focus:ring-border-secondary rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!editData.name?.trim()}
                className="bg-accent-green-text text-inverse hover:bg-accent-green-text-muted focus:ring-accent-green-border-strong flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {mode === 'view' ? (
          <div className="mt-4 space-y-8">
            {/* Usage Info */}
            <div className="border-accent-blue-border from-accent-blue-bg to-accent-indigo-bg rounded-xl border bg-gradient-to-br p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-heading mb-2 text-lg font-semibold">
                    Usage Information
                  </h4>
                  {feature.isPassive ? (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      <p className="text-accent-blue-text-muted text-sm font-medium">
                        Passive ability - always active
                      </p>
                    </div>
                  ) : hasUses ? (
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${isExhausted ? 'bg-red-500' : usesRemaining <= 1 ? 'bg-orange-500' : 'bg-green-500'}`}
                      ></div>
                      <p className="text-body text-sm font-medium">
                        <span
                          className={`${isExhausted ? 'text-accent-red-text-muted' : usesRemaining <= 1 ? 'text-accent-orange-text-muted' : 'text-accent-green-text-muted'}`}
                        >
                          {usesRemaining}
                        </span>{' '}
                        of {maxUses} uses remaining
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <p className="text-accent-green-text-muted text-sm font-medium">
                        Unlimited uses
                      </p>
                    </div>
                  )}
                </div>
                {hasUses && (
                  <div className="border-divider bg-surface-raised text-muted flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
                    <Clock className="h-4 w-4" />
                    <span className="capitalize">{feature.restType} rest</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {feature.description && (
              <div className="border-divider bg-surface-raised rounded-lg border p-6">
                <h4 className="text-heading mb-4 text-lg font-semibold">
                  Description
                </h4>
                <div
                  className="prose prose-sm text-body max-w-none leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: feature.description }}
                />
              </div>
            )}

            {/* Additional Info */}
            {(feature.scaleWithProficiency || feature.category) && (
              <div className="border-divider bg-surface-inset rounded-lg border p-6">
                <h4 className="text-heading mb-4 text-lg font-semibold">
                  Additional Details
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {feature.scaleWithProficiency && (
                    <div className="border-divider bg-surface-raised flex items-center gap-3 rounded-lg border p-3">
                      <div className="bg-accent-purple-text-muted h-2 w-2 flex-shrink-0 rounded-full"></div>
                      <div>
                        <span className="text-body text-sm font-medium">
                          Scaling:
                        </span>
                        <span className="text-muted ml-2 text-sm">
                          Proficiency × {feature.proficiencyMultiplier || 1}
                        </span>
                      </div>
                    </div>
                  )}
                  {feature.category && (
                    <div className="border-divider bg-surface-raised flex items-center gap-3 rounded-lg border p-3">
                      <div className="bg-accent-green-text-muted h-2 w-2 flex-shrink-0 rounded-full"></div>
                      <div>
                        <span className="text-body text-sm font-medium">
                          Category:
                        </span>
                        <span className="text-muted ml-2 text-sm">
                          {feature.category}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-8">
            {/* Edit Form */}
            <div className="border-divider bg-surface-raised rounded-lg border p-6">
              <h4 className="text-heading mb-6 text-lg font-semibold">
                Basic Information
              </h4>

              <div className="space-y-4">
                <div>
                  <label className="text-body mb-2 block text-sm font-semibold">
                    Feature Name *
                  </label>
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={e =>
                      setEditData({ ...editData, name: e.target.value })
                    }
                    className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-bg w-full rounded-lg border px-4 py-3 text-sm transition-colors focus:ring-2"
                    placeholder="e.g., Action Surge, Darkvision, Lucky"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-body mb-2 block text-sm font-semibold">
                      Source Type
                    </label>
                    <select
                      value={editData.sourceType || feature.sourceType}
                      onChange={e =>
                        setEditData({
                          ...editData,
                          sourceType: e.target.value as FeatureSourceType,
                        })
                      }
                      className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-bg w-full rounded-lg border px-4 py-3 text-sm transition-colors focus:ring-2"
                    >
                      {Object.entries(FEATURE_SOURCE_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-body mb-2 block text-sm font-semibold">
                      Source Detail
                    </label>
                    <input
                      type="text"
                      value={editData.sourceDetail || ''}
                      onChange={e =>
                        setEditData({
                          ...editData,
                          sourceDetail: e.target.value,
                        })
                      }
                      className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-bg w-full rounded-lg border px-4 py-3 text-sm transition-colors focus:ring-2"
                      placeholder="e.g., Fighter Level 2, Hill Dwarf"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-body mb-2 block text-sm font-semibold">
                    Description
                  </label>
                  <textarea
                    value={editData.description || ''}
                    onChange={e =>
                      setEditData({ ...editData, description: e.target.value })
                    }
                    rows={4}
                    className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-bg w-full resize-none rounded-lg border px-4 py-3 text-sm transition-colors focus:ring-2"
                    placeholder="Describe what this feature does, how it works, and any important details..."
                  />
                </div>
              </div>
            </div>

            {/* Usage Configuration */}
            <div className="border-divider bg-surface-inset rounded-lg border p-6">
              <h4 className="text-heading mb-6 flex items-center gap-2 text-lg font-semibold">
                <Settings className="text-muted h-5 w-5" />
                Usage Configuration
              </h4>

              <div className="space-y-6">
                <label className="border-divider bg-surface-raised hover:bg-surface-hover flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors">
                  <input
                    type="checkbox"
                    checked={editData.isPassive || false}
                    onChange={e =>
                      setEditData({ ...editData, isPassive: e.target.checked })
                    }
                    className="border-divider-strong focus:ring-accent-indigo-border-strong mt-0.5 rounded"
                  />
                  <div>
                    <span className="text-heading text-sm font-medium">
                      Passive ability
                    </span>
                    <p className="text-muted mt-1 text-xs">
                      This feature is always active and doesn&apos;t require
                      usage tracking
                    </p>
                  </div>
                </label>

                {!editData.isPassive && (
                  <div className="border-divider bg-surface-raised rounded-lg border p-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-body mb-2 block text-sm font-semibold">
                            Maximum Uses
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={editData.maxUses || 0}
                            onChange={e =>
                              setEditData({
                                ...editData,
                                maxUses: parseInt(e.target.value) || 0,
                              })
                            }
                            className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-bg w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2"
                          />
                          <p className="text-muted mt-1 text-xs">
                            Set to 0 for unlimited uses
                          </p>
                        </div>

                        <div>
                          <label className="text-body mb-2 block text-sm font-semibold">
                            Recharges On
                          </label>
                          <select
                            value={editData.restType || 'long'}
                            onChange={e =>
                              setEditData({
                                ...editData,
                                restType: e.target.value as 'short' | 'long',
                              })
                            }
                            className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-bg w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2"
                          >
                            <option value="short">Short Rest</option>
                            <option value="long">Long Rest</option>
                          </select>
                        </div>
                      </div>

                      <div className="border-divider border-t pt-4">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={editData.scaleWithProficiency || false}
                            onChange={e =>
                              setEditData({
                                ...editData,
                                scaleWithProficiency: e.target.checked,
                              })
                            }
                            className="border-divider-strong focus:ring-accent-indigo-border-strong mt-0.5 rounded"
                          />
                          <div className="flex-1">
                            <span className="text-heading text-sm font-medium">
                              Scale with proficiency bonus
                            </span>
                            <p className="text-muted mt-1 text-xs">
                              Maximum uses increase with character level
                            </p>
                          </div>
                        </label>

                        {editData.scaleWithProficiency && (
                          <div className="mt-3 ml-6">
                            <label className="text-body mb-2 block text-sm font-semibold">
                              Proficiency Multiplier
                            </label>
                            <input
                              type="number"
                              min="0.5"
                              step="0.5"
                              value={editData.proficiencyMultiplier || 1}
                              onChange={e =>
                                setEditData({
                                  ...editData,
                                  proficiencyMultiplier:
                                    parseFloat(e.target.value) || 1,
                                })
                              }
                              className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-bg w-32 rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2"
                              placeholder="1.0"
                            />
                            <p className="text-muted mt-1 text-xs">
                              Max uses = base uses + (proficiency × multiplier)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="border-accent-red-border bg-accent-red-bg rounded-lg border-2 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="text-accent-red-text-muted h-6 w-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-heading mb-2 text-lg font-semibold">
                  Delete this feature?
                </h4>
                <p className="text-body mb-4 text-sm">
                  This action cannot be undone. The feature &quot;{feature.name}
                  &quot; will be permanently removed from both the extended
                  features and special traits sections.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDelete}
                    className="bg-accent-red-text text-inverse hover:bg-accent-red-text-muted focus:ring-accent-red-border-strong flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Feature
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="border-divider-strong bg-surface-raised text-body hover:bg-surface-hover focus:ring-border-secondary rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
