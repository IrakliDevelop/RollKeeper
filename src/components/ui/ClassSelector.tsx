'use client';

import React, { useState } from 'react';
import { ClassInfo } from '@/types/character';
import { COMMON_CLASSES } from '@/utils/constants';

interface ClassSelectorProps {
  value: ClassInfo;
  onChange: (classInfo: ClassInfo) => void;
  className?: string;
}

export default function ClassSelector({ value, onChange, className = '' }: ClassSelectorProps) {
  const [isCustom, setIsCustom] = useState(value.isCustom);
  const [customName, setCustomName] = useState(value.isCustom ? value.name : '');

  const handleStandardClassChange = (className: string) => {
    const classData = COMMON_CLASSES.find(c => c.name === className);
    if (classData) {
      setIsCustom(false);
      onChange({
        name: classData.name,
        isCustom: false,
        spellcaster: classData.spellcaster
      });
    }
  };

  const handleCustomClassChange = (customName: string) => {
    setCustomName(customName);
    onChange({
      name: customName,
      isCustom: true,
      spellcaster: 'none' // Default for custom classes
    });
  };

  const handleCustomToggle = (custom: boolean) => {
    setIsCustom(custom);
    if (custom) {
      onChange({
        name: customName,
        isCustom: true,
        spellcaster: 'none'
      });
    } else {
      // Reset to first standard class if switching from custom
      const firstClass = COMMON_CLASSES[0];
      onChange({
        name: firstClass.name,
        isCustom: false,
        spellcaster: firstClass.spellcaster
      });
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Class</label>
        
        {/* Toggle between standard and custom */}
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="classType"
              checked={!isCustom}
              onChange={() => handleCustomToggle(false)}
              className="mr-2"
            />
            <span className="text-sm">Standard Class</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="classType"
              checked={isCustom}
              onChange={() => handleCustomToggle(true)}
              className="mr-2"
            />
            <span className="text-sm">Custom Class</span>
          </label>
        </div>
      </div>

      {/* Class selection */}
      {isCustom ? (
        <div className="space-y-2">
          <input
            type="text"
            value={customName}
            onChange={(e) => handleCustomClassChange(e.target.value)}
            placeholder="Enter custom class name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-800"
          />
          <p className="text-xs text-gray-500">
            Custom classes default to non-spellcasters. You can adjust spell slots manually if needed.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <select
            value={value.isCustom ? '' : value.name}
            onChange={(e) => handleStandardClassChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-800"
          >
            <option value="">Select a class...</option>
            {COMMON_CLASSES.map((classData) => (
              <option key={classData.name} value={classData.name}>
                {classData.name}
                {classData.spellcaster !== 'none' && (
                  ` (${classData.spellcaster === 'full' ? 'Full' : 
                       classData.spellcaster === 'half' ? 'Half' : 
                       classData.spellcaster === 'third' ? '1/3' : 
                       'Pact'} Caster)`
                )}
              </option>
            ))}
          </select>
          
          {/* Show spellcaster info for selected class */}
          {value.name && !value.isCustom && (
            <div className="text-xs text-gray-600">
              {value.spellcaster === 'none' && '• Non-spellcaster'}
              {value.spellcaster === 'full' && '• Full spellcaster (Spell slots by class level)'}
              {value.spellcaster === 'half' && '• Half caster (Spell slots by half class level)'}
              {value.spellcaster === 'third' && '• Third caster (Limited spell slots)'}
              {value.spellcaster === 'warlock' && '• Warlock (Pact Magic - short rest recovery)'}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 