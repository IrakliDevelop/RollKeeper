'use client';

import React, { useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { SpellcastingAbility } from '@/types/character';
import { Edit3, Calculator, Zap, Shield } from 'lucide-react';
import {
  getClassSpellcastingAbility,
  getCharacterSpellcastingAbility,
  getSpellAttackString,
  getSpellSaveDCString,
  isSpellcaster,
} from '@/utils/calculations';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Switch } from '@/components/ui/forms/switch';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Badge } from '@/components/ui/layout/badge';

export const SpellcastingStats: React.FC = () => {
  const { character, updateCharacter } = useCharacterStore();
  const [showOverrides, setShowOverrides] = useState(false);

  // Check if character is a spellcaster
  const characterIsSpellcaster = isSpellcaster(character);

  if (!characterIsSpellcaster) {
    return (
      <div className="rounded-lg border-2 border-purple-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-purple-800">
          <span className="text-purple-600">✨</span>
          Spellcasting
        </h3>
        <div className="py-6 text-center text-gray-500">
          <div className="mb-2 text-4xl">🚫</div>
          <p className="font-semibold text-gray-700">Not a spellcaster</p>
          <p className="mt-1 text-sm">
            Select a spellcasting class to enable this section.
          </p>
        </div>
      </div>
    );
  }

  const currentSpellcastingAbility = getCharacterSpellcastingAbility(character);
  const classDefaultAbility = getClassSpellcastingAbility(character.class.name);

  const handleAbilityOverrideToggle = (useOverride: boolean) => {
    updateCharacter({
      spellcastingStats: {
        ...character.spellcastingStats,
        isAbilityOverridden: useOverride,
        spellcastingAbility: useOverride
          ? character.spellcastingStats.spellcastingAbility ||
            classDefaultAbility
          : null,
      },
    });
  };

  const handleAbilityChange = (ability: string) => {
    updateCharacter({
      spellcastingStats: {
        ...character.spellcastingStats,
        spellcastingAbility: ability as SpellcastingAbility,
      },
    });
  };

  const handleAttackBonusOverride = (value: string) => {
    const bonus = value === '' ? undefined : parseInt(value);
    updateCharacter({
      spellcastingStats: {
        ...character.spellcastingStats,
        spellAttackBonus: bonus,
      },
    });
  };

  const handleSaveDCOverride = (value: string) => {
    const dc = value === '' ? undefined : parseInt(value);
    updateCharacter({
      spellcastingStats: {
        ...character.spellcastingStats,
        spellSaveDC: dc,
      },
    });
  };

  return (
    <div className="rounded-lg border-2 border-purple-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b-2 border-gray-200 pb-4">
        <h3 className="flex items-center gap-2 text-lg font-bold text-purple-800">
          <span className="text-purple-600">✨</span>
          Spellcasting Statistics
        </h3>
        <Button
          onClick={() => setShowOverrides(!showOverrides)}
          variant="ghost"
          size="sm"
          title="Toggle manual overrides"
        >
          {showOverrides ? <Calculator size={20} /> : <Edit3 size={20} />}
        </Button>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Spellcasting Ability */}
        <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 font-bold text-purple-800">
              <span className="text-purple-600">🧠</span>
              Spellcasting Ability
            </h4>
            {showOverrides && (
              <Switch
                checked={character.spellcastingStats.isAbilityOverridden}
                onCheckedChange={handleAbilityOverrideToggle}
                label={character.spellcastingStats.isAbilityOverridden ? "Manual" : "Auto"}
                size="sm"
              />
            )}
          </div>

          <div className="flex items-center gap-4">
            {character.spellcastingStats.isAbilityOverridden ? (
              <div className="w-full max-w-xs">
                <SelectField
                  value={
                    character.spellcastingStats.spellcastingAbility ||
                    'intelligence'
                  }
                  onValueChange={handleAbilityChange}
                >
                  <SelectItem value="intelligence">
                    Intelligence
                    <span className="text-xs text-gray-500 block">Logic, reasoning, memory</span>
                  </SelectItem>
                  <SelectItem value="wisdom">
                    Wisdom
                    <span className="text-xs text-gray-500 block">Awareness, insight, intuition</span>
                  </SelectItem>
                  <SelectItem value="charisma">
                    Charisma
                    <span className="text-xs text-gray-500 block">Force of personality, leadership</span>
                  </SelectItem>
                </SelectField>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" size="md" className="capitalize">
                  {classDefaultAbility || 'Unknown'}
                </Badge>
                {classDefaultAbility && (
                  <span className="text-sm text-purple-600">
                    (from {character.class.name})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Attack Bonus and Save DC */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Spell Attack Bonus */}
          <div className="text-center">
            <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4 transition-all hover:border-red-300 hover:shadow-sm">
              <div className="mb-2 flex items-center justify-center gap-1 text-xs font-bold text-red-700 uppercase tracking-wide">
                <Zap size={14} />
                Spell Attack
              </div>
              {showOverrides ? (
                <Input
                  type="number"
                  value={
                    character.spellcastingStats.spellAttackBonus?.toString() ||
                    ''
                  }
                  onChange={e => handleAttackBonusOverride(e.target.value)}
                  placeholder="Auto"
                  className="mb-2 w-full text-center text-xl font-bold"
                  size="sm"
                />
              ) : (
                <div className="mb-2 text-2xl font-bold text-red-900">
                  {getSpellAttackString(character)}
                </div>
              )}
              <Badge 
                variant={character.spellcastingStats.spellAttackBonus !== undefined ? "danger" : "neutral"}
                size="sm"
              >
                {character.spellcastingStats.spellAttackBonus !== undefined
                  ? 'manual'
                  : 'auto'}
              </Badge>
            </div>
          </div>

          {/* Spell Save DC */}
          <div className="text-center">
            <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 transition-all hover:border-blue-300 hover:shadow-sm">
              <div className="mb-2 flex items-center justify-center gap-1 text-xs font-bold text-blue-700 uppercase tracking-wide">
                <Shield size={14} />
                Spell Save DC
              </div>
              {showOverrides ? (
                <Input
                  type="number"
                  value={
                    character.spellcastingStats.spellSaveDC?.toString() || ''
                  }
                  onChange={e => handleSaveDCOverride(e.target.value)}
                  placeholder="Auto"
                  className="mb-2 w-full text-center text-xl font-bold"
                  size="sm"
                />
              ) : (
                <div className="mb-2 text-2xl font-bold text-blue-900">
                  {getSpellSaveDCString(character)}
                </div>
              )}
              <Badge 
                variant={character.spellcastingStats.spellSaveDC !== undefined ? "success" : "neutral"}
                size="sm"
              >
                {character.spellcastingStats.spellSaveDC !== undefined
                  ? 'manual'
                  : 'auto'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Calculation Info */}
        {!showOverrides && currentSpellcastingAbility && (
          <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-4">
            <div className="mb-2 font-bold text-gray-800">Calculations:</div>
            <div className="space-y-1 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <Badge variant="danger" size="sm">Attack</Badge>
                <span>{currentSpellcastingAbility} modifier + proficiency</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="success" size="sm">Save DC</Badge>
                <span>8 + {currentSpellcastingAbility} modifier + proficiency</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
