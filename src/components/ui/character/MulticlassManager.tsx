'use client';

import React, { useState } from 'react';
import { CharacterState } from '@/types/character';
import { validateMulticlassRequirements } from '@/utils/multiclass';
import { COMMON_CLASSES } from '@/utils/constants';
import { Button, SelectField, SelectItem } from '@/components/ui/forms';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Badge } from '@/components/ui/layout';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
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

  const handleRemoveClass = async (className: string) => {
    if (
      !(await confirmDialog({
        title: `Remove ${className} class level?`,
        confirmLabel: 'Remove class level',
        tone: 'danger',
      }))
    )
      return;
    onRemoveClassLevel(className);
    setValidationResult(null);
  };

  const handleLevelChange = (className: string, newLevel: number) => {
    const clampedLevel = Math.max(1, Math.min(20, newLevel));
    onUpdateClassLevel(className, clampedLevel);
  };

  const canAddClass = totalLevel < 20;

  if (classDataLoading)
    return <p className="type-body text-muted">Loading classes…</p>;
  if (classDataError || classData.length === 0)
    return (
      <p className="type-body text-blood-text">
        Classes didn&apos;t load. Check your connection and open Manage classes
        again.
      </p>
    );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="type-subheading text-heading">Classes</h3>
        {canAddClass && !showAddClass && (
          <Button onClick={() => setShowAddClass(true)}>Add class</Button>
        )}
      </div>
      <div className="divide-divider divide-y">
        {classes.map(classInfo => (
          <div
            key={classInfo.className}
            className="flex flex-wrap items-center justify-between gap-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="type-body text-heading">
                {classInfo.className}
              </span>
              {classInfo.subclass && <Badge>{classInfo.subclass}</Badge>}
              {classInfo.spellcaster && classInfo.spellcaster !== 'none' && (
                <Badge>
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
              <NumberInput
                label="Level"
                aria-label={`${classInfo.className} level`}
                live={false}
                min={1}
                max={20}
                value={classInfo.level}
                onChange={v => handleLevelChange(classInfo.className, v ?? 1)}
                className="w-16 text-center"
                size="sm"
              />
              {classes.length > 1 && (
                <Button
                  variant="danger"
                  size="sm"
                  aria-label={`Remove ${classInfo.className} class level`}
                  onClick={() => handleRemoveClass(classInfo.className)}
                >
                  Remove class level
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="type-body text-heading">Total level: {totalLevel}</p>
      {isMulticlassed && (
        <p className="type-small text-muted">{classes.length} classes</p>
      )}
      {showAddClass && (
        <div className="space-y-3">
          <SelectField
            label="Class"
            value={newClassName}
            onValueChange={value => {
              setNewClassName(value);
              setValidationResult(
                value && classData.length > 0
                  ? validateMulticlassRequirements(
                      classes,
                      value,
                      character.abilities,
                      classData
                    )
                  : null
              );
            }}
          >
            <SelectItem value="__placeholder__" disabled>
              Choose a class
            </SelectItem>
            {classData
              .filter(
                cls =>
                  !classes.some(existing => existing.className === cls.name)
              )
              .map(cls => (
                <SelectItem key={cls.name} value={cls.name}>
                  {cls.name}
                  {cls.spellcasting.type !== 'none' &&
                    ` (${cls.spellcasting.type === 'full' ? 'Full' : cls.spellcasting.type === 'half' ? 'Half' : cls.spellcasting.type === 'third' ? '1/3' : 'Half'} Caster)`}
                </SelectItem>
              ))}
          </SelectField>
          <p className="type-small text-muted">
            Only classes you don&apos;t already have are shown
          </p>
          {validationResult && (
            <>
              {validationResult.errors.length > 0 && (
                <div className="type-small text-blood-text">
                  <h4>Requirements not met</h4>
                  <ul>
                    {validationResult.errors.map(error => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!validationResult.warnings?.length && (
                <div className="type-small text-ember-text">
                  <h4>Notes</h4>
                  <ul>
                    {validationResult.warnings.map(warning => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={
                !newClassName.trim() ||
                (validationResult ? !validationResult.valid : false)
              }
              onClick={handleAddClass}
            >
              Add class
            </Button>
            <Button
              onClick={() => {
                setShowAddClass(false);
                setNewClassName('');
                setValidationResult(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {totalLevel >= 20 && (
        <p className="type-small text-ember-text">Level 20 is the maximum</p>
      )}
    </div>
  );
}
