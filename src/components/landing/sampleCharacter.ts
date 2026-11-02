import type { AbilityName } from '@/types/character';

export type DemoSlotLevel = 1 | 2 | 3;

export interface DemoSheetState {
  name: string;
  className: string;
  level: number;
  hp: { current: number; max: number; temporary: number };
  ac: number;
  abilities: Record<AbilityName, number>;
  saveProficient: AbilityName[];
  slots: Record<DemoSlotLevel, { max: number; used: number }>;
  inspired: boolean;
}

/**
 * The landing page's sample character: a level 5 cleric with rules-correct
 * numbers (8 + 4 × 5 + 5 × Con +2 = 38 HP, 4/3/2 slots, Wisdom and Charisma
 * saves, AC 18 from chain mail and a shield). It lives in React state only
 * and is never written to a store or to browser storage.
 */
export const SAMPLE_CHARACTER: DemoSheetState = {
  name: 'Wren Hollis',
  className: 'Cleric',
  level: 5,
  hp: { current: 38, max: 38, temporary: 0 },
  ac: 18,
  abilities: {
    strength: 12,
    dexterity: 10,
    constitution: 14,
    intelligence: 10,
    wisdom: 17,
    charisma: 13,
  },
  saveProficient: ['wisdom', 'charisma'],
  slots: {
    1: { max: 4, used: 1 },
    2: { max: 3, used: 0 },
    3: { max: 2, used: 0 },
  },
  inspired: true,
};

export const DEMO_DAMAGE = 12;
export const DEMO_HEALING = 7;
export const DEMO_TEMP_HP = 5;
