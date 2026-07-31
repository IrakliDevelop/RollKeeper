import { CharacterAbilities } from '@/types/character';

export type ClassResourceIcon =
  | 'music'
  | 'flame'
  | 'sun'
  | 'paw-print'
  | 'wind'
  | 'zap'
  | 'hand-fist'
  | 'sparkles'
  | 'heart-handshake'
  | 'wand-sparkles'
  | 'book-open';

export type ClassResourceColor =
  | 'indigo'
  | 'red'
  | 'amber'
  | 'emerald'
  | 'blue'
  | 'orange'
  | 'violet'
  | 'yellow'
  | 'green'
  | 'purple';

export interface ClassResourceContext {
  classLevel: number;
  abilities: CharacterAbilities;
  proficiencyBonus: number;
}

/** What a short rest restores: everything, one use, or nothing. */
export type ShortRestReset = 'all' | 1 | 0;

export interface ClassResourceDefinition {
  id: string;
  className: string;
  edition: 'XPHB' | 'PHB';
  name: string;
  icon: ClassResourceIcon;
  color: ClassResourceColor;
  displayStyle: 'pips' | 'pool';
  minLevel: number;
  getMaxUses: (ctx: ClassResourceContext) => number;
  getDie?: (classLevel: number) => string;
  getShortRestReset: (classLevel: number) => ShortRestReset;
  /** Long rest always restores everything in v1. */
  longRestReset: 'all';
  getDescription?: (ctx: ClassResourceContext) => string;
}

export interface ActiveClassResource {
  definition: ClassResourceDefinition;
  classLevel: number;
  maxUses: number;
  die?: string;
  usesExpended: number;
  usesRemaining: number;
}
