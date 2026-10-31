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
  Spell,
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
import { useSpellsData } from '@/hooks/useSpellsData';
import { Button } from '@/components/ui/forms/button';
import { Checkbox } from '@/components/ui/forms/checkbox';
import { FeatureAutocomplete } from '@/components/ui/forms/FeatureAutocomplete';
import RichTextEditor from '@/components/ui/forms/RichTextEditor';
import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Section } from '@/components/ui/layout/section';
import GrantedSpellPicker from './GrantedSpellPicker';
import {
  parseAdditionalSpells,
  ParsedAdditionalSpells,
} from '@/utils/additionalSpellsParser';
import { Trash2, Clock } from 'lucide-react';

interface UnifiedFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    feature: Omit<ExtendedFeature, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onAddSpells?: (spells: Spell[]) => void;
  onDelete?: () => void;
  onUse?: () => void;
  existingFeatures: ExtendedFeature[];
  feature?: ExtendedFeature; // If provided, opens in edit mode
  character: CharacterState;
  readonly?: boolean;
  initialMode?: 'view' | 'edit';
}

export default function UnifiedFeatureModal({
  isOpen,
  onClose,
  onSave,
  onAddSpells,
  onDelete,
  onUse,
  existingFeatures,
  feature: existingFeature,
  character,
  readonly = false,
  initialMode = 'view',
}: UnifiedFeatureModalProps) {
  const isEditMode = !!existingFeature;
  const [mode, setMode] = useState<'view' | 'edit'>(
    isEditMode ? (readonly ? 'view' : initialMode) : 'edit'
  );

  // Spell picker state for feats that grant spells
  const [showSpellPicker, setShowSpellPicker] = useState(false);
  const [pendingParsedSpells, setPendingParsedSpells] =
    useState<ParsedAdditionalSpells | null>(null);
  const [pendingFeatName, setPendingFeatName] = useState('');
  const { spells: allSpells, loading: spellsLoading } = useSpellsData();

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
        setMode(readonly ? 'view' : initialMode);
      } else {
        setFormData(partialFeatureToFormData(createDefaultExtendedFeature()));
        setMode('edit');
      }
      setShowSpellPicker(false);
      setPendingParsedSpells(null);
      setPendingFeatName('');
      setSourceFilter('all');
      setClassFilter('all');
      setSubclassFilter('all');
    }
  }, [isOpen, existingFeature, readonly, initialMode]);

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
      const hasAdditionalSpells =
        selectedFeature.metadata.additionalSpells &&
        selectedFeature.metadata.additionalSpells.length > 0;

      partialFeature = convertFeatToExtendedFeature({
        id: selectedFeature.id,
        name: selectedFeature.name,
        source: selectedFeature.source,
        description: selectedFeature.description,
        prerequisites: selectedFeature.metadata.prerequisites,
        abilityIncreases: selectedFeature.metadata.abilityIncreases || '',
        repeatable: selectedFeature.metadata.repeatable || false,
        grantsSpells: !!hasAdditionalSpells,
        isSrd: false,
        tags: selectedFeature.tags,
      });

      // Parse additionalSpells for the spell picker
      if (hasAdditionalSpells && onAddSpells) {
        const parsed = parseAdditionalSpells(
          selectedFeature.metadata.additionalSpells!
        );
        if (parsed) {
          setPendingParsedSpells(parsed);
          setPendingFeatName(selectedFeature.name);
        }
      }
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
      displayOrder = existingFeatures.length;
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

    // If feat grants spells, show the spell picker instead of closing
    if (pendingParsedSpells && onAddSpells) {
      setShowSpellPicker(true);
      return;
    }

    onClose();
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

  const handleSpellPickerConfirm = (spells: Spell[]) => {
    if (onAddSpells && spells.length > 0) {
      onAddSpells(spells);
    }
    setShowSpellPicker(false);
    setPendingParsedSpells(null);
    setPendingFeatName('');
    onClose();
  };

  const handleSpellPickerSkip = () => {
    setShowSpellPicker(false);
    setPendingParsedSpells(null);
    setPendingFeatName('');
    onClose();
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
    <>
      <Dialog
        open={isOpen}
        onOpenChange={open => {
          if (!open) onClose();
        }}
      >
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>
              {mode === 'view'
                ? existingFeature?.name || 'Details'
                : isEditMode
                  ? existingFeature?.name
                  : 'Add feature'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-6">
              {/* View Mode - Header with Actions */}
              {isEditMode && mode === 'view' && (
                <div className="border-divider flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-muted text-sm font-medium">
                      {FEATURE_SOURCE_LABELS[existingFeature!.sourceType]}
                    </span>
                    {existingFeature!.sourceDetail && (
                      <span className="text-muted text-sm">
                        {existingFeature!.sourceDetail}
                      </span>
                    )}
                  </div>

                  {!readonly && (
                    <div className="flex flex-wrap gap-2">
                      {hasUses && !isExhausted && onUse && (
                        <Button onClick={onUse} variant="primary" size="sm">
                          Use Feature
                        </Button>
                      )}
                      <Button
                        onClick={() => setMode('edit')}
                        variant="outline"
                        size="sm"
                      >
                        Edit
                      </Button>
                      {onDelete && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={onDelete}
                          leftIcon={<Trash2 className="h-4 w-4" />}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* View Mode - Content */}
              {isEditMode && mode === 'view' && existingFeature && (
                <div className="space-y-6">
                  {/* Usage Info */}
                  <Section heading="Usage Information" level={3}>
                    <div className="flex items-center justify-between">
                      <div>
                        {existingFeature.isPassive ? (
                          <div className="flex items-center gap-2">
                            <p className="text-muted text-sm font-medium">
                              Passive ability - always active
                            </p>
                          </div>
                        ) : hasUses ? (
                          <div className="flex items-center gap-2">
                            <p className="text-body text-sm font-medium">
                              <span className="text-heading">
                                {usesRemaining}
                              </span>{' '}
                              of {maxUses} uses remaining
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-muted text-sm font-medium">
                              Unlimited uses
                            </p>
                          </div>
                        )}
                      </div>
                      {hasUses && (
                        <div className="text-muted flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4" aria-hidden="true" />
                          <span>
                            Recharges on a {existingFeature.restType} rest
                          </span>
                        </div>
                      )}
                    </div>
                  </Section>

                  {/* Description */}
                  {existingFeature.description && (
                    <Section heading="Description" level={3}>
                      <div
                        className="prose prose-sm text-body max-w-none leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: existingFeature.description,
                        }}
                      />
                    </Section>
                  )}

                  {/* Additional Info */}
                  {(existingFeature.scaleWithProficiency ||
                    existingFeature.category) && (
                    <Section heading="Additional Details" level={3}>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {existingFeature.scaleWithProficiency && (
                          <div className="flex items-center gap-3">
                            <div>
                              <span className="text-body text-sm font-medium">
                                Scaling:
                              </span>
                              <span className="text-muted ml-2 text-sm">
                                Proficiency ×{' '}
                                {existingFeature.proficiencyMultiplier || 1}
                              </span>
                            </div>
                          </div>
                        )}
                        {existingFeature.category && (
                          <div className="flex items-center gap-3">
                            <div>
                              <span className="text-body text-sm font-medium">
                                Category:
                              </span>
                              <span className="text-muted ml-2 text-sm">
                                {existingFeature.category}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </Section>
                  )}
                </div>
              )}

              {/* Edit Mode - Autocomplete & Form */}
              {mode === 'edit' && (
                <div className="space-y-6">
                  {/* Autocomplete Section - Only show for new features */}
                  {!isEditMode && (
                    <Section heading="Search Feature Database" level={3}>
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
                          <SelectItem value="subclass">
                            Subclass Features
                          </SelectItem>
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
                              <SelectItem value="all">
                                All Subclasses
                              </SelectItem>
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
                    </Section>
                  )}

                  {/* Form Fields */}
                  <div className="space-y-6">
                    {/* Basic Information */}
                    <Section heading="Basic Information" level={3}>
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

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                            setFormData({
                              ...formData,
                              category: e.target.value,
                            })
                          }
                          placeholder="e.g., Combat, Utility, Social"
                        />

                        <div>
                          <label className="text-body mb-1 block text-sm font-medium">
                            Description
                          </label>
                          <RichTextEditor
                            content={formData.description}
                            onChange={content =>
                              setFormData({ ...formData, description: content })
                            }
                            placeholder=""
                            minHeight="150px"
                          />
                        </div>
                      </div>
                    </Section>

                    {/* Usage Configuration */}
                    <Section heading="Usage Configuration" level={3}>
                      <div className="space-y-4">
                        <Checkbox
                          label="Passive ability (always active, no usage tracking)"
                          checked={formData.isPassive || false}
                          onCheckedChange={checked =>
                            setFormData({ ...formData, isPassive: checked })
                          }
                        />

                        {!formData.isPassive && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <NumberInput
                                label="Maximum Uses"
                                min="0"
                                value={formData.maxUses}
                                onChange={v =>
                                  setFormData({
                                    ...formData,
                                    maxUses: v ?? 0,
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
                                <SelectItem value="short">
                                  Short Rest
                                </SelectItem>
                                <SelectItem value="long">Long Rest</SelectItem>
                              </SelectField>
                            </div>

                            <div>
                              <Checkbox
                                label="Scale uses with proficiency bonus"
                                checked={formData.scaleWithProficiency || false}
                                onCheckedChange={checked =>
                                  setFormData({
                                    ...formData,
                                    scaleWithProficiency: checked,
                                  })
                                }
                              />

                              {formData.scaleWithProficiency && (
                                <div className="pl-6">
                                  <NumberInput
                                    label="Proficiency Multiplier"
                                    min="0.5"
                                    step="0.5"
                                    integer={false}
                                    value={formData.proficiencyMultiplier || 1}
                                    onChange={v =>
                                      setFormData({
                                        ...formData,
                                        proficiencyMultiplier: v ?? 1,
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
                    </Section>
                  </div>

                  {/* Action Buttons */}
                  <DialogFooter>
                    <Button
                      type="button"
                      onClick={handleCancel}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSave}
                      disabled={!formData.name.trim()}
                      variant="primary"
                    >
                      {isEditMode ? 'Save Changes' : 'Add feature'}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Spell picker modal for feats that grant spells */}
      {pendingParsedSpells && (
        <GrantedSpellPicker
          isOpen={showSpellPicker}
          onClose={handleSpellPickerSkip}
          onConfirm={handleSpellPickerConfirm}
          featName={pendingFeatName}
          parsed={pendingParsedSpells}
          allSpells={allSpells}
          spellsLoading={spellsLoading}
        />
      )}
    </>
  );
}
