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
 * Icon for a condition name. Lookup is case-insensitive and ignores a
 * trailing parenthetical ("Exhaustion (3)" → "exhaustion"). Unknown names
 * fall back by kind; no kind → neutral glyph. Compact-mode reveal shows the
 * full name, so a generic fallback icon loses nothing.
 */
export function getConditionIcon(
  name: string,
  kind: ConditionKind = 'neutral'
): LucideIcon {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)$/, '');
  return CONDITION_ICONS[key] ?? KIND_FALLBACK[kind];
}
