import type { AbilityName } from '@/types/character';

export type SheetTabId = 'overview'; // PR 2/3 extend the union

export const SHEET_TAB_STORAGE_KEY = 'rollkeeper-map-sheet-tab';

export interface SheetHeaderView {
  initial: string;
  avatar?: string;
  name: string;
  level: number;
  subtitle: string;
  concentration: string | null;
  conditions: string[];
  exhaustion: number;
  inspired: boolean;
}

export interface SheetVitalsView {
  hpCurrent: number;
  hpMax: number;
  hpTemp: number;
  hpPercent: number;
  ac: number;
  initiative: number;
  speed: number;
  proficiencyBonus: number;
}

export interface AbilityCellView {
  ability: AbilityName;
  abbr: string;
  name: string;
  score: number;
  modifier: number;
  save: number;
  saveProficient: boolean;
}

export interface HitDiceView {
  dieType: string;
  remaining: number;
  max: number;
}

export interface SlotSummaryView {
  label: string;
  remaining: number;
  max: number;
}

export interface PassiveView {
  label: string;
  value: string;
}
