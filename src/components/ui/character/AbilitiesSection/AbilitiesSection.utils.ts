import { SKILL_ABILITY_MAP, SKILL_NAMES } from '@/utils/constants';
import type { ProficiencyLevel } from '@/components/ui/game/ProficiencyDot';
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

/** Each ability's skills, in the sheet's (alphabetical) skill order. */
export const SKILLS_BY_ABILITY: Record<AbilityName, SkillName[]> =
  Object.fromEntries(
    ABILITY_ORDER.map(ability => [
      ability,
      (Object.keys(SKILL_NAMES) as SkillName[]).filter(
        skill => SKILL_ABILITY_MAP[skill] === ability
      ),
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
