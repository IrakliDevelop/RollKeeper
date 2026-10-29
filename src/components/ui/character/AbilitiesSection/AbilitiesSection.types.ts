import type { AbilityName, CharacterState, SkillName } from '@/types/character';

export interface AbilitiesSectionProps {
  abilities: CharacterState['abilities'];
  savingThrows: CharacterState['savingThrows'];
  skills: CharacterState['skills'];
  jackOfAllTrades: boolean;
  /** The save bonus as the sheet computes it (proficiency, items, custom). */
  getSavingThrowModifier: (ability: AbilityName) => number;
  /** The skill bonus as the sheet computes it (incl. Jack of All Trades and bonus abilities). */
  getSkillModifier: (skill: SkillName) => number;
  onUpdateAbilityScore: (ability: AbilityName, score: number) => void;
  onRollAbilityCheck: (ability: AbilityName) => void;
  onUpdateSavingThrowProficiency: (
    ability: AbilityName,
    proficient: boolean
  ) => void;
  onRollSavingThrow: (ability: AbilityName) => void;
  onUpdateSkillProficiency: (skill: SkillName, proficient: boolean) => void;
  onUpdateSkillExpertise: (skill: SkillName, expertise: boolean) => void;
  onToggleJackOfAllTrades: () => void;
  onRollSkillCheck: (skill: SkillName) => void;
  onToggleSkillBonusAbility?: (skill: SkillName, ability: AbilityName) => void;
  /**
   * Sheet mode: false is play mode (names and save lines roll, build values
   * are plain). Defaults to true (editable) for callers outside the
   * character sheet.
   */
  editing?: boolean;
}
