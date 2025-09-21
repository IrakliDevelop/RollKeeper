'use client';

import React from 'react';
import { Dice6, Info } from 'lucide-react';
import { ClassInfo } from '@/types/character';
import { CLASS_HIT_DICE } from '@/utils/constants';
import { FancySelect } from '../forms/FancySelect';

interface HitDiceManagerProps {
  classInfo: ClassInfo;
  level: number;
  hitDice: string;
  onUpdateClass: (classInfo: ClassInfo) => void;
  onUpdateHitDice: (hitDice: string) => void;
  className?: string;
}

const HIT_DIE_OPTIONS = [
  { value: 6, label: 'd6' },
  { value: 8, label: 'd8' },
  { value: 10, label: 'd10' },
  { value: 12, label: 'd12' },
];

export default function HitDiceManager({
  classInfo,
  level,
  hitDice,
  onUpdateClass,
  onUpdateHitDice,
  className = '',
}: HitDiceManagerProps) {
  const getHitDieForClass = (className: string): number => {
    return CLASS_HIT_DICE[className] || 8; // Default to d8
  };

  const getCurrentHitDie = (): number => {
    if (!classInfo.isCustom) {
      return getHitDieForClass(classInfo.name);
    }
    return classInfo.hitDie || 8;
  };

  const getDisplayHitDice = (): string => {
    const hitDie = getCurrentHitDie();
    return `${level}d${hitDie}`;
  };

  const handleCustomHitDieChange = (newHitDie: number) => {
    if (classInfo.isCustom) {
      onUpdateClass({
        ...classInfo,
        hitDie: newHitDie,
      });
      // Also update the character's hitDice string
      onUpdateHitDice(`${level}d${newHitDie}`);
    }
  };

  // Update hitDice string when level or class changes
  React.useEffect(() => {
    let hitDie: number;
    if (!classInfo.isCustom) {
      hitDie = CLASS_HIT_DICE[classInfo.name] || 8;
    } else {
      hitDie = classInfo.hitDie || 8;
    }

    const expectedHitDice = `${level}d${hitDie}`;
    if (hitDice !== expectedHitDice) {
      onUpdateHitDice(expectedHitDice);
    }
  }, [
    level,
    classInfo.name,
    classInfo.hitDie,
    classInfo.isCustom,
    hitDice,
    onUpdateHitDice,
  ]);

  return (
    <div
      className={`rounded-lg border border-purple-200 bg-white p-4 shadow ${className}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <Dice6 size={18} className="text-purple-600" />
        <h3 className="text-sm font-medium text-gray-700">Hit Dice</h3>
      </div>

      {/* Hit Dice Display */}
      <div className="mb-4 text-center">
        <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-4">
          <div className="text-2xl font-bold text-purple-800">
            {getDisplayHitDice()}
          </div>
          <div className="mt-1 text-xs text-purple-600">
            Level {level} • d{getCurrentHitDie()} hit die
          </div>
        </div>
      </div>

      {/* Custom Class Hit Die Selection */}
      {classInfo.isCustom && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Select Hit Die for Custom Class
          </label>
          <FancySelect
            options={HIT_DIE_OPTIONS.map(option => ({
              value: option.value,
              label: option.label,
              description:
                option.value === 6
                  ? 'Wizard, Sorcerer'
                  : option.value === 8
                    ? 'Most classes'
                    : option.value === 10
                      ? 'Fighter, Paladin, Ranger'
                      : 'Barbarian',
            }))}
            value={getCurrentHitDie()}
            onChange={value => handleCustomHitDieChange(value as number)}
            color="purple"
          />
        </div>
      )}

      {/* Standard Class Info */}
      {!classInfo.isCustom && classInfo.name && (
        <div className="text-center">
          <div className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs text-purple-700">
            <Info size={12} />
            <span>Auto-set for {classInfo.name}</span>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-3 text-center text-xs text-gray-500">
        <p>Hit dice are used for healing during short rests</p>
        <p>Roll your hit die + CON modifier to regain HP</p>
      </div>
    </div>
  );
}
