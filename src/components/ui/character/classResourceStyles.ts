import {
  BookOpen,
  Flame,
  HandFist,
  HeartHandshake,
  type LucideIcon,
  Music,
  PawPrint,
  Sun,
  WandSparkles,
  Wind,
  Zap,
} from 'lucide-react';

import type {
  ClassResourceColor,
  ClassResourceIcon,
} from '@/utils/classResources';

export const CLASS_RESOURCE_ICONS: Record<ClassResourceIcon, LucideIcon> = {
  music: Music,
  flame: Flame,
  sun: Sun,
  'paw-print': PawPrint,
  wind: Wind,
  zap: Zap,
  'hand-fist': HandFist,
  sparkles: Sun,
  'heart-handshake': HeartHandshake,
  'wand-sparkles': WandSparkles,
  'book-open': BookOpen,
};

/** One visual treatment for every class resource, regardless of stored hue. */
export const CLASS_RESOURCE_STYLE = {
  badge: 'border-divider bg-surface-secondary text-body',
  pipOn: 'border-brass-border bg-brass-fill text-on-brass',
  pipOff:
    'border-divider-strong bg-transparent text-muted [@media(hover:hover)]:hover:border-brass-border [@media(hover:hover)]:hover:text-brass-text',
  chipOn: 'border-divider bg-surface-raised text-heading',
  barFill: 'bg-brass-fill',
} as const;

/** Transitional alias until all shared mounts are migrated in T4. */
export const CLASS_RESOURCE_COLORS = Object.fromEntries(
  (
    [
      'indigo',
      'red',
      'amber',
      'emerald',
      'blue',
      'orange',
      'violet',
      'yellow',
      'green',
      'purple',
    ] satisfies ClassResourceColor[]
  ).map(color => [
    color,
    { ...CLASS_RESOURCE_STYLE, iconBg: CLASS_RESOURCE_STYLE.barFill },
  ])
) as Record<
  ClassResourceColor,
  typeof CLASS_RESOURCE_STYLE & { iconBg: string }
>;
