'use client';

import React, { useState } from 'react';
import { Plus, Minus, AlertTriangle, Info, Users, Sparkles } from 'lucide-react';
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

  const { classData, loading: classDataLoading, error: classDataError } = useClassData();

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
      <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 font-medium">Loading class data...</span>
        </div>
      </div>
    );
  }

  // Show error state if class data failed to load
  if (classDataError) {
    return (
      <div className="rounded-lg border-2 border-red-200 bg-gradient-to-br from-red-50 to-pink-50 p-6 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <span className="ml-3 text-red-600 font-medium">Failed to load class data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-indigo-800">
          <Users className="h-5 w-5" />
          {isMulticlassed ? 'Multiclass Levels' : 'Class Levels'}
        </h3>
        {canAddClass && (
          <Button
            onClick={() => setShowAddClass(!showAddClass)}
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
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
            className="flex items-center justify-between rounded-lg border-2 border-indigo-200 bg-white p-3 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" size="lg" className="font-semibold">
                {classInfo.className}
              </Badge>
              {classInfo.subclass && (
                <Badge variant="neutral" size="sm">
                  {classInfo.subclass}
                </Badge>
              )}
              {classInfo.spellcaster && classInfo.spellcaster !== 'none' && (
                <Badge variant="info" size="sm" leftIcon={<Sparkles className="h-3 w-3" />}>
                  {classInfo.spellcaster === 'full' ? 'Full' : 
                   classInfo.spellcaster === 'half' ? 'Half' : 
                   classInfo.spellcaster === 'third' ? '1/3' : 
                   'Pact'} Caster
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Level:</label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={classInfo.level.toString()}
                  onChange={(e) => handleLevelChange(classInfo.className, parseInt(e.target.value) || 1)}
                  className="w-16 text-center"
                  size="sm"
                />
              </div>
              
              {classes.length > 1 && (
                <Button
                  onClick={() => handleRemoveClass(classInfo.className)}
                  variant="ghost"
                  size="xs"
                  className="text-red-600 hover:bg-red-100"
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
      <div className="mt-4 rounded-lg border-2 border-blue-300 bg-gradient-to-r from-blue-100 to-cyan-100 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-blue-900">Total Character Level:</span>
          <Badge variant="primary" size="lg" className="text-xl font-bold px-4 py-2">
            {totalLevel}
          </Badge>
        </div>
        {isMulticlassed && (
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="info" size="sm">
              Multiclass
            </Badge>
            <span className="text-sm text-blue-700">
              {classes.length} classes
            </span>
          </div>
        )}
      </div>

      {/* Add New Class Form */}
      {showAddClass && (
        <div className="mt-4 rounded-lg border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-4 shadow-sm">
          <h4 className="mb-3 flex items-center gap-2 font-semibold text-purple-800">
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
                  .filter(cls => !classes.some(existingCls => existingCls.className === cls.name))
                  .map(cls => (
                    <SelectItem key={cls.name} value={cls.name}>
                      {cls.name}
                      {cls.spellcasting.type !== 'none' && 
                        ` (${
                          cls.spellcasting.type === 'full' ? 'Full' :
                          cls.spellcasting.type === 'half' ? 'Half' :
                          cls.spellcasting.type === 'third' ? '1/3' :
                          'Half'
                        } Caster)`
                      }
                    </SelectItem>
                  ))}
              </SelectField>
              <p className="mt-1 text-xs text-gray-500">
                Only classes you don&apos;t already have are shown
              </p>
            </div>

            {/* Validation Messages */}
            {validationResult && (
              <div className="space-y-2">
                {validationResult.errors.length > 0 && (
                  <div className="rounded-lg border-2 border-red-200 bg-red-50 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 mt-0.5 text-red-500 flex-shrink-0" />
                      <div className="flex-1">
                        <h5 className="font-semibold text-red-800">Requirements Not Met:</h5>
                        <ul className="mt-1 list-disc list-inside text-sm text-red-700 space-y-1">
                          {validationResult.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {validationResult.warnings && validationResult.warnings.length > 0 && (
                  <div className="rounded-lg border-2 border-yellow-200 bg-yellow-50 p-3">
                    <div className="flex items-start gap-2">
                      <Info className="h-5 w-5 mt-0.5 text-yellow-500 flex-shrink-0" />
                      <div className="flex-1">
                        <h5 className="font-semibold text-yellow-800">Considerations:</h5>
                        <ul className="mt-1 list-disc list-inside text-sm text-yellow-700 space-y-1">
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
                disabled={!newClassName.trim() || (validationResult ? !validationResult.valid : false)}
                variant="primary"
                size="sm"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
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
        <div className="mt-4 rounded-lg border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-amber-800">
              Maximum character level reached (20)
            </span>
          </div>
        </div>
      )}

      {/* Multiclassing Info */}
      {!isMulticlassed && classes.length === 1 && (
        <div className="mt-4 rounded-lg border-2 border-gray-200 bg-gray-50 p-4 shadow-sm">
          <div className="flex items-start gap-2">
            <Info className="h-5 w-5 mt-0.5 text-gray-500 flex-shrink-0" />
            <div className="text-sm text-gray-600">
              <p className="font-semibold text-gray-700">About Multiclassing:</p>
              <p className="mt-1">
                You can add levels in other classes to create a multiclass character. 
                Each class has ability score requirements that must be met.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
