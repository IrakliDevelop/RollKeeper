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
        <div className="mb-2 flex items-center justify-between border-b border-gray-200 pb-8">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-indigo-100 px-3 py-1.5 text-sm font-semibold text-indigo-800">
              {FEATURE_SOURCE_LABELS[feature.sourceType]}
            </span>
            {feature.sourceDetail && (
              <span className="rounded bg-gray-100 px-2 py-1 text-sm font-medium text-gray-600">
                {feature.sourceDetail}
              </span>
            )}
          </div>

          {!readonly && mode === 'view' && (
            <div className="flex gap-3">
              {hasUses && !isExhausted && (
                <button
                  onClick={onUse}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
                >
                  <Zap className="h-4 w-4" />
                  Use Feature
                </button>
              )}
              <button
                onClick={() => setMode('edit')}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
              >
                <Edit3 className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
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
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!editData.name?.trim()}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="mb-2 text-lg font-semibold text-gray-900">
                    Usage Information
                  </h4>
                  {feature.isPassive ? (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      <p className="text-sm font-medium text-blue-700">
                        Passive ability - always active
                      </p>
                    </div>
                  ) : hasUses ? (
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${isExhausted ? 'bg-red-500' : usesRemaining <= 1 ? 'bg-orange-500' : 'bg-green-500'}`}
                      ></div>
                      <p className="text-sm font-medium text-gray-700">
                        <span
                          className={`${isExhausted ? 'text-red-600' : usesRemaining <= 1 ? 'text-orange-600' : 'text-green-600'}`}
                        >
                          {usesRemaining}
                        </span>{' '}
                        of {maxUses} uses remaining
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <p className="text-sm font-medium text-green-700">
                        Unlimited uses
                      </p>
                    </div>
                  )}
                </div>
                {hasUses && (
                  <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span className="capitalize">{feature.restType} rest</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {feature.description && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h4 className="mb-4 text-lg font-semibold text-gray-900">
                  Description
                </h4>
                <div
                  className="prose prose-sm max-w-none leading-relaxed text-gray-700"
                  dangerouslySetInnerHTML={{ __html: feature.description }}
                />
              </div>
            )}

            {/* Additional Info */}
            {(feature.scaleWithProficiency || feature.category) && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
                <h4 className="mb-4 text-lg font-semibold text-gray-900">
                  Additional Details
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {feature.scaleWithProficiency && (
                    <div className="flex items-center gap-3 rounded-lg border bg-white p-3">
                      <div className="h-2 w-2 flex-shrink-0 rounded-full bg-purple-500"></div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          Scaling:
                        </span>
                        <span className="ml-2 text-sm text-gray-600">
                          Proficiency × {feature.proficiencyMultiplier || 1}
                        </span>
                      </div>
                    </div>
                  )}
                  {feature.category && (
                    <div className="flex items-center gap-3 rounded-lg border bg-white p-3">
                      <div className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500"></div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          Category:
                        </span>
                        <span className="ml-2 text-sm text-gray-600">
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
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h4 className="mb-6 text-lg font-semibold text-gray-900">
                Basic Information
              </h4>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Feature Name *
                  </label>
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={e =>
                      setEditData({ ...editData, name: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    placeholder="e.g., Action Surge, Darkvision, Lucky"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
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
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
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
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
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
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      placeholder="e.g., Fighter Level 2, Hill Dwarf"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={editData.description || ''}
                    onChange={e =>
                      setEditData({ ...editData, description: e.target.value })
                    }
                    rows={4}
                    className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 text-sm transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    placeholder="Describe what this feature does, how it works, and any important details..."
                  />
                </div>
              </div>
            </div>

            {/* Usage Configuration */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
              <h4 className="mb-6 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Settings className="h-5 w-5 text-gray-600" />
                Usage Configuration
              </h4>

              <div className="space-y-6">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={editData.isPassive || false}
                    onChange={e =>
                      setEditData({ ...editData, isPassive: e.target.checked })
                    }
                    className="mt-0.5 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      Passive ability
                    </span>
                    <p className="mt-1 text-xs text-gray-600">
                      This feature is always active and doesn&apos;t require
                      usage tracking
                    </p>
                  </div>
                </label>

                {!editData.isPassive && (
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-gray-700">
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
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Set to 0 for unlimited uses
                          </p>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold text-gray-700">
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
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                          >
                            <option value="short">Short Rest</option>
                            <option value="long">Long Rest</option>
                          </select>
                        </div>
                      </div>

                      <div className="border-t border-gray-200 pt-4">
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
                            className="mt-0.5 rounded border-gray-300 focus:ring-indigo-500"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900">
                              Scale with proficiency bonus
                            </span>
                            <p className="mt-1 text-xs text-gray-600">
                              Maximum uses increase with character level
                            </p>
                          </div>
                        </label>

                        {editData.scaleWithProficiency && (
                          <div className="mt-3 ml-6">
                            <label className="mb-2 block text-sm font-semibold text-gray-700">
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
                              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                              placeholder="1.0"
                            />
                            <p className="mt-1 text-xs text-gray-500">
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
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h4 className="mb-2 text-lg font-semibold text-red-900">
                  Delete this feature?
                </h4>
                <p className="mb-4 text-sm text-red-700">
                  This action cannot be undone. The feature &quot;{feature.name}
                  &quot; will be permanently removed from both the extended
                  features and special traits sections.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Feature
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
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
