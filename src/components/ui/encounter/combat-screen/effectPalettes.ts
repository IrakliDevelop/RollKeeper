export interface EffectPaletteEntry {
  name: string;
  kind: 'buff' | 'debuff';
}

export const DEBUFF_PALETTE: EffectPaletteEntry[] = [
  { name: 'Blinded', kind: 'debuff' },
  { name: 'Charmed', kind: 'debuff' },
  { name: 'Deafened', kind: 'debuff' },
  { name: 'Frightened', kind: 'debuff' },
  { name: 'Grappled', kind: 'debuff' },
  { name: 'Incapacitated', kind: 'debuff' },
  { name: 'Invisible', kind: 'debuff' },
  { name: 'Paralyzed', kind: 'debuff' },
  { name: 'Petrified', kind: 'debuff' },
  { name: 'Poisoned', kind: 'debuff' },
  { name: 'Prone', kind: 'debuff' },
  { name: 'Restrained', kind: 'debuff' },
  { name: 'Stunned', kind: 'debuff' },
  { name: 'Unconscious', kind: 'debuff' },
  { name: 'Exhaustion', kind: 'debuff' },
];

export const BUFF_PALETTE: EffectPaletteEntry[] = [
  { name: 'Bless', kind: 'buff' },
  { name: 'Haste', kind: 'buff' },
  { name: 'Guidance', kind: 'buff' },
  { name: 'Heroism', kind: 'buff' },
  { name: 'Aid', kind: 'buff' },
  { name: 'Shield of Faith', kind: 'buff' },
  { name: 'Rage', kind: 'buff' },
  { name: 'Inspiration', kind: 'buff' },
  { name: 'Blur', kind: 'buff' },
  { name: 'Mirror Image', kind: 'buff' },
  { name: 'Sanctuary', kind: 'buff' },
  { name: "Hexblade's Curse", kind: 'buff' },
];
