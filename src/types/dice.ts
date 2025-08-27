// Dice roll result types for 3D Dice Box library

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
