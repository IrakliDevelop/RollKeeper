import type { EncounterEntity } from './encounter';

export type SummonType = 'familiar' | 'summon' | 'wild-shape';

export interface Summon {
  id: string;
  type: SummonType;
  entity: EncounterEntity;
  sourceSpellName: string;
  sourceSpellId?: string;
  castAtLevel?: number;
  requiresConcentration: boolean;
  duration?: string;
  createdAt: string;
  customName?: string;
}

/** A reusable creature template that persists across summon dismiss/death cycles */
export interface SavedCreature {
  id: string;
  name: string;
  // Core stats
  size: string;
  type: string;
  alignment: string;
  ac: number;
  hp: number;
  hpFormula?: string;
  speed: string;
  // Ability scores
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  // Optional detail fields
  saves?: string;
  skills?: string;
  resistances?: string;
  immunities?: string;
  vulnerabilities?: string;
  conditionImmunities?: string[];
  senses?: string;
  passivePerception?: number;
  languages?: string;
  cr?: string;
  // Abilities
  traits?: Array<{ name: string; text: string; uses?: number }>;
  actions?: Array<{ name: string; text: string; uses?: number }>;
  reactions?: Array<{ name: string; text: string; uses?: number }>;
  bonusActions?: Array<{ name: string; text: string; uses?: number }>;
  lairActions?: Array<{ name: string; text: string; uses?: number }>;
  // Metadata
  createdAt: string;
  updatedAt: string;
}
