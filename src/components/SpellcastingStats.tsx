'use client';

import React, { useEffect, useState } from 'react';
import { Edit3, Calculator } from 'lucide-react';
import { useCharacterStore } from '@/store/characterStore';
import { SpellcastingAbility } from '@/types/character';
import {
  getClassSpellcastingAbility,
  getCharacterSpellcastingAbility,
  getSpellAttackString,
  getSpellSaveDCString,
  isSpellcaster,
} from '@/utils/calculations';
import { Button } from '@/components/ui/forms/button';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Switch } from '@/components/ui/forms/switch';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Section } from '@/components/ui/layout/section';
import { AppIcon } from '@/components/ui/icons';

export function SpellcastingStats({ editing = false }: { editing?: boolean }) {
  const { character, updateCharacter } = useCharacterStore();
  const [showOverrides, setShowOverrides] = useState(false);

  useEffect(() => {
    if (!editing) setShowOverrides(false);
  }, [editing]);

  if (!isSpellcaster(character)) {
    return (
      <Section heading="Spellcasting" level={3}>
        <div className="text-muted py-6 text-center">
          <AppIcon name="prohibited" className="mx-auto mb-2 h-10 w-10" />
          <p className="text-body font-semibold">Not a spellcaster</p>
          <p className="mt-1 text-sm">
            Select a spellcasting class to enable this section.
          </p>
        </div>
      </Section>
    );
  }

  const currentAbility = getCharacterSpellcastingAbility(character);
  const classDefaultAbility = getClassSpellcastingAbility(character.class.name);
  const ability = character.spellcastingStats.isAbilityOverridden
    ? character.spellcastingStats.spellcastingAbility || classDefaultAbility
    : classDefaultAbility;

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

  const handleAbilityChange = (value: string) => {
    updateCharacter({
      spellcastingStats: {
        ...character.spellcastingStats,
        spellcastingAbility: value as SpellcastingAbility,
      },
    });
  };

  const handleAttackBonusOverride = (value: number | undefined) => {
    updateCharacter({
      spellcastingStats: {
        ...character.spellcastingStats,
        spellAttackBonus: value,
      },
    });
  };

  const handleSaveDCOverride = (value: number | undefined) => {
    updateCharacter({
      spellcastingStats: {
        ...character.spellcastingStats,
        spellSaveDC: value,
      },
    });
  };

  return (
    <Section
      heading="Spellcasting Statistics"
      level={3}
      trailing={
        editing ? (
          <Button
            onClick={() => setShowOverrides(!showOverrides)}
            variant="ghost"
            size="sm"
            title="Toggle manual overrides"
          >
            {showOverrides ? <Calculator size={20} /> : <Edit3 size={20} />}
          </Button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <span className="type-ui text-muted block">Spellcasting Ability</span>
          {editing && showOverrides && (
            <Switch
              checked={character.spellcastingStats.isAbilityOverridden}
              onCheckedChange={handleAbilityOverrideToggle}
              label={
                character.spellcastingStats.isAbilityOverridden
                  ? 'Manual'
                  : 'Auto'
              }
              size="sm"
            />
          )}
          {editing && character.spellcastingStats.isAbilityOverridden ? (
            <SelectField
              value={
                character.spellcastingStats.spellcastingAbility ||
                'intelligence'
              }
              onValueChange={handleAbilityChange}
            >
              <SelectItem value="intelligence">
                Intelligence
                <span className="text-muted block text-xs">
                  Logic, reasoning, memory
                </span>
              </SelectItem>
              <SelectItem value="wisdom">
                Wisdom
                <span className="text-muted block text-xs">
                  Awareness, insight, intuition
                </span>
              </SelectItem>
              <SelectItem value="charisma">
                Charisma
                <span className="text-muted block text-xs">
                  Force of personality, leadership
                </span>
              </SelectItem>
            </SelectField>
          ) : (
            <div className="type-ui text-heading capitalize">
              {ability || 'Unknown'}
              {!character.spellcastingStats.isAbilityOverridden &&
                classDefaultAbility && (
                  <span className="text-muted ml-2 text-sm normal-case">
                    (from {character.class.name})
                  </span>
                )}
            </div>
          )}
        </div>

        <div>
          <span className="type-ui text-muted block">Spell Attack</span>
          {editing && showOverrides ? (
            <NumberInput
              value={character.spellcastingStats.spellAttackBonus}
              onChange={handleAttackBonusOverride}
              allowEmpty
              placeholder="Auto"
              aria-label="Spell Attack"
              size="sm"
            />
          ) : (
            <span className="type-num-lg text-lapis-text block">
              {getSpellAttackString(character)}
            </span>
          )}
          <span className="text-muted text-xs">
            {character.spellcastingStats.spellAttackBonus !== undefined
              ? 'manual'
              : 'auto'}
          </span>
        </div>

        <div>
          <span className="type-ui text-muted block">Spell Save DC</span>
          {editing && showOverrides ? (
            <NumberInput
              value={character.spellcastingStats.spellSaveDC}
              onChange={handleSaveDCOverride}
              allowEmpty
              placeholder="Auto"
              aria-label="Spell Save DC"
              size="sm"
            />
          ) : (
            <span className="type-num-lg text-heading block">
              {getSpellSaveDCString(character)}
            </span>
          )}
          <span className="text-muted text-xs">
            {character.spellcastingStats.spellSaveDC !== undefined
              ? 'manual'
              : 'auto'}
          </span>
        </div>
      </div>

      {(!editing || !showOverrides) && currentAbility && (
        <div className="text-muted mt-3 space-y-1 text-sm">
          <div className="text-heading font-medium">Calculations:</div>
          <div>
            Attack <span>{currentAbility} modifier + proficiency</span>
          </div>
          <div>
            Save DC <span>8 + {currentAbility} modifier + proficiency</span>
          </div>
        </div>
      )}
    </Section>
  );
}
