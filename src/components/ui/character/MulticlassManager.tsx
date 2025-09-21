'use client';

import React, { useState } from 'react';
import { Plus, Minus, AlertTriangle, Info } from 'lucide-react';
import { CharacterState } from '@/types/character';
import { validateMulticlassRequirements } from '@/utils/multiclass';
import { COMMON_CLASSES } from '@/utils/constants';
import { FancySelect } from '@/components/ui/forms/FancySelect';
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
      <div className="rounded-lg border border-blue-200 bg-white p-6 shadow-lg">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading class data...</span>
        </div>
      </div>
    );
  }

  // Show error state if class data failed to load
  if (classDataError) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-6 shadow-lg">
        <div className="flex items-center justify-center py-8">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <span className="ml-3 text-red-600">Failed to load class data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-white p-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">
          {isMulticlassed ? 'Multiclass Levels' : 'Class Levels'}
        </h3>
        {canAddClass && (
          <button
            onClick={() => setShowAddClass(!showAddClass)}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Plus size={16} />
            Add Class
          </button>
        )}
      </div>

      {/* Current Classes */}
      <div className="space-y-3">
        {classes.map((classInfo, index) => (
          <div
            key={`${classInfo.className}-${index}`}
            className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3"
          >
            <div className="flex items-center gap-3">
              <div className="font-medium text-gray-800">
                {classInfo.className}
                {classInfo.subclass && (
                  <span className="ml-1 text-sm text-gray-600">
                    ({classInfo.subclass})
                  </span>
                )}
              </div>
              {classInfo.spellcaster && classInfo.spellcaster !== 'none' && (
                <span className="rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-700">
                  {classInfo.spellcaster} caster
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <label className="text-sm text-gray-600">Level:</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={classInfo.level}
                  onChange={(e) => handleLevelChange(classInfo.className, parseInt(e.target.value) || 1)}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-center text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              {classes.length > 1 && (
                <button
                  onClick={() => handleRemoveClass(classInfo.className)}
                  className="rounded-md bg-red-100 p-1 text-red-600 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                  title="Remove class level"
                >
                  <Minus size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Total Level Display */}
      <div className="mt-4 rounded-md bg-blue-50 p-3">
        <div className="flex items-center justify-between">
          <span className="font-medium text-blue-800">Total Character Level:</span>
          <span className="text-xl font-bold text-blue-900">{totalLevel}</span>
        </div>
        {isMulticlassed && (
          <div className="mt-1 text-sm text-blue-600">
            Multiclass character with {classes.length} classes
          </div>
        )}
      </div>

      {/* Add New Class Form */}
      {showAddClass && (
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4">
          <h4 className="mb-3 font-medium text-blue-800">Add New Class</h4>
          
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Select Class
              </label>
              <FancySelect
                options={[
                  { value: '', label: 'Choose a class...' },
                  ...classData
                    .filter(cls => !classes.some(existingCls => existingCls.className === cls.name))
                    .map(cls => ({
                      value: cls.name,
                      label: cls.name,
                      description: cls.spellcasting.type !== 'none'
                        ? `${
                            cls.spellcasting.type === 'full'
                              ? 'Full'
                              : cls.spellcasting.type === 'half'
                                ? 'Half'
                                : cls.spellcasting.type === 'third'
                                  ? '1/3'
                                  : 'Pact'
                          } Caster`
                        : 'Non-spellcaster',
                    })),
                ]}
                value={newClassName}
                onChange={selectedValue => {
                  const className = selectedValue as string;
                  setNewClassName(className);
                  
                  // Validate multiclass requirements when class is selected
                  if (className && classData.length > 0) {
                    const validation = validateMulticlassRequirements(
                      classes,
                      className,
                      character.abilities,
                      classData
                    );
                    setValidationResult(validation);
                  } else {
                    setValidationResult(null);
                  }
                }}
                placeholder="Choose a class..."
                color="blue"
              />
              <p className="mt-1 text-xs text-gray-500">
                Only classes you don&apos;t already have are shown
              </p>
            </div>

            {/* Validation Messages */}
            {validationResult && (
              <div className="space-y-2">
                {validationResult.errors.length > 0 && (
                  <div className="rounded-md bg-red-50 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="mt-0.5 text-red-500" />
                      <div>
                        <h5 className="font-medium text-red-800">Requirements Not Met:</h5>
                        <ul className="mt-1 list-disc list-inside text-sm text-red-700">
                          {validationResult.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {validationResult.warnings && validationResult.warnings.length > 0 && (
                  <div className="rounded-md bg-yellow-50 p-3">
                    <div className="flex items-start gap-2">
                      <Info size={16} className="mt-0.5 text-yellow-500" />
                      <div>
                        <h5 className="font-medium text-yellow-800">Considerations:</h5>
                        <ul className="mt-1 list-disc list-inside text-sm text-yellow-700">
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
              <button
                onClick={handleAddClass}
                disabled={!newClassName.trim() || (validationResult ? !validationResult.valid : false)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Add Class Level
              </button>
              <button
                onClick={() => {
                  setShowAddClass(false);
                  setNewClassName('');
                  setValidationResult(null);
                }}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Level 20 Warning */}
      {totalLevel >= 20 && (
        <div className="mt-4 rounded-md bg-amber-50 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <span className="text-sm font-medium text-amber-800">
              Maximum character level reached (20)
            </span>
          </div>
        </div>
      )}

      {/* Multiclassing Info */}
      {!isMulticlassed && classes.length === 1 && (
        <div className="mt-4 rounded-md bg-gray-50 p-3">
          <div className="flex items-start gap-2">
            <Info size={16} className="mt-0.5 text-gray-500" />
            <div className="text-sm text-gray-600">
              <p className="font-medium">About Multiclassing:</p>
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
