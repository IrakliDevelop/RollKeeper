'use client';

import React from 'react';
import { ClassInfo } from '@/types/character';
import { COMMON_CLASSES } from '@/utils/constants';
import { SelectField, SelectItem } from '@/components/ui/forms/select';

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
    <div className={className}>
      <SelectField
        label="Class"
        value={value.name}
        onValueChange={handleClassChange}
      >
        {COMMON_CLASSES.map(classData => (
          <SelectItem key={classData.name} value={classData.name}>
            <div className="flex flex-col">
              <span className="font-medium">{classData.name}</span>
              <span className="text-muted text-xs">
                {classData.spellcaster !== 'none'
                  ? `${
                      classData.spellcaster === 'full'
                        ? 'Full'
                        : classData.spellcaster === 'half'
                          ? 'Half'
                          : classData.spellcaster === 'third'
                            ? '1/3'
                            : 'Pact'
                    } Caster`
                  : 'Non-spellcaster'}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectField>

      {/* Show spellcaster info for selected class */}
      {value.name && (
        <div className="text-muted mt-2 text-xs">
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
