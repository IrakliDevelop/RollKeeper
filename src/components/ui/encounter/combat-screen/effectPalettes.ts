import type { CustomCondition } from '@/types/encounter';

export interface EffectPaletteEntry {
  name: string;
  kind: 'buff' | 'debuff' | 'neutral';
  origin?: 'official' | 'custom' | 'spell';
  description?: string;
  rulesSource?: string;
  /** Set for DM library entries: applying carries the icon + description. */
  condition?: CustomCondition;
}

export const DEBUFF_PALETTE: EffectPaletteEntry[] = [
  { name: 'Blinded', kind: 'debuff', origin: 'official' },
  { name: 'Charmed', kind: 'debuff', origin: 'official' },
  { name: 'Deafened', kind: 'debuff', origin: 'official' },
  { name: 'Frightened', kind: 'debuff', origin: 'official' },
  { name: 'Grappled', kind: 'debuff', origin: 'official' },
  { name: 'Incapacitated', kind: 'debuff', origin: 'official' },
  { name: 'Invisible', kind: 'debuff', origin: 'official' },
  { name: 'Paralyzed', kind: 'debuff', origin: 'official' },
  { name: 'Petrified', kind: 'debuff', origin: 'official' },
  { name: 'Poisoned', kind: 'debuff', origin: 'official' },
  { name: 'Prone', kind: 'debuff', origin: 'official' },
  { name: 'Restrained', kind: 'debuff', origin: 'official' },
  { name: 'Stunned', kind: 'debuff', origin: 'official' },
  { name: 'Unconscious', kind: 'debuff', origin: 'official' },
  { name: 'Exhaustion', kind: 'debuff', origin: 'official' },
];

export const BUFF_PALETTE: EffectPaletteEntry[] = [
  { name: 'Bless', kind: 'buff', origin: 'spell' },
  { name: 'Haste', kind: 'buff', origin: 'spell' },
  { name: 'Guidance', kind: 'buff', origin: 'spell' },
  { name: 'Heroism', kind: 'buff', origin: 'spell' },
  { name: 'Aid', kind: 'buff', origin: 'spell' },
  { name: 'Shield of Faith', kind: 'buff', origin: 'spell' },
  { name: 'Rage', kind: 'buff' },
  { name: 'Inspiration', kind: 'buff' },
  { name: 'Blur', kind: 'buff', origin: 'spell' },
  { name: 'Mirror Image', kind: 'buff', origin: 'spell' },
  { name: 'Sanctuary', kind: 'buff', origin: 'spell' },
  { name: "Hexblade's Curse", kind: 'buff' },
];

export const SPELL_BUFF_NAMES = BUFF_PALETTE.filter(
  entry => entry.origin === 'spell'
).map(entry => entry.name);
