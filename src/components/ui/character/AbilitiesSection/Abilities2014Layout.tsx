'use client';

import { Section } from '@/components/ui/layout/section';
import type { AbilityDisplay } from '@/components/ui/game/abilityNumbers';
import type { ProficiencyLevel } from '@/components/ui/game/ProficiencyDot';
import { SKILL_ABILITY_MAP } from '@/utils/constants';
import type { AbilityName, SkillName } from '@/types/character';
import { AbilityScoreBlock } from './AbilityScoreBlock';
import { SavingThrowRow } from './SavingThrowRow';
import { SkillRow } from './SkillRow';
import {
  ABILITY_ORDER,
  ALPHABETICAL_SKILLS,
  skillLevel,
} from './AbilitiesSection.utils';
import type { AbilitiesSectionProps } from './AbilitiesSection.types';

const NONE: AbilityName[] = [];

interface Abilities2014LayoutProps extends AbilitiesSectionProps {
  abilityDisplay: AbilityDisplay;
  animateSwap: boolean;
  onDotTap: (skill: SkillName, level: ProficiencyLevel) => void;
}

/** Separate score, saving throw and alphabetical skill groups; shared game data. */
export function Abilities2014Layout({
  abilities,
  savingThrows,
  skills,
  jackOfAllTrades,
  getSavingThrowModifier,
  getSkillModifier,
  onUpdateAbilityScore,
  onRollAbilityCheck,
  onUpdateSavingThrowProficiency,
  onRollSavingThrow,
  onRollSkillCheck,
  onToggleSkillBonusAbility,
  abilityDisplay,
  animateSwap,
  onDotTap,
  editing = true,
}: Abilities2014LayoutProps) {
  return (
    <div
      data-ability-layout="2014"
      className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
    >
      <div className="min-w-0 space-y-6">
        <Section heading="Ability scores" level={3}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 lg:grid-cols-3">
            {ABILITY_ORDER.map(ability => (
              <AbilityScoreBlock
                key={ability}
                ability={ability}
                score={abilities[ability]}
                saveProficient={savingThrows[ability]?.proficient ?? false}
                abilityDisplay={abilityDisplay}
                animateSwap={animateSwap}
                editing={editing}
                onScoreChange={onUpdateAbilityScore}
                onRollCheck={onRollAbilityCheck}
              />
            ))}
          </div>
        </Section>
        <Section heading="Saving throws" level={3}>
          <ul className="divide-divider divide-y">
            {ABILITY_ORDER.map(ability => (
              <li key={ability} data-saving-throw={ability}>
                <SavingThrowRow
                  variant="list"
                  ability={ability}
                  save={getSavingThrowModifier(ability)}
                  proficient={savingThrows[ability]?.proficient ?? false}
                  editing={editing}
                  onToggleProficiency={onUpdateSavingThrowProficiency}
                  onRoll={onRollSavingThrow}
                />
              </li>
            ))}
          </ul>
        </Section>
      </div>
      <Section heading="Skills" level={3} className="min-w-0">
        <ul className="divide-divider divide-y">
          {ALPHABETICAL_SKILLS.map(skill => (
            <SkillRow
              key={skill}
              skill={skill}
              ability={SKILL_ABILITY_MAP[skill]}
              level={skillLevel(skills[skill], jackOfAllTrades)}
              bonus={getSkillModifier(skill)}
              bonusAbilities={skills[skill]?.bonusAbilities ?? NONE}
              editing={editing}
              layout="2014"
              onRoll={onRollSkillCheck}
              onDotTap={onDotTap}
              onToggleBonusAbility={onToggleSkillBonusAbility}
            />
          ))}
        </ul>
      </Section>
    </div>
  );
}
