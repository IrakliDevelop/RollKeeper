import type { Spell } from '@/types/character';
import { CREATURE_TYPES, SIZES } from '@/types/bestiary';
import type { ProcessedMonster } from '@/types/bestiary';
import type {
  CampaignNPC,
  CustomCondition,
  NPCInventoryItem,
  NPCSpellcastingAbility,
  StatBlockEntry,
} from '@/types/encounter';
import { formatSize } from '@/utils/bestiaryUtils';
import {
  buildMonsterStatBlock,
  parseRechargeFromName,
} from '@/utils/encounterConverter';
import {
  sanitizeEntryResourceCosts,
  type NpcResourceDraft,
} from '@/utils/npcResources';

export const DEFAULT_ABILITY = 10;

function matchIgnoringCase(list: string[], value: string): string | undefined {
  const lower = value.toLowerCase();
  return list.find(entry => entry.toLowerCase() === lower);
}

/**
 * Maps a stored size ('S', 'large', 'S, M') to the matching `SIZES` entry so
 * the form's select shows it. Unknown values come back trimmed, unchanged.
 */
export function canonicalSize(raw: string): string {
  const trimmed = raw.trim();
  const first = trimmed.split(',')[0].trim();
  const direct = matchIgnoringCase(SIZES, first);
  if (direct) return direct;
  const expanded = formatSize([first]);
  return SIZES.includes(expanded) ? expanded : trimmed;
}

/** Maps a stored creature type ('humanoid') to the matching `CREATURE_TYPES` entry. */
export function canonicalCreatureType(raw: string): string {
  const trimmed = raw.trim();
  return matchIgnoringCase(CREATURE_TYPES, trimmed) ?? trimmed;
}

export const DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type PassiveKey = 'perception' | 'insight' | 'investigation';
export type PassiveScores = Record<PassiveKey, number>;

