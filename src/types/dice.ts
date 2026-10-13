import type { Skin } from 'pollyroll';

// Dice roll result types. Values come from Pollyroll; the shape is what the sheet reads.

export interface DiceResult {
  sides: number;
  dieType: string; // e.g., "d12", "d20", etc.
  groupId: number;
  rollId: number;
  theme: string;
  themeColor: string;
  value: number;
}

export type DiceRollResults = DiceResult[];

export interface ParsedDiceNotation {
  count: number;
  sides: number;
  modifier: number;
  originalNotation: string;
}

/** Per-character Pollyroll appearance. Omitted characters use the classic set. */
export interface CharacterDiceSet {
  skin: Skin;
  /** Largest die size. Rolls with many dice shrink to fit. */
  dieScale: number;
}

export interface RollSummary {
  diceResults: DiceResult[];
  individualValues: number[];
  total: number;
  modifier: number;
  finalTotal: number;
  notation: string;
  rollTime: Date;
  rollId: string;
}
