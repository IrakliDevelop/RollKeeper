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

import type { ClassResourceIcon } from '@/utils/classResources';

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
