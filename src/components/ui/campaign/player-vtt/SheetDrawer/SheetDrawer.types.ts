import type {
  AbilityName,
  Currency,
  MagicItemRarity,
  SkillName,
  Spell,
  SpellSlot,
} from '@/types/character';
import type { SpellAoe } from '@/types/spellAoe';

export type SheetTabId =
  | 'overview'
  | 'abilities'
  | 'spells'
  | 'inventory'
  | 'features'
  | 'effects';

export const SHEET_TAB_IDS: readonly SheetTabId[] = [
  'overview',
  'abilities',
  'spells',
  'inventory',
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

export type InventoryEntryKind = 'weapon' | 'armor' | 'magic' | 'item';

export type InventoryGroupKey =
  | 'weapons'
  | 'armor'
  | 'magic'
  | 'consumables'
  | 'gear';

export interface InventoryChargeView {
  chargeId: string;
  name: string;
  max: number;
  used: number;
}

export interface InventoryEntryView {
  id: string;
  kind: InventoryEntryKind;
  name: string;
  meta: string;
  rarity: MagicItemRarity | null;
  quantity: number | null;
  weightText: string | null;
  equippable: boolean;
  equipped: boolean;
  attunable: boolean;
  attuned: boolean;
  consumable: boolean;
  attackText: string | null; // e.g. "+7 to hit · 1d8+4 piercing"
  charges: InventoryChargeView[];
  poolText: string | null; // e.g. "Charges 3 / 7"
}

export interface InventoryGroupView {
  key: InventoryGroupKey;
  label: string;
  entries: InventoryEntryView[];
}

export interface InventorySummaryView {
  currency: { key: keyof Currency; label: string; value: number }[]; // pp, gp, ep, sp, cp order
  weight: number;
  capacity: number;
  weightPercent: number;
  attuned: number;
  attunementMax: number;
}

export type InventoryViewMode = 'list' | 'grid';

export const INVENTORY_VIEW_STORAGE_KEY = 'rollkeeper-map-sheet-inventory-view';

export type FavoriteRowView =
  | {
      key: string;
      kind: 'item';
      id: string;
      name: string;
      meta: string;
      entry: InventoryEntryView;
    }
  | {
      key: string;
      kind: 'spell';
      id: string;
      name: string;
      meta: string;
      spell: Spell;
      castable: boolean;
    }
  | {
      key: string;
      kind: 'feature';
      id: string;
      name: string;
      meta: string;
      feature: FeatureRowView;
    };
