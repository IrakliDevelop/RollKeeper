'use client';

import React, { useState } from 'react';
import {
  Plus,
  Minus,
  AlertTriangle,
  Info,
  Users,
  Sparkles,
} from 'lucide-react';
import { CharacterState } from '@/types/character';
import { validateMulticlassRequirements } from '@/utils/multiclass';
import { COMMON_CLASSES } from '@/utils/constants';
import { Button, Input, SelectField, SelectItem } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';
import { useClassData } from '@/hooks/useClassData';

interface MulticlassManagerProps {
  character: CharacterState;
  onAddClassLevel: (
    className: string,
    isCustom?: boolean,
    spellcaster?: 'full' | 'half' | 'third' | 'warlock' | 'none',
    hitDie?: number,
    subclass?: string
  ) => void;
  onRemoveClassLevel: (className: string) => void;
  onUpdateClassLevel: (className: string, newLevel: number) => void;
}

export default function MulticlassManager({
  character,
  onAddClassLevel,
  onRemoveClassLevel,
  onUpdateClassLevel,
}: MulticlassManagerProps) {
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings?: string[];
  } | null>(null);

  const {
    classData,
    loading: classDataLoading,
    error: classDataError,
  } = useClassData();

  const classes = character.classes || [];
  const isMulticlassed = classes.length > 1;
  const totalLevel = classes.reduce((sum, cls) => sum + cls.level, 0);

  // Get class data for the new class to determine spellcaster type and hit die
  const getClassData = (className: string) => {
    const apiClass = classData.find(cls => cls.name === className);
    if (apiClass) {
      return {
        spellcaster: apiClass.spellcasting.type,
        hitDie: parseInt(apiClass.hitDie.replace('d', '')),
      };
    }

    // Fallback to COMMON_CLASSES for backwards compatibility
    const commonClass = COMMON_CLASSES.find(cls => cls.name === className);
    if (commonClass) {
      return {
        spellcaster: commonClass.spellcaster,
        hitDie: commonClass.hitDie,
      };
    }

    // Final fallback for unknown classes
    return {
      spellcaster: 'none' as const,
      hitDie: 8,
    };
  };

  const handleAddClass = () => {
    if (!newClassName.trim()) return;

    const classInfo = getClassData(newClassName);

    // Validate multiclassing requirements
    const validation = validateMulticlassRequirements(
      classes,
      newClassName,
      character.abilities,
      classData
    );

    setValidationResult(validation);

    if (validation.valid) {
      onAddClassLevel(
        newClassName,
        false, // isCustom - we'll assume false for now
        classInfo.spellcaster,
        classInfo.hitDie
      );
      setNewClassName('');
      setShowAddClass(false);
      setValidationResult(null);
    }
  };

  const handleRemoveClass = (className: string) => {
    onRemoveClassLevel(className);
    setValidationResult(null);
  };

  const handleLevelChange = (className: string, newLevel: number) => {
    const clampedLevel = Math.max(1, Math.min(20, newLevel));
    onUpdateClassLevel(className, clampedLevel);
  };

  const canAddClass = totalLevel < 20;

  // Show loading state while class data is loading
  if (classDataLoading) {
    return (
      <div className="border-accent-blue-border from-accent-blue-bg to-accent-indigo-bg rounded-lg border-2 bg-gradient-to-br p-6 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <div className="border-accent-blue-text-muted h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <span className="text-muted ml-3 font-medium">
            Loading class data...
          </span>
        </div>
      </div>
    );
  }

  // Show error state if class data failed to load
  if (classDataError) {
    return (
      <div className="border-accent-red-border from-accent-red-bg to-accent-red-bg-strong rounded-lg border-2 bg-gradient-to-br p-6 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <AlertTriangle className="text-accent-red-text-muted h-8 w-8" />
          <span className="text-accent-red-text-muted ml-3 font-medium">
            Failed to load class data
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-accent-indigo-border from-accent-indigo-bg to-accent-purple-bg rounded-lg border-2 bg-gradient-to-br p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-accent-indigo-text flex items-center gap-2 text-lg font-bold">
          <Users className="h-5 w-5" />
          {isMulticlassed ? 'Multiclass Levels' : 'Class Levels'}
        </h3>
        {canAddClass && (
          <Button
            onClick={() => setShowAddClass(!showAddClass)}
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            className="from-accent-indigo-text-muted to-accent-purple-text-muted hover:from-accent-indigo-text hover:to-accent-purple-text bg-gradient-to-r"
          >
            Add Class
          </Button>
        )}
      </div>

      {/* Current Classes */}
      <div className="space-y-3">
        {classes.map((classInfo, index) => (
          <div
            key={`${classInfo.className}-${index}`}
            className="border-accent-indigo-border bg-surface-raised flex items-center justify-between rounded-lg border-2 p-3 transition-shadow hover:shadow-md"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" size="lg" className="font-semibold">
                {classInfo.className}
              </Badge>
              {classInfo.subclass && (
                <Badge variant="neutral" size="sm">
                  {classInfo.subclass}
                </Badge>
              )}
              {classInfo.spellcaster && classInfo.spellcaster !== 'none' && (
                <Badge
                  variant="info"
                  size="sm"
                  leftIcon={<Sparkles className="h-3 w-3" />}
                >
                  {classInfo.spellcaster === 'full'
                    ? 'Full'
                    : classInfo.spellcaster === 'half'
                      ? 'Half'
                      : classInfo.spellcaster === 'third'
                        ? '1/3'
                        : 'Pact'}{' '}
                  Caster
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <label className="text-muted text-sm font-medium">Level:</label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={classInfo.level.toString()}
                  onChange={e =>
                    handleLevelChange(
                      classInfo.className,
                      parseInt(e.target.value) || 1
                    )
                  }
                  className="w-16 text-center"
                  size="sm"
                />
              </div>

              {classes.length > 1 && (
                <Button
                  onClick={() => handleRemoveClass(classInfo.className)}
                  variant="ghost"
                  size="xs"
                  className="text-accent-red-text-muted hover:bg-accent-red-bg"
                  title="Remove class level"
                >
                  <Minus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Total Level Display */}
      <div className="border-accent-blue-border-strong from-accent-blue-bg-strong to-accent-indigo-bg-strong mt-4 rounded-lg border-2 bg-gradient-to-r p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-accent-blue-text font-semibold">
            Total Character Level:
          </span>
          <Badge
            variant="primary"
            size="lg"
            className="px-4 py-2 text-xl font-bold"
          >
            {totalLevel}
          </Badge>
        </div>
        {isMulticlassed && (
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="info" size="sm">
              Multiclass
            </Badge>
            <span className="text-accent-blue-text-muted text-sm">
              {classes.length} classes
            </span>
          </div>
        )}
      </div>

      {/* Add New Class Form */}
      {showAddClass && (
        <div className="border-accent-purple-border from-accent-purple-bg to-accent-purple-bg-strong mt-4 rounded-lg border-2 bg-gradient-to-br p-4 shadow-sm">
          <h4 className="text-accent-purple-text mb-3 flex items-center gap-2 font-semibold">
            <Plus className="h-4 w-4" />
            Add New Class
          </h4>

          <div className="space-y-3">
            <div>
              <SelectField
                label="Select Class"
                value={newClassName}
                onValueChange={(value: string) => {
                  // Don't process the placeholder value
                  if (value === '__placeholder__') {
                    setNewClassName('');
                    setValidationResult(null);
                    return;
                  }

                  setNewClassName(value);

                  // Validate multiclass requirements when class is selected
                  if (value && classData.length > 0) {
                    const validation = validateMulticlassRequirements(
                      classes,
                      value,
                      character.abilities,
                      classData
                    );
                    setValidationResult(validation);
                  } else {
                    setValidationResult(null);
                  }
                }}
              >
                <SelectItem value="__placeholder__" disabled>
                  Choose a class...
                </SelectItem>
                {classData
                  .filter(
                    cls =>
                      !classes.some(
                        existingCls => existingCls.className === cls.name
                      )
                  )
                  .map(cls => (
                    <SelectItem key={cls.name} value={cls.name}>
                      {cls.name}
                      {cls.spellcasting.type !== 'none' &&
                        ` (${
                          cls.spellcasting.type === 'full'
                            ? 'Full'
                            : cls.spellcasting.type === 'half'
                              ? 'Half'
                              : cls.spellcasting.type === 'third'
                                ? '1/3'
                                : 'Half'
                        } Caster)`}
                    </SelectItem>
                  ))}
              </SelectField>
              <p className="text-muted mt-1 text-xs">
                Only classes you don&apos;t already have are shown
              </p>
            </div>

            {/* Validation Messages */}
            {validationResult && (
              <div className="space-y-2">
                {validationResult.errors.length > 0 && (
                  <div className="border-accent-red-border bg-accent-red-bg rounded-lg border-2 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="text-accent-red-text-muted mt-0.5 h-5 w-5 flex-shrink-0" />
                      <div className="flex-1">
                        <h5 className="text-accent-red-text font-semibold">
                          Requirements Not Met:
                        </h5>
                        <ul className="text-accent-red-text-muted mt-1 list-inside list-disc space-y-1 text-sm">
                          {validationResult.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {validationResult.warnings &&
                  validationResult.warnings.length > 0 && (
                    <div className="border-accent-amber-border bg-accent-amber-bg rounded-lg border-2 p-3">
                      <div className="flex items-start gap-2">
                        <Info className="text-accent-amber-text-muted mt-0.5 h-5 w-5 flex-shrink-0" />
                        <div className="flex-1">
                          <h5 className="text-accent-amber-text font-semibold">
                            Considerations:
                          </h5>
                          <ul className="text-accent-amber-text-muted mt-1 list-inside list-disc space-y-1 text-sm">
                            {validationResult.warnings.map((warning, index) => (
                              <li key={index}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleAddClass}
                disabled={
                  !newClassName.trim() ||
                  (validationResult ? !validationResult.valid : false)
                }
                variant="primary"
                size="sm"
                className="from-accent-purple-text-muted hover:from-accent-purple-text bg-gradient-to-r to-pink-600 hover:to-pink-700"
              >
                Add Class Level
              </Button>
              <Button
                onClick={() => {
                  setShowAddClass(false);
                  setNewClassName('');
                  setValidationResult(null);
                }}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Level 20 Warning */}
      {totalLevel >= 20 && (
        <div className="border-accent-amber-border from-accent-amber-bg to-accent-amber-bg-strong mt-4 rounded-lg border-2 bg-gradient-to-r p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-accent-amber-text-muted h-5 w-5 flex-shrink-0" />
            <span className="text-accent-amber-text text-sm font-semibold">
              Maximum character level reached (20)
            </span>
          </div>
        </div>
      )}

      {/* Multiclassing Info */}
      {!isMulticlassed && classes.length === 1 && (
        <div className="border-divider bg-surface-inset mt-4 rounded-lg border-2 p-4 shadow-sm">
          <div className="flex items-start gap-2">
            <Info className="text-muted mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="text-muted text-sm">
              <p className="text-body font-semibold">About Multiclassing:</p>
              <p className="mt-1">
                You can add levels in other classes to create a multiclass
                character. Each class has ability score requirements that must
                be met.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
