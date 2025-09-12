'use client';

import React from 'react';
import { ClassInfo } from '@/types/character';
import { COMMON_CLASSES } from '@/utils/constants';
import { FancySelect } from '@/components/ui/forms/FancySelect';

interface SimpleClassSelectorProps {
  value: ClassInfo;
  onChange: (classInfo: ClassInfo) => void;
  className?: string;
}

export default function SimpleClassSelector({
  value,
  onChange,
  className = '',
}: SimpleClassSelectorProps) {
  const handleClassChange = (className: string) => {
    const classData = COMMON_CLASSES.find(c => c.name === className);
    if (classData) {
      onChange({
        name: classData.name,
        isCustom: false,
        spellcaster: classData.spellcaster,
        hitDie: classData.hitDie,
      });
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Class
      </label>
      
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
        value={value.name}
        onChange={selectedValue => handleClassChange(selectedValue as string)}
        placeholder="Select a class..."
        color="blue"
      />

      {/* Show spellcaster info for selected class */}
      {value.name && (
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
  );
}
