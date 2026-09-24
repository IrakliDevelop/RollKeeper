import type { AbilityName } from '@/types/character';
import type { SpellAoe } from '@/types/spellAoe';

export type SheetTabId =
  | 'overview'
  | 'abilities'
  | 'spells'
  | 'features'
  | 'effects';

export const SHEET_TAB_IDS: readonly SheetTabId[] = [
  'overview',
  'abilities',
  'spells',
  'features',
  'effects',
];

export const SHEET_TAB_STORAGE_KEY = 'rollkeeper-map-sheet-tab';

export type SheetRoll = (label: string, modifier: number) => Promise<void>;

export interface SheetSpellCastingProps {
  onCastPlacement: (spellName: string, aoe: NonNullable<SpellAoe>) => void;
  connectionLive: boolean;
  hasPendingPlacement: boolean;
  onCancelPlacement: () => void;
}

// Players roll physical dice at the table; flip to true when integrated dice rolling ships.
export const SHEET_DICE_ROLLS_ENABLED = false;

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
