/**
 * UnifiedFeatureModal Component
 * Handles both adding and editing features with WYSIWYG editor and autocomplete
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ExtendedFeature,
  FeatureSourceType,
  FEATURE_SOURCE_LABELS,
  createDefaultExtendedFeature,
  CharacterState,
} from '@/types/character';
import { calculateTraitMaxUses } from '@/utils/calculations';
import { FeatureAutocompleteItem, FeatureSourceFilter } from '@/types/features';
import {
  convertBackgroundFeatureToExtendedFeature,
  convertFeatToExtendedFeature,
  convertClassFeatureToExtendedFeature,
  partialFeatureToFormData,
  FeatureFormData,
} from '@/utils/featureConversion';
import { useFeatureSourcesData } from '@/hooks/useFeatureSourcesData';
import { FeatureAutocomplete } from '@/components/ui/forms/FeatureAutocomplete';
import RichTextEditor from '@/components/ui/forms/RichTextEditor';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Modal } from '@/components/ui/feedback';
import {
  Plus,
  Save,
  Trash2,
  Zap,
  Clock,
  Settings,
  AlertTriangle,
  Edit3,
  Filter,
} from 'lucide-react';

interface UnifiedFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    feature: Omit<ExtendedFeature, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onDelete?: () => void;
  onUse?: () => void;
  existingFeatures: ExtendedFeature[];
  feature?: ExtendedFeature; // If provided, opens in edit mode
  character: CharacterState;
  readonly?: boolean;
}

export default function UnifiedFeatureModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  onUse,
  existingFeatures,
  feature: existingFeature,
  character,
  readonly = false,
}: UnifiedFeatureModalProps) {
  const isEditMode = !!existingFeature;
  const [mode, setMode] = useState<'view' | 'edit'>(
    isEditMode && !readonly ? 'view' : 'edit'
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load feature sources data
  const {
    allFeatures,
    loading: featuresLoading,
    filterBySourceType,
    filterByClass,
    filterBySubclass,
  } = useFeatureSourcesData(character);

  // Form state
  const [formData, setFormData] = useState<FeatureFormData>(() =>
    existingFeature
      ? partialFeatureToFormData(existingFeature)
      : partialFeatureToFormData(createDefaultExtendedFeature())
  );

  // Filter states for advanced search
  const [sourceFilter, setSourceFilter] = useState<FeatureSourceFilter>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [subclassFilter, setSubclassFilter] = useState<string>('all');

  // Get filtered features based on dropdowns
  const filteredFeatures = useMemo(() => {
    let features = allFeatures;

    // Apply source type filter
    if (sourceFilter !== 'all') {
      features = filterBySourceType(sourceFilter);
    }

    // Apply class filter
    if (sourceFilter === 'class' && classFilter && classFilter !== 'all') {
      features = filterByClass(classFilter);
    }

    // Apply subclass filter
    if (sourceFilter === 'subclass' && classFilter && classFilter !== 'all') {
      features = filterBySubclass(
        classFilter,
        subclassFilter !== 'all' ? subclassFilter : ''
      );
    }

    return features;
  }, [
    allFeatures,
    sourceFilter,
    classFilter,
    subclassFilter,
    filterBySourceType,
    filterByClass,
    filterBySubclass,
  ]);

  // Get unique class names for dropdown
  const availableClasses = useMemo(() => {
    const classNames = new Set<string>();
    allFeatures.forEach(f => {
      if (f.metadata.className) {
        classNames.add(f.metadata.className);
      }
    });
    return Array.from(classNames).sort();
  }, [allFeatures]);

  // Get unique subclass names for selected class
  const availableSubclasses = useMemo(() => {
    if (!classFilter || classFilter === 'all') return [];
    const subclassNames = new Set<string>();
    allFeatures.forEach(f => {
      if (
        f.metadata.className?.toLowerCase() === classFilter.toLowerCase() &&
        f.metadata.subclassShortName
      ) {
        subclassNames.add(f.metadata.subclassShortName);
      }
    });
    return Array.from(subclassNames).sort();
  }, [allFeatures, classFilter]);

  // Reset form when modal opens/closes or feature changes
  useEffect(() => {
    if (isOpen) {
      if (existingFeature) {
        setFormData(partialFeatureToFormData(existingFeature));
        setMode(readonly ? 'view' : 'view');
      } else {
        setFormData(partialFeatureToFormData(createDefaultExtendedFeature()));
        setMode('edit');
      }
      setShowDeleteConfirm(false);
      setSourceFilter('all');
      setClassFilter('all');
      setSubclassFilter('all');
    }
  }, [isOpen, existingFeature, readonly]);

  // Handle autocomplete selection
  const handleFeatureSelect = (selectedFeature: FeatureAutocompleteItem) => {
    let partialFeature: Partial<ExtendedFeature>;

    // Convert based on source type
    if (
      selectedFeature.sourceType === 'background' &&
      selectedFeature.metadata.backgroundName
    ) {
      // It's a background feature - cast the metadata
      partialFeature = convertBackgroundFeatureToExtendedFeature({
        id: selectedFeature.id,
        name: selectedFeature.name,
        source: selectedFeature.source,
        description: selectedFeature.description,
        backgroundName: selectedFeature.metadata.backgroundName,
        skills: selectedFeature.metadata.skills || [],
        isSrd: false,
      });
    } else if (
      selectedFeature.sourceType === 'feat' &&
      selectedFeature.metadata.prerequisites
    ) {
      // It's a feat - cast the metadata
      partialFeature = convertFeatToExtendedFeature({
        id: selectedFeature.id,
        name: selectedFeature.name,
        source: selectedFeature.source,
        description: selectedFeature.description,
        prerequisites: selectedFeature.metadata.prerequisites,
        abilityIncreases: selectedFeature.metadata.abilityIncreases || '',
        repeatable: selectedFeature.metadata.repeatable || false,
        grantsSpells: false,
        isSrd: false,
        tags: selectedFeature.tags,
      });
    } else {
      // Class or subclass feature - cast the metadata
      partialFeature = convertClassFeatureToExtendedFeature({
        name: selectedFeature.name,
        level: selectedFeature.metadata.level || 1,
        className: selectedFeature.metadata.className || '',
        source: selectedFeature.source,
        isSubclassFeature: selectedFeature.metadata.isSubclassFeature || false,
        subclassShortName: selectedFeature.metadata.subclassShortName,
        entries: [selectedFeature.description],
        original: selectedFeature.name, // Required by ClassFeature interface
      });
    }

    // Update form with converted data
    setFormData(partialFeatureToFormData(partialFeature));
  };

  // Handle save
  const handleSave = () => {
    if (!formData.name.trim()) return;

    // Calculate display order for new features
    let displayOrder = 0;
    if (!isEditMode) {
      const featuresOfSameType = existingFeatures.filter(
        f => f.sourceType === formData.sourceType
      );
      const maxOrder =
        featuresOfSameType.length > 0
          ? Math.max(...featuresOfSameType.map(f => f.displayOrder))
          : -1;
      displayOrder = maxOrder + 1;
    } else {
      displayOrder = existingFeature.displayOrder;
    }

    onSave({
      ...formData,
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
      sourceDetail: formData.sourceDetail?.trim() || undefined,
      category: formData.category?.trim() || undefined,
      displayOrder,
      usedUses: existingFeature?.usedUses || 0, // Preserve existing or default to 0
      proficiencyMultiplier: formData.scaleWithProficiency
        ? formData.proficiencyMultiplier
        : undefined,
    });

    onClose();
  };

  // Handle delete
  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (isEditMode) {
      setMode('view');
      if (existingFeature) {
        setFormData(partialFeatureToFormData(existingFeature));
      }
    } else {
      onClose();
    }
  };

  // Calculate usage info for view mode
  const maxUses = existingFeature
    ? calculateTraitMaxUses(existingFeature, character.level)
    : 0;
  const usesRemaining = existingFeature
    ? maxUses - existingFeature.usedUses
    : 0;
  const isExhausted =
    existingFeature && !existingFeature.isPassive && usesRemaining <= 0;
  const hasUses = existingFeature && !existingFeature.isPassive && maxUses > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'view'
          ? existingFeature?.name || 'Feature Details'
          : isEditMode
            ? 'Edit Feature'
            : 'Add New Feature'
      }
      size="xl"
    >
      <div className="space-y-6">
        {/* View Mode - Header with Actions */}
        {isEditMode && mode === 'view' && (
          <div className="flex items-center justify-between border-b border-gray-200 pb-4">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-indigo-100 px-3 py-1.5 text-sm font-semibold text-indigo-800">
                {FEATURE_SOURCE_LABELS[existingFeature!.sourceType]}
              </span>
              {existingFeature!.sourceDetail && (
                <span className="rounded bg-gray-100 px-2 py-1 text-sm font-medium text-gray-600">
                  {existingFeature!.sourceDetail}
                </span>
              )}
            </div>

            {!readonly && (
              <div className="flex gap-3">
                {hasUses && !isExhausted && onUse && (
                  <button
                    onClick={onUse}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
                  >
                    <Zap className="h-4 w-4" />
                    Use Feature
                  </button>
                )}
                <button
                  onClick={() => setMode('edit')}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
                {onDelete && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* View Mode - Content */}
        {isEditMode && mode === 'view' && existingFeature && (
          <div className="space-y-6">
            {/* Usage Info */}
            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="mb-2 text-lg font-semibold text-gray-900">
                    Usage Information
                  </h4>
                  {existingFeature.isPassive ? (
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
                    <span className="capitalize">
                      {existingFeature.restType} rest
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {existingFeature.description && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h4 className="mb-4 text-lg font-semibold text-gray-900">
                  Description
                </h4>
                <div
                  className="prose prose-sm max-w-none leading-relaxed text-gray-700"
                  dangerouslySetInnerHTML={{
                    __html: existingFeature.description,
                  }}
                />
              </div>
            )}

            {/* Additional Info */}
            {(existingFeature.scaleWithProficiency ||
              existingFeature.category) && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
                <h4 className="mb-4 text-lg font-semibold text-gray-900">
                  Additional Details
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {existingFeature.scaleWithProficiency && (
                    <div className="flex items-center gap-3 rounded-lg border bg-white p-3">
                      <div className="h-2 w-2 shrink-0 rounded-full bg-purple-500"></div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          Scaling:
                        </span>
                        <span className="ml-2 text-sm text-gray-600">
                          Proficiency ×{' '}
                          {existingFeature.proficiencyMultiplier || 1}
                        </span>
                      </div>
                    </div>
                  )}
                  {existingFeature.category && (
                    <div className="flex items-center gap-3 rounded-lg border bg-white p-3">
                      <div className="h-2 w-2 shrink-0 rounded-full bg-green-500"></div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          Category:
                        </span>
                        <span className="ml-2 text-sm text-gray-600">
                          {existingFeature.category}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit Mode - Autocomplete & Form */}
        {mode === 'edit' && (
          <div className="space-y-6">
            {/* Autocomplete Section - Only show for new features */}
            {!isEditMode && (
              <div className="rounded-lg border-2 border-indigo-200 bg-indigo-50 p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-indigo-900">
                  <Filter className="h-5 w-5" />
                  Search Feature Database
                </h3>

                {/* Filter Dropdowns */}
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <SelectField
                    label="Source Type"
                    value={sourceFilter}
                    onValueChange={value => {
                      setSourceFilter(value as FeatureSourceFilter);
                      setClassFilter('all');
                      setSubclassFilter('all');
                    }}
                    triggerProps={{ size: 'sm' }}
                  >
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="class">Class Features</SelectItem>
                    <SelectItem value="subclass">Subclass Features</SelectItem>
                    <SelectItem value="background">
                      Background Features
                    </SelectItem>
                    <SelectItem value="feat">Feats</SelectItem>
                  </SelectField>

                  {(sourceFilter === 'class' ||
                    sourceFilter === 'subclass') && (
                    <SelectField
                      label="Class"
                      value={classFilter}
                      onValueChange={value => {
                        setClassFilter(value);
                        setSubclassFilter('all');
                      }}
                      triggerProps={{ size: 'sm' }}
                    >
                      <SelectItem value="all">All Classes</SelectItem>
                      {availableClasses.map(className => (
                        <SelectItem key={className} value={className}>
                          {className}
                        </SelectItem>
                      ))}
                    </SelectField>
                  )}

                  {sourceFilter === 'subclass' &&
                    classFilter &&
                    classFilter !== 'all' && (
                      <SelectField
                        label="Subclass"
                        value={subclassFilter}
                        onValueChange={value => setSubclassFilter(value)}
                        triggerProps={{ size: 'sm' }}
                      >
                        <SelectItem value="all">All Subclasses</SelectItem>
                        {availableSubclasses.map(subclass => (
                          <SelectItem key={subclass} value={subclass}>
                            {subclass}
                          </SelectItem>
                        ))}
                      </SelectField>
                    )}
                </div>

                {/* Autocomplete */}
                <FeatureAutocomplete
                  features={filteredFeatures}
                  onSelect={handleFeatureSelect}
                  loading={featuresLoading}
                  sourceFilter={sourceFilter}
                  placeholder="Type to search features, backgrounds, or feats..."
                />
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h4 className="mb-4 text-lg font-semibold text-gray-900">
                  Basic Information
                </h4>

                <div className="space-y-4">
                  <Input
                    label="Feature Name"
                    value={formData.name}
                    onChange={e =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Action Surge, Darkvision, Lucky"
                    required
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <SelectField
                      label="Source Type"
                      value={formData.sourceType}
                      onValueChange={value =>
                        setFormData({
                          ...formData,
                          sourceType: value as FeatureSourceType,
                        })
                      }
                      required
                    >
                      {Object.entries(FEATURE_SOURCE_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectField>

                    <Input
                      label="Source Detail"
                      value={formData.sourceDetail || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          sourceDetail: e.target.value,
                        })
                      }
                      placeholder="e.g., Fighter Level 2, Hill Dwarf"
                    />
                  </div>

                  <Input
                    label="Category (Optional)"
                    value={formData.category || ''}
                    onChange={e =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    placeholder="e.g., Combat, Utility, Social"
                  />

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <RichTextEditor
                      content={formData.description}
                      onChange={content =>
                        setFormData({ ...formData, description: content })
                      }
                      placeholder="Describe what this feature does, how it works, and any important details..."
                      minHeight="150px"
                    />
                  </div>
                </div>
              </div>

              {/* Usage Configuration */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="mb-3 flex items-center gap-2 font-medium text-gray-900">
                  <Settings className="h-4 w-4" />
                  Usage Configuration
                </h4>

                <div className="space-y-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isPassive || false}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          isPassive: e.target.checked,
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">
                      Passive ability (always active, no usage tracking)
                    </span>
                  </label>

                  {!formData.isPassive && (
                    <div className="space-y-3 border-l-2 border-gray-200 pl-6">
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Maximum Uses"
                          type="number"
                          min="0"
                          value={formData.maxUses.toString()}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              maxUses: parseInt(e.target.value) || 0,
                            })
                          }
                          helperText="Set to 0 for unlimited uses"
                        />

                        <SelectField
                          label="Recharges On"
                          value={formData.restType}
                          onValueChange={value =>
                            setFormData({
                              ...formData,
                              restType: value as 'short' | 'long',
                            })
                          }
                        >
                          <SelectItem value="short">Short Rest</SelectItem>
                          <SelectItem value="long">Long Rest</SelectItem>
                        </SelectField>
                      </div>

                      <div>
                        <label className="mb-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.scaleWithProficiency || false}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                scaleWithProficiency: e.target.checked,
                              })
                            }
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">
                            Scale uses with proficiency bonus
                          </span>
                        </label>

                        {formData.scaleWithProficiency && (
                          <div className="pl-6">
                            <Input
                              label="Proficiency Multiplier"
                              type="number"
                              min="0.5"
                              step="0.5"
                              value={
                                formData.proficiencyMultiplier?.toString() ||
                                '1'
                              }
                              onChange={e =>
                                setFormData({
                                  ...formData,
                                  proficiencyMultiplier:
                                    parseFloat(e.target.value) || 1,
                                })
                              }
                              helperText="Maximum uses = base uses + (proficiency × multiplier)"
                              wrapperClassName="w-48"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!formData.name.trim()}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isEditMode ? (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Feature
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h4 className="mb-2 text-lg font-semibold text-red-900">
                  Delete this feature?
                </h4>
                <p className="mb-4 text-sm text-red-700">
                  This action cannot be undone. The feature &quot;
                  {existingFeature?.name}
                  &quot; will be permanently removed.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Feature
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
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
