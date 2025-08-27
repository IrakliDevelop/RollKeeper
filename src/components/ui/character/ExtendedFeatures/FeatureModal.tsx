'use client';

import React, { useState, useEffect } from 'react';
import { ExtendedFeature, FeatureSourceType, FEATURE_SOURCE_LABELS } from '@/types/character';
import { calculateTraitMaxUses } from '@/utils/calculations';
import { 
  Edit3, 
  Save, 
  Trash2, 
  Zap,
  Clock,
  Settings,
  AlertTriangle
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
      proficiencyMultiplier: editData.scaleWithProficiency ? (editData.proficiencyMultiplier || 1) : undefined,
    });
    setMode('view');
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
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-100 px-2 py-1 text-sm font-medium text-indigo-800">
              {FEATURE_SOURCE_LABELS[feature.sourceType]}
            </span>
            {feature.sourceDetail && (
              <span className="text-sm text-gray-500">
                {feature.sourceDetail}
              </span>
            )}
          </div>

          {!readonly && mode === 'view' && (
            <div className="flex gap-2">
              {hasUses && !isExhausted && (
                <button
                  onClick={onUse}
                  className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <Zap className="h-4 w-4" />
                  Use
                </button>
              )}
              <button
                onClick={() => setMode('edit')}
                className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Edit3 className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}

          {mode === 'edit' && (
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="rounded bg-gray-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!editData.name?.trim()}
                className="flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {mode === 'view' ? (
          <div className="space-y-4">
            {/* Usage Info */}
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Usage</h4>
                  {feature.isPassive ? (
                    <p className="text-sm text-blue-600">Passive ability</p>
                  ) : hasUses ? (
                    <p className="text-sm text-gray-600">
                      {usesRemaining} of {maxUses} uses remaining
                    </p>
                  ) : (
                    <p className="text-sm text-green-600">Unlimited uses</p>
                  )}
                </div>
                {hasUses && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span className="capitalize">{feature.restType} rest</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {feature.description && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                <div className="prose prose-sm max-w-none text-gray-700">
                  {feature.description.split('\n').map((paragraph, index) => (
                    <p key={index} className="mb-2 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {feature.scaleWithProficiency && (
                <div>
                  <span className="font-medium text-gray-700">Scaling:</span>
                  <span className="ml-2 text-gray-600">
                    Proficiency x{feature.proficiencyMultiplier || 1}
                  </span>
                </div>
              )}
              {feature.category && (
                <div>
                  <span className="font-medium text-gray-700">Category:</span>
                  <span className="ml-2 text-gray-600">{feature.category}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Edit Form */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feature Name *
              </label>
              <input
                type="text"
                value={editData.name || ''}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g., Action Surge, Darkvision, Lucky"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source Type
                </label>
                <select
                  value={editData.sourceType || feature.sourceType}
                  onChange={(e) => setEditData({ ...editData, sourceType: e.target.value as FeatureSourceType })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                  value={editData.sourceDetail || ''}
                  onChange={(e) => setEditData({ ...editData, sourceDetail: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g., Fighter Level 2, Hill Dwarf"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={editData.description || ''}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="Describe what this feature does..."
              />
            </div>

            {/* Usage Configuration */}
            <div className="rounded-lg border border-gray-200 p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Usage Configuration
              </h4>

              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editData.isPassive || false}
                    onChange={(e) => setEditData({ ...editData, isPassive: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Passive ability (no usage tracking)</span>
                </label>

                {!editData.isPassive && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Uses
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editData.maxUses || 0}
                        onChange={(e) => setEditData({ ...editData, maxUses: parseInt(e.target.value) || 0 })}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rest Type
                      </label>
                      <select
                        value={editData.restType || 'long'}
                        onChange={(e) => setEditData({ ...editData, restType: e.target.value as 'short' | 'long' })}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="short">Short Rest</option>
                        <option value="long">Long Rest</option>
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center gap-1 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={editData.scaleWithProficiency || false}
                          onChange={(e) => setEditData({ ...editData, scaleWithProficiency: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        Scale with proficiency
                      </label>
                      {editData.scaleWithProficiency && (
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={editData.proficiencyMultiplier || 1}
                          onChange={(e) => setEditData({ ...editData, proficiencyMultiplier: parseFloat(e.target.value) || 1 })}
                          className="w-full mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
                          placeholder="Multiplier"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-red-900 mb-1">
                  Delete this feature?
                </h4>
                <p className="text-sm text-red-700 mb-3">
                  This action cannot be undone. The feature will be permanently removed.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded bg-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-400"
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
