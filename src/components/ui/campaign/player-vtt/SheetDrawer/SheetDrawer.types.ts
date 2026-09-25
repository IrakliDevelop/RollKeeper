import type {
  AbilityName,
  SkillName,
  Spell,
  SpellSlot,
} from '@/types/character';
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

export interface SaveRowView {
  ability: AbilityName;
  name: string;
  modifier: number;
  proficient: boolean;
}

// none | proficient | expertise
export type SkillProfLevel = 0 | 1 | 2;

export interface SkillRowView {
  skill: SkillName;
  name: string;
  abilityAbbr: string;
  modifier: number;
  passive: number;
  level: SkillProfLevel;
}

export interface ProficiencyGroupView {
  label: string;
  items: string[];
}

export interface SpellRowView {
  spell: Spell;
  prepared: boolean;
  alwaysPrepared: boolean;
  castable: boolean;
}

export interface SpellGroupView {
  level: number;
  label: string;
  slot: SpellSlot | null;
  spells: SpellRowView[];
}

export interface FeatureRowView {
  id: string;
  kind: 'extended' | 'trait';
  name: string;
  tag: string;
  description: string;
  maxUses: number;
  usedUses: number;
}

export interface FeatureGroupView {
  key: string;
  label: string;
  features: FeatureRowView[];
}

export interface ConditionToggleView {
  name: string;
  activeId: string | null;
}

/** A non-standard active condition (buff, custom, DM-library) for the Effects tab. */
export interface OtherConditionView {
  id: string;
  name: string;
  kind: 'buff' | 'debuff' | 'neutral';
  count: number;
  source: string;
}

/** A read-only active disease for the Effects tab. */
export interface DiseaseView {
  id: string;
  name: string;
  source: string;
}

export interface OtherEffectsView {
  conditions: OtherConditionView[];
  diseases: DiseaseView[];
}
