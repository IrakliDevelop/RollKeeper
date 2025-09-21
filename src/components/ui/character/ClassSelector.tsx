'use client';

import React, { useState } from 'react';
import { ClassInfo } from '@/types/character';
import { COMMON_CLASSES } from '@/utils/constants';
import { CustomSwitcher } from '@/components/ui';
import { FancySelect } from '@/components/ui/forms/FancySelect';

interface ClassSelectorProps {
  value: ClassInfo;
  onChange: (classInfo: ClassInfo) => void;
  className?: string;
}

export default function ClassSelector({
  value,
  onChange,
  className = '',
}: ClassSelectorProps) {
  const [isCustom, setIsCustom] = useState(value.isCustom);
  const [customName, setCustomName] = useState(
    value.isCustom ? value.name : ''
  );

  const handleStandardClassChange = (className: string) => {
    const classData = COMMON_CLASSES.find(c => c.name === className);
    if (classData) {
      setIsCustom(false);
      onChange({
        name: classData.name,
        isCustom: false,
        spellcaster: classData.spellcaster,
        hitDie: classData.hitDie,
      });
    }
  };

  const handleCustomClassChange = (customName: string) => {
    setCustomName(customName);
    onChange({
      name: customName,
      isCustom: true,
      spellcaster: 'none', // Default for custom classes
      hitDie: 8, // Default hit die for custom classes
    });
  };

  const handleCustomToggle = (custom: boolean) => {
    setIsCustom(custom);
    if (custom) {
      onChange({
        name: customName,
        isCustom: true,
        spellcaster: 'none',
        hitDie: 8, // Default hit die for custom classes
      });
    } else {
      // Reset to first standard class if switching from custom
      const firstClass = COMMON_CLASSES[0];
      onChange({
        name: firstClass.name,
        isCustom: false,
        spellcaster: firstClass.spellcaster,
        hitDie: firstClass.hitDie,
      });
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Class</label>

        {/* Toggle between standard and custom */}
        <CustomSwitcher
          leftLabel="Standard"
          rightLabel="Custom"
          leftValue={false}
          rightValue={true}
          currentValue={isCustom}
          onChange={value => handleCustomToggle(value as boolean)}
          color="amber"
          size="sm"
          className="w-fit"
        />
      </div>

      {/* Class selection */}
      {isCustom ? (
        <div className="space-y-2">
          <input
            type="text"
            value={customName}
            onChange={e => handleCustomClassChange(e.target.value)}
            placeholder="Enter custom class name..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
          />
          <p className="text-xs text-gray-500">
            Custom classes default to non-spellcasters. You can adjust spell
            slots manually if needed.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <FancySelect
            options={[
              { value: '', label: 'Select a class...' },
              ...COMMON_CLASSES.map(classData => ({
                value: classData.name,
                label: classData.name,
                description:
                  classData.spellcaster !== 'none'
                    ? `${
                        classData.spellcaster === 'full'
                          ? 'Full'
                          : classData.spellcaster === 'half'
                            ? 'Half'
                            : classData.spellcaster === 'third'
                              ? '1/3'
                              : 'Pact'
                      } Caster`
                    : 'Non-spellcaster',
              })),
            ]}
            value={value.isCustom ? '' : value.name}
            onChange={selectedValue =>
              handleStandardClassChange(selectedValue as string)
            }
            placeholder="Select a class..."
            color="blue"
          />

          {/* Show spellcaster info for selected class */}
          {value.name && !value.isCustom && (
            <div className="text-xs text-gray-600">
              {value.spellcaster === 'none' && '• Non-spellcaster'}
              {value.spellcaster === 'full' &&
                '• Full spellcaster (Spell slots by class level)'}
              {value.spellcaster === 'half' &&
                '• Half caster (Spell slots by half class level)'}
              {value.spellcaster === 'third' &&
                '• Third caster (Limited spell slots)'}
              {value.spellcaster === 'warlock' &&
                '• Warlock (Pact Magic - short rest recovery)'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