export function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function abilityModNum(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function crToProficiencyBonus(crStr: string): number {
  const cr = parseFloat(crStr);
  if (isNaN(cr)) return 2;
  if (cr <= 4) return 2;
  if (cr <= 8) return 3;
  if (cr <= 12) return 4;
  if (cr <= 16) return 5;
  if (cr <= 20) return 6;
  if (cr <= 24) return 7;
  if (cr <= 28) return 8;
  return 9;
}

export function parseHpFormula(
  formula: string
): { max: number; dieType: string } | null {
  const match = formula.match(/(\d+)d(\d+)/);
  if (!match) return null;
  return { max: parseInt(match[1], 10), dieType: `d${match[2]}` };
}

export function hasSkillProficiency(
  skillsStr: string,
  skillName: string
): boolean {
  return skillsStr.toLowerCase().includes(skillName.toLowerCase());
}

/** Every field the NPC form edits. Names match the old per-field state. */
export interface NpcFormDraft {
  name: string;
  description: string;
  avatarUrl: string;
  bestiarySourceId: string | null;
  bestiarySourceName: string;
  group: string;
  tags: string[];
  size: string;
  creatureType: string;
  alignment: string;
  ac: string;
  hp: number;
  tempHp: number;
  tempAc: string;
  xp: number;
  hpFormula: string;
  speed: string;
  /** null = follow DEX. */
  initiativeOverride: number | null;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  saves: string;
  skills: string;
  resistances: string;
  immunities: string;
  vulnerabilities: string;
  conditionImmunities: string;
  inflictableConditions: CustomCondition[];
  senses: string;
  languages: string;
  cr: string;
  hitDiceMax: number;
  hitDieCurrent: number;
  hitDieType: string;
  /** null = follow CR. */
  proficiencyOverride: number | null;
  /** null = follow ability scores. All three freeze together. */
  passivesOverride: PassiveScores | null;
  traits: StatBlockEntry[];
  actions: StatBlockEntry[];
  bonusActions: StatBlockEntry[];
  reactions: StatBlockEntry[];
  lairActions: StatBlockEntry[];
  resources: NpcResourceDraft[];
  inventoryItems: NPCInventoryItem[];
  loreHtml: string;
  spellcastingEnabled: boolean;
  casterLevel: number;
  spellcastingAbility: NPCSpellcastingAbility;
  spellAttackOverride?: number;
  spellDCOverride?: number;
  spellSlotOverrides: Record<number, number | undefined>;
  spells: Spell[];
}

export type NpcFormPatch = Partial<NpcFormDraft>;

export type NpcFormUpdate = (
  patch: NpcFormPatch | ((d: NpcFormDraft) => NpcFormPatch)
) => void;

/** The effective initiative, proficiency bonus and passives (override or derived). */
export interface NpcDerivedFields {
  initiativeModifier: number;
  proficiencyBonus: number;
  passivePerception: number;
  passiveInsight: number;
  passiveInvestigation: number;
}

export function emptyDraft(): NpcFormDraft {
  return {
    name: '',
    description: '',
    avatarUrl: '',
    bestiarySourceId: null,
    bestiarySourceName: '',
    group: '',
    tags: [],
    size: 'Medium',
    creatureType: 'Humanoid',
    alignment: '',
    ac: '10',
    hp: 10,
    tempHp: 0,
    tempAc: '',
    xp: 0,
    hpFormula: '',
    speed: '30 ft.',
    initiativeOverride: null,
    str: DEFAULT_ABILITY,
    dex: DEFAULT_ABILITY,
    con: DEFAULT_ABILITY,
    int: DEFAULT_ABILITY,
    wis: DEFAULT_ABILITY,
    cha: DEFAULT_ABILITY,
    saves: '',
    skills: '',
    resistances: '',
    immunities: '',
    vulnerabilities: '',
    conditionImmunities: '',
    inflictableConditions: [],
    senses: '',
    languages: '',
    cr: '',
    hitDiceMax: 0,
    hitDieCurrent: 0,
    hitDieType: 'd8',
    proficiencyOverride: null,
    passivesOverride: null,
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    lairActions: [],
    resources: [],
    inventoryItems: [],
    loreHtml: '',
    spellcastingEnabled: false,
    casterLevel: 1,
    spellcastingAbility: 'intelligence',
    spellAttackOverride: undefined,
    spellDCOverride: undefined,
    spellSlotOverrides: {},
    spells: [],
  };
}

/**
 * Hydrates the form from a saved NPC. Each source is read on its own: the
 * record's resources, hit dice, PB and passives survive whether or not the NPC
 * has a stat block (V195).
 */
export function draftFromNpc(npc: CampaignNPC): NpcFormDraft {
  const d = emptyDraft();
  const sb = npc.monsterStatBlock;

  d.name = npc.name;
  d.description = npc.description ?? '';
  d.ac = String(npc.armorClass ?? '10');
  d.hp = npc.maxHp;
  d.tempHp = npc.tempHp ?? 0;
  d.tempAc = npc.tempAc != null ? String(npc.tempAc) : '';
  d.xp = npc.xp ?? 0;
  d.speed = npc.speed;
  d.avatarUrl = npc.avatarUrl ?? '';
  d.bestiarySourceId = npc.bestiarySourceId ?? null;
  d.bestiarySourceName = npc.bestiarySourceId ? npc.name : '';
  d.loreHtml = npc.loreHtml ?? '';
  // These arrays share references with the stored record and the baseline, so
  // every writer must copy, never mutate.
  d.inventoryItems = npc.inventory ?? [];
  d.resources = npc.resources?.map(r => ({ ...r })) ?? [];
  d.group = npc.group ?? '';
  d.tags = npc.tags ?? [];

  if (npc.spellcasting) {
    d.spellcastingEnabled = true;
    d.casterLevel = npc.spellcasting.casterLevel;
    d.spellcastingAbility = npc.spellcasting.ability;
    d.spellAttackOverride = npc.spellcasting.spellAttackBonus;
    d.spellDCOverride = npc.spellcasting.spellSaveDC;
    const overrides: Record<number, number | undefined> = {};
    if (npc.spellcasting.slotOverrides) {
      for (const [lvl, count] of Object.entries(
        npc.spellcasting.slotOverrides
      )) {
        overrides[Number(lvl)] = Number(count);
      }
    }
    d.spellSlotOverrides = overrides;
    d.spells = npc.spellcasting.spells ?? [];
  }

  d.initiativeOverride = npc.initiativeModifier ?? null;
  d.proficiencyOverride = npc.proficiencyBonus ?? null;

  if (
    npc.passivePerception !== undefined ||
    npc.passiveInsight !== undefined ||
    npc.passiveInvestigation !== undefined
  ) {
    d.passivesOverride = {
      perception: npc.passivePerception ?? 10,
      insight: npc.passiveInsight ?? 10,
      investigation: npc.passiveInvestigation ?? 10,
    };
  }

  if (npc.hitDice) {
    d.hitDiceMax = npc.hitDice.max;
    d.hitDieCurrent = npc.hitDice.current;
    d.hitDieType = npc.hitDice.dieType;
  }

  const scores = sb ?? npc.abilityScores;
  if (scores) {
    d.str = scores.str;
    d.dex = scores.dex;
    d.con = scores.con;
    d.int = scores.int;
    d.wis = scores.wis;
    d.cha = scores.cha;
  }

  if (sb) {
    d.size = canonicalSize(sb.size || 'Medium');
    d.creatureType = canonicalCreatureType(sb.type || 'Humanoid');
    d.alignment = sb.alignment || '';
    d.hpFormula = sb.hpFormula || '';
    d.saves = sb.saves || '';
    d.skills = sb.skills || '';
    d.resistances = sb.resistances || '';
    d.immunities = sb.immunities || '';
    d.vulnerabilities = sb.vulnerabilities || '';
    d.conditionImmunities = Array.isArray(sb.conditionImmunities)
      ? sb.conditionImmunities.join(', ')
      : '';
    // Stat-block loops must guard `?? []`: older records lack the field.
    d.inflictableConditions = (sb.inflictableConditions ?? []).map(c => ({
      ...c,
    }));
    d.senses = sb.senses || '';
    d.languages = sb.languages || '';
    d.cr = sb.cr || '';
    d.traits = sanitizeEntryResourceCosts(
      sb.traits?.map(t => ({ ...t })) ?? []
    );
    d.actions = sanitizeEntryResourceCosts(
      sb.actions?.map(a => ({ ...a })) ?? []
    );
    d.bonusActions = sanitizeEntryResourceCosts(
      sb.bonusActions?.map(b => ({ ...b })) ?? []
    );
    d.reactions = sanitizeEntryResourceCosts(
      sb.reactions?.map(r => ({ ...r })) ?? []
    );
    d.lairActions = sanitizeEntryResourceCosts(
      sb.lairActions?.map(l => ({ ...l })) ?? []
    );
  }

  return d;
}

/**
 * Applies a bestiary import over `current`. Avatar, group, tags, resources,
 * inventory, lore and spellcasting keep their current values; the three
 * overrides are cleared so initiative, PB and passives follow the new scores.
 */
export function draftFromMonster(
  monster: ProcessedMonster,
  current: NpcFormDraft
): NpcFormDraft {
  const sb = buildMonsterStatBlock(monster);
  const autoUses = (entry: { name: string; text: string; uses?: number }) => {
    if (entry.uses !== undefined) return { ...entry };
    const parsed = parseRechargeFromName(entry.name);
    return parsed.maxUses ? { ...entry, uses: parsed.maxUses } : { ...entry };
  };

  const next: NpcFormDraft = {
    ...current,
    name: monster.name,
    description: '',
    ac: String(monster.acValue),
    hp: monster.hpAverage,
    tempHp: 0,
    tempAc: '',
    xp: 0,
    hpFormula: monster.hpFormula,
    speed: sb.speed,
    size: canonicalSize(sb.size),
    creatureType: canonicalCreatureType(sb.type),
    alignment: sb.alignment,
    str: sb.str,
    dex: sb.dex,
    con: sb.con,
    int: sb.int,
    wis: sb.wis,
    cha: sb.cha,
    saves: sb.saves,
    skills: sb.skills,
    resistances: sb.resistances,
    immunities: sb.immunities,
    vulnerabilities: sb.vulnerabilities,
    conditionImmunities: Array.isArray(sb.conditionImmunities)
      ? sb.conditionImmunities.join(', ')
      : '',
    senses: sb.senses,
    languages: sb.languages,
    cr: sb.cr,
    traits: sb.traits.map(autoUses),
    actions: sb.actions.map(autoUses),
    bonusActions: sb.bonusActions.map(autoUses),
    reactions: sb.reactions.map(autoUses),
    lairActions: [],
    inflictableConditions: [],
    bestiarySourceId: monster.id,
    bestiarySourceName: monster.name,
    initiativeOverride: null,
    proficiencyOverride: null,
    passivesOverride: null,
  };

  const parsedHd = parseHpFormula(monster.hpFormula);
  if (parsedHd) {
    next.hitDiceMax = parsedHd.max;
    next.hitDieCurrent = parsedHd.max;
    next.hitDieType = DIE_TYPES.includes(parsedHd.dieType)
      ? parsedHd.dieType
      : 'd8';
  }

  return next;
}

/** Effective initiative, PB and passives: the override when set, else derived. */
export function deriveAutoFields(draft: NpcFormDraft): NpcDerivedFields {
  const proficiencyBonus =
    draft.proficiencyOverride ?? crToProficiencyBonus(draft.cr);
  const wisM = abilityModNum(draft.wis);
  const hasPerception = hasSkillProficiency(draft.skills, 'perception');
  const passives: PassiveScores = draft.passivesOverride ?? {
    perception: 10 + wisM + (hasPerception ? proficiencyBonus : 0),
    insight: 10 + wisM,
    investigation: 10 + abilityModNum(draft.int),
  };
  return {
    initiativeModifier: draft.initiativeOverride ?? abilityModNum(draft.dex),
    proficiencyBonus,
    passivePerception: passives.perception,
    passiveInsight: passives.insight,
    passiveInvestigation: passives.investigation,
  };
}

/** Editing one passive freezes the other two at their current effective values. */
export function withPassiveOverride(
  draft: NpcFormDraft,
  key: PassiveKey,
  value: number
): NpcFormPatch {
  const f = deriveAutoFields(draft);
  return {
    passivesOverride: {
      perception: f.passivePerception,
      insight: f.passiveInsight,
      investigation: f.passiveInvestigation,
      [key]: value,
    },
  };
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false;
  }
  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;
  if (aIsArray) {
    const bArr = b as unknown[];
    return (
      a.length === bArr.length &&
      a.every((item, i) => valuesEqual(item, bArr[i]))
    );
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
  for (const key of keys) {
    if (!valuesEqual(aObj[key], bObj[key])) return false;
  }
  return true;
}

/**
 * Structural equality. Arrays compare in order; a plain-object key set to
 * `undefined` equals a missing key; `null` never equals `undefined`.
 */
export function draftsEqual(a: NpcFormDraft, b: NpcFormDraft): boolean {
  return valuesEqual(a, b);
}
