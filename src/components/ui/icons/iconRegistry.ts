import {
  AlertTriangle,
  Anvil,
  Backpack,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  CircleHelp,
  Coins,
  Crosshair,
  Dice6,
  Eye,
  Flame,
  Gem,
  Hammer,
  Heart,
  HeartCrack,
  Map,
  MapPin,
  Package,
  PawPrint,
  RotateCcw,
  ScrollText,
  Shield,
  Skull,
  Sparkles,
  Star,
  Sun,
  Swords,
  Target,
  Telescope,
  User,
  Users,
  WandSparkles,
  Wind,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Canonical semantic icons for RollKeeper.
 *
 * Call sites use meanings, not Lucide component names. This keeps a concept
 * visually consistent and makes changing it a one-line edit here.
 */
export const ICONS = {
  abilities: Zap,
  armor: Shield,
  attack: Swords,
  calendar: CalendarDays,
  character: User,
  concentration: Brain,
  confirm: Check,
  criticalFailure: HeartCrack,
  criticalSuccess: Star,
  currency: Coins,
  damage: Flame,
  dice: Dice6,
  error: AlertTriangle,
  features: ScrollText,
  healing: Heart,
  inspiration: Sparkles,
  inventory: Backpack,
  item: Package,
  location: MapPin,
  magicItem: Gem,
  map: Map,
  monster: Skull,
  party: Users,
  proficiencies: Wrench,
  rangedAttack: Crosshair,
  reaction: Zap,
  reset: RotateCcw,
  save: Shield,
  search: Telescope,
  spell: WandSparkles,
  spellbook: BookOpen,
  summon: PawPrint,
  target: Target,
  tool: Hammer,
  unknown: CircleHelp,
  visibility: Eye,
  weapon: Swords,
  weaponCraft: Anvil,
  weatherClear: Sun,
  weatherWind: Wind,
  remove: X,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export const SPELL_SCHOOL_ICONS = {
  Abjuration: 'armor',
  Conjuration: 'summon',
  Divination: 'visibility',
  Enchantment: 'inspiration',
  Evocation: 'damage',
  Illusion: 'inspiration',
  Necromancy: 'monster',
  Transmutation: 'reset',
} as const satisfies Record<string, IconName>;

export const ITEM_CATEGORY_ICONS = {
  weapon: 'weapon',
  armor: 'armor',
  tool: 'tool',
  misc: 'item',
  magic: 'magicItem',
  consumable: 'healing',
  treasure: 'magicItem',
} as const satisfies Record<string, IconName>;

export const MAGIC_ITEM_CATEGORY_ICONS = {
  wondrous: 'magicItem',
  ring: 'magicItem',
  wand: 'spell',
  staff: 'spell',
  rod: 'spell',
  armor: 'armor',
  shield: 'armor',
  potion: 'healing',
  scroll: 'features',
  artifact: 'magicItem',
  other: 'item',
} as const satisfies Record<string, IconName>;

export function getIconName<T extends string>(
  mapping: Partial<Record<T, IconName>>,
  value: T | null | undefined,
  fallback: IconName = 'unknown'
): IconName {
  return (value && mapping[value]) || fallback;
}
