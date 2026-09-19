import {
  Ban,
  BatteryLow,
  Biohazard,
  ChevronsDown,
  CircleDashed,
  CircleDot,
  EarOff,
  EyeOff,
  Ghost,
  Grab,
  Heart,
  Link,
  Moon,
  Mountain,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

import {
  CONDITION_ICON_REGISTRY,
  isConditionIconName,
} from '@/utils/conditionIconRegistry';

export type ConditionKind = 'buff' | 'debuff' | 'neutral';

// Canonical 5e conditions, keyed lowercase.
const CONDITION_ICONS: Record<string, LucideIcon> = {
  blinded: EyeOff,
  charmed: Heart,
  deafened: EarOff,
  exhaustion: BatteryLow,
  frightened: Ghost,
  grappled: Grab,
  incapacitated: Ban,
  invisible: CircleDashed,
  paralyzed: Zap,
  petrified: Mountain,
  poisoned: Biohazard,
  prone: ChevronsDown,
  restrained: Link,
  stunned: Sparkles,
  unconscious: Moon,
};

const KIND_FALLBACK: Record<ConditionKind, LucideIcon> = {
  buff: TrendingUp,
  debuff: TrendingDown,
  neutral: CircleDot,
};

/**
 * Icon for a condition. A valid registry `icon` (DM-chosen, possibly arriving
 * over sync) wins; an invalid or absent one falls back to the name lookup.
 * Name lookup is case-insensitive and ignores a trailing parenthetical
 * ("Exhaustion (3)" → "exhaustion"). Unknown names fall back by kind; no kind
 * → neutral glyph. Compact-mode reveal shows the full name, so a generic
 * fallback icon loses nothing.
 */
export function getConditionIcon(
  name: string,
  kind: ConditionKind = 'neutral',
  icon?: string
): LucideIcon {
  if (isConditionIconName(icon)) return CONDITION_ICON_REGISTRY[icon];
  const key = name
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)$/, '');
  return CONDITION_ICONS[key] ?? KIND_FALLBACK[kind];
}
