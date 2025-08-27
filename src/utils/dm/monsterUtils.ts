import { CombatParticipant } from '@/types/combat';
import { ProcessedMonster } from '@/types/bestiary';
import { HitPoints } from '@/types/character';

/**
 * Convert a ProcessedMonster to a CombatParticipant
 */
export function monsterToCombatParticipant(
  monster: ProcessedMonster,
  customName?: string
): Omit<CombatParticipant, 'id' | 'turnOrder'> {
  // Parse AC (can be a string like "12 (Natural Armor)" or just "12")
  const acMatch = monster.ac.match(/(\d+)/);
  const armorClass = acMatch ? parseInt(acMatch[1]) : 10;

  // Parse HP (can be a string like "22 (4d8 + 4)" or just "22")
  const hpMatch = monster.hp.match(/(\d+)/);
  const maxHP = hpMatch ? parseInt(hpMatch[1]) : 1;

  // Parse CR for numeric comparison (unused for now but may be useful for encounter balancing)
  // const crValue = parseChallengeRating(monster.cr);

  // Calculate dexterity modifier
  const dexMod = Math.floor((monster.dex - 10) / 2);

  // Create hit points structure
  const hitPoints: HitPoints = {
    current: maxHP,
    max: maxHP,
    temporary: 0,
    calculationMode: 'manual' as const,
  };

  // Parse legendary actions if present
  const hasLegendaryActions =
    monster.legendaryActions && monster.legendaryActions.length > 0;
  const legendaryActionCount = hasLegendaryActions ? 3 : undefined; // Most monsters have 3

  return {
    type: 'monster',
    name: customName || monster.name,
    armorClass,
    hitPoints,
    hasReaction: true,
    hasBonusAction: true,
    hasLegendaryActions: legendaryActionCount,
    usedLegendaryActions: 0,
    challengeRating: monster.cr,
    initiative: 0, // Will be rolled when added to combat
    dexterityModifier: dexMod,
    position: { x: 0, y: 0 }, // Default position, will be updated by store
    conditions: [],
    monsterReference: {
      slug: monster.id,
      monsterData: monster,
    },
  };
}

/**
 * Parse challenge rating string to numeric value for comparison
 */
export function parseChallengeRating(cr: string): number {
  if (cr === '0') return 0;
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;

  const numericCR = parseFloat(cr);
  return isNaN(numericCR) ? 0 : numericCR;
}

/**
 * Get expected HP range for a monster based on CR
 */
export function getExpectedHPForCR(cr: string): { min: number; max: number } {
  const crValue = parseChallengeRating(cr);

  if (crValue === 0) return { min: 1, max: 6 };
  if (crValue <= 0.25) return { min: 7, max: 35 };
  if (crValue <= 0.5) return { min: 36, max: 49 };
  if (crValue <= 1) return { min: 50, max: 70 };
  if (crValue <= 2) return { min: 71, max: 85 };
  if (crValue <= 3) return { min: 86, max: 100 };
  if (crValue <= 4) return { min: 101, max: 115 };
  if (crValue <= 5) return { min: 116, max: 130 };
  if (crValue <= 6) return { min: 131, max: 145 };
  if (crValue <= 7) return { min: 146, max: 160 };
  if (crValue <= 8) return { min: 161, max: 175 };
  if (crValue <= 9) return { min: 176, max: 190 };
  if (crValue <= 10) return { min: 191, max: 205 };
  if (crValue <= 11) return { min: 206, max: 220 };
  if (crValue <= 12) return { min: 221, max: 235 };
  if (crValue <= 13) return { min: 236, max: 250 };
  if (crValue <= 14) return { min: 251, max: 265 };
  if (crValue <= 15) return { min: 266, max: 280 };
  if (crValue <= 16) return { min: 281, max: 295 };
  if (crValue <= 17) return { min: 296, max: 310 };
  if (crValue <= 20) return { min: 311, max: 400 };
  if (crValue <= 23) return { min: 401, max: 500 };
  if (crValue <= 26) return { min: 501, max: 600 };
  if (crValue <= 30) return { min: 601, max: 850 };

  return { min: 851, max: 1000 };
}

/**
 * Get proficiency bonus for a given CR
 */
export function getProficiencyBonusForCR(cr: string): number {
  const crValue = parseChallengeRating(cr);

  if (crValue <= 4) return 2;
  if (crValue <= 8) return 3;
  if (crValue <= 12) return 4;
  if (crValue <= 16) return 5;
  if (crValue <= 20) return 6;
  if (crValue <= 24) return 7;
  if (crValue <= 28) return 8;

  return 9;
}

/**
 * Format monster type string for display
 */
export function formatMonsterType(monster: ProcessedMonster): string {
  const type =
    typeof monster.type === 'string' ? monster.type : monster.type.type;
  const size = monster.size.join('/');
  return `${size} ${type}`;
}

/**
 * Get ability modifier from ability score
 */
export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Format ability modifier for display
 */
export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

/**
 * Calculate monster's passive perception
 */
export function calculatePassivePerception(monster: ProcessedMonster): number {
  const wisModifier = getAbilityModifier(monster.wis);
  const proficiencyBonus = getProficiencyBonusForCR(monster.cr);

  // Check if monster has perception skill
  const hasPerceptionProficiency = monster.skills
    .toLowerCase()
    .includes('perception');
  const perceptionBonus = hasPerceptionProficiency ? proficiencyBonus : 0;

  return 10 + wisModifier + perceptionBonus;
}

/**
 * Get all ability modifiers for a monster
 */
export function getMonsterAbilityModifiers(monster: ProcessedMonster) {
  return {
    str: getAbilityModifier(monster.str),
    dex: getAbilityModifier(monster.dex),
    con: getAbilityModifier(monster.con),
    int: getAbilityModifier(monster.int),
    wis: getAbilityModifier(monster.wis),
    cha: getAbilityModifier(monster.cha),
  };
}
