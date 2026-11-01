import { SKILL_ABILITY_MAP, SKILL_NAMES } from '@/utils/constants';
import {
  nextSkillProficiency,
  type ProficiencyLevel,
} from '@/components/ui/game/ProficiencyDot';
import type { AbilitiesSectionProps } from './AbilitiesSection.types';
import type {
  AbilityName,
  SkillName,
  SkillProficiency,
} from '@/types/character';

/** Block order: STR DEX CON / INT WIS CHA. */
export const ABILITY_ORDER: AbilityName[] = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
];

/** One alphabetical list, independent of the declaration order of the labels. */
export const ALPHABETICAL_SKILLS = (
  Object.keys(SKILL_NAMES) as SkillName[]
).sort((first, second) =>
  SKILL_NAMES[first].localeCompare(SKILL_NAMES[second], 'en')
);

/** Each ability's skills, in the sheet's (alphabetical) skill order. */
export const SKILLS_BY_ABILITY: Record<AbilityName, SkillName[]> =
  Object.fromEntries(
    ABILITY_ORDER.map(ability => [
      ability,
      ALPHABETICAL_SKILLS.filter(skill => SKILL_ABILITY_MAP[skill] === ability),
    ])
  ) as Record<AbilityName, SkillName[]>;

/**
 * The dot a skill shows. Expertise counts only on a proficient skill (as
 * the bonus does); Jack of All Trades shows a half dot on the rest.
 */
export function skillLevel(
  skill: SkillProficiency | undefined,
  jackOfAllTrades: boolean
): ProficiencyLevel {
  if (skill?.proficient) return skill.expertise ? 'expertise' : 'proficient';
  return jackOfAllTrades ? 'half' : 'none';
}

/**
 * A tap on an edit-mode skill dot, with the store's existing actions:
 * none or half → proficient, proficient → expertise, expertise → none.
 * Expertise goes first on the way down, so no reader ever sees expertise
 * without proficiency.
 */
export function applySkillDotTap(
  skill: SkillName,
  level: ProficiencyLevel,
  {
    onUpdateSkillProficiency,
    onUpdateSkillExpertise,
  }: Pick<
    AbilitiesSectionProps,
    'onUpdateSkillProficiency' | 'onUpdateSkillExpertise'
  >
): void {
  const next = nextSkillProficiency(level);
  if (next === 'proficient') {
    onUpdateSkillProficiency(skill, true);
  } else if (next === 'expertise') {
    onUpdateSkillExpertise(skill, true);
  } else {
    onUpdateSkillExpertise(skill, false);
    onUpdateSkillProficiency(skill, false);
  }
}
