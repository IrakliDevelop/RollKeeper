'use client';

import { Switch } from '@/components/ui/forms/switch';
import { Section } from '@/components/ui/layout/section';
import { useUiPrefs } from '@/hooks/useUiPrefs';
import { AbilityBlock } from './AbilityBlock';
import { SkillRow } from './SkillRow';
import {
  ABILITY_ORDER,
  SKILLS_BY_ABILITY,
  skillLevel,
} from './AbilitiesSection.utils';
import type { AbilitiesSectionProps } from './AbilitiesSection.types';

export type { AbilitiesSectionProps } from './AbilitiesSection.types';

/**
 * The Stats tab's abilities: six blocks (medallion, name, save line,
 * skills) in a 1/2/3-column grid, under an "Abilities" heading with the
 * "Scores large" switch.
 */
export function AbilitiesSection({
  abilities,
  savingThrows,
  skills,
  jackOfAllTrades,
  getSavingThrowModifier,
  getSkillModifier,
  onRollAbilityCheck,
  onRollSavingThrow,
  onRollSkillCheck,
  editing = true,
}: AbilitiesSectionProps) {
  const { prefs, setPref, localChange } = useUiPrefs();

  return (
    <Section
      heading="Abilities"
      level={2}
      trailing={
        <Switch
          label="Scores large"
          size="sm"
          checked={prefs.abilityDisplay === 'score'}
          onCheckedChange={on =>
            setPref('abilityDisplay', on ? 'score' : 'modifier')
          }
        />
      }
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {ABILITY_ORDER.map(ability => {
          const abilitySkills = SKILLS_BY_ABILITY[ability];
          return (
            <AbilityBlock
              key={ability}
              ability={ability}
              score={abilities[ability]}
              save={getSavingThrowModifier(ability)}
              saveProficient={savingThrows[ability]?.proficient ?? false}
              abilityDisplay={prefs.abilityDisplay}
              animateSwap={localChange}
              editing={editing}
              onRollCheck={onRollAbilityCheck}
              onRollSave={onRollSavingThrow}
            >
              {abilitySkills.length > 0 ? (
                <ul className="mt-4">
                  {abilitySkills.map(skill => (
                    <SkillRow
                      key={skill}
                      skill={skill}
                      level={skillLevel(skills[skill], jackOfAllTrades)}
                      bonus={getSkillModifier(skill)}
                      editing={editing}
                      onRoll={onRollSkillCheck}
                    />
                  ))}
                </ul>
              ) : (
                <p className="type-small text-muted mt-4">No skills</p>
              )}
            </AbilityBlock>
          );
        })}
      </div>
    </Section>
  );
}
