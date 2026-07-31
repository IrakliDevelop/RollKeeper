import {
  BookOpen,
  Flame,
  HandFist,
  HeartHandshake,
  LucideIcon,
  Music,
  PawPrint,
  Sparkles,
  Sun,
  WandSparkles,
  Wind,
  Zap,
} from 'lucide-react';

import { ClassResourceColor, ClassResourceIcon } from '@/utils/classResources';

export const CLASS_RESOURCE_ICONS: Record<ClassResourceIcon, LucideIcon> = {
  music: Music,
  flame: Flame,
  sun: Sun,
  'paw-print': PawPrint,
  wind: Wind,
  zap: Zap,
  'hand-fist': HandFist,
  sparkles: Sparkles,
  'heart-handshake': HeartHandshake,
  'wand-sparkles': WandSparkles,
  'book-open': BookOpen,
};

export interface ClassResourceColorClasses {
  /** Icon square in the tracker header. */
  iconBg: string;
  /** Die/pool badge in the tracker header. */
  badge: string;
  /** Available pip. */
  pipOn: string;
  /** Spent pip (hover hints at restore). */
  pipOff: string;
  /** HUD chip with uses remaining. */
  chipOn: string;
}

export const CLASS_RESOURCE_COLORS: Record<
  ClassResourceColor,
  ClassResourceColorClasses
> = {
  indigo: {
    iconBg: 'bg-accent-indigo-bg-strong text-accent-indigo-text',
    badge:
      'border-accent-indigo-border bg-accent-indigo-bg-strong text-accent-indigo-text',
    pipOn:
      'border-accent-indigo-border-strong bg-accent-indigo-bg-strong text-accent-indigo-text shadow-sm hover:shadow-md',
    pipOff:
      'bg-surface-secondary border-divider text-muted hover:border-accent-indigo-border hover:text-accent-indigo-text cursor-pointer',
    chipOn:
      'border-accent-indigo-border bg-accent-indigo-bg text-accent-indigo-text',
  },
  red: {
    iconBg: 'bg-accent-red-bg-strong text-accent-red-text',
    badge:
      'border-accent-red-border bg-accent-red-bg-strong text-accent-red-text',
    pipOn:
      'border-accent-red-border-strong bg-accent-red-bg-strong text-accent-red-text shadow-sm hover:shadow-md',
    pipOff:
      'bg-surface-secondary border-divider text-muted hover:border-accent-red-border hover:text-accent-red-text cursor-pointer',
    chipOn: 'border-accent-red-border bg-accent-red-bg text-accent-red-text',
  },
  amber: {
    iconBg: 'bg-accent-amber-bg-strong text-accent-amber-text',
    badge:
      'border-accent-amber-border bg-accent-amber-bg-strong text-accent-amber-text',
    pipOn:
      'border-accent-amber-border-strong bg-accent-amber-bg-strong text-accent-amber-text shadow-sm hover:shadow-md',
    pipOff:
      'bg-surface-secondary border-divider text-muted hover:border-accent-amber-border hover:text-accent-amber-text cursor-pointer',
    chipOn:
      'border-accent-amber-border bg-accent-amber-bg text-accent-amber-text',
  },
  emerald: {
    iconBg: 'bg-accent-emerald-bg-strong text-accent-emerald-text',
    badge:
      'border-accent-emerald-border bg-accent-emerald-bg-strong text-accent-emerald-text',
    pipOn:
      'border-accent-emerald-border-strong bg-accent-emerald-bg-strong text-accent-emerald-text shadow-sm hover:shadow-md',
    pipOff:
      'bg-surface-secondary border-divider text-muted hover:border-accent-emerald-border hover:text-accent-emerald-text cursor-pointer',
    chipOn:
      'border-accent-emerald-border bg-accent-emerald-bg text-accent-emerald-text',
  },
  blue: {
    iconBg: 'bg-accent-blue-bg-strong text-accent-blue-text',
    badge:
      'border-accent-blue-border bg-accent-blue-bg-strong text-accent-blue-text',
    pipOn:
      'border-accent-blue-border-strong bg-accent-blue-bg-strong text-accent-blue-text shadow-sm hover:shadow-md',
    pipOff:
      'bg-surface-secondary border-divider text-muted hover:border-accent-blue-border hover:text-accent-blue-text cursor-pointer',
    chipOn: 'border-accent-blue-border bg-accent-blue-bg text-accent-blue-text',
  },
  orange: {
    iconBg: 'bg-accent-orange-bg-strong text-accent-orange-text',
    badge:
      'border-accent-orange-border bg-accent-orange-bg-strong text-accent-orange-text',
    pipOn:
      'border-accent-orange-border-strong bg-accent-orange-bg-strong text-accent-orange-text shadow-sm hover:shadow-md',
    pipOff:
      'bg-surface-secondary border-divider text-muted hover:border-accent-orange-border hover:text-accent-orange-text cursor-pointer',
    chipOn:
      'border-accent-orange-border bg-accent-orange-bg text-accent-orange-text',
  },
  violet: {
    iconBg: 'bg-accent-violet-bg-strong text-accent-violet-text',
    badge:
      'border-accent-violet-border bg-accent-violet-bg-strong text-accent-violet-text',
    pipOn:
      'border-accent-violet-border-strong bg-accent-violet-bg-strong text-accent-violet-text shadow-sm hover:shadow-md',
    pipOff:
      'bg-surface-secondary border-divider text-muted hover:border-accent-violet-border hover:text-accent-violet-text cursor-pointer',
    chipOn:
      'border-accent-violet-border bg-accent-violet-bg text-accent-violet-text',
  },
  yellow: {
    iconBg: 'bg-accent-yellow-bg-strong text-accent-yellow-text',
    badge:
      'border-accent-yellow-border bg-accent-yellow-bg-strong text-accent-yellow-text',
    pipOn:
      'border-accent-yellow-border-strong bg-accent-yellow-bg-strong text-accent-yellow-text shadow-sm hover:shadow-md',
    pipOff:
      'bg-surface-secondary border-divider text-muted hover:border-accent-yellow-border hover:text-accent-yellow-text cursor-pointer',
    chipOn:
      'border-accent-yellow-border bg-accent-yellow-bg text-accent-yellow-text',
  },
  green: {
    iconBg: 'bg-accent-green-bg-strong text-accent-green-text',
    badge:
      'border-accent-green-border bg-accent-green-bg-strong text-accent-green-text',
    pipOn:
      'border-accent-green-border-strong bg-accent-green-bg-strong text-accent-green-text shadow-sm hover:shadow-md',
    pipOff:
      'bg-surface-secondary border-divider text-muted hover:border-accent-green-border hover:text-accent-green-text cursor-pointer',
    chipOn:
      'border-accent-green-border bg-accent-green-bg text-accent-green-text',
  },
  purple: {
    iconBg: 'bg-accent-purple-bg-strong text-accent-purple-text',
    badge:
      'border-accent-purple-border bg-accent-purple-bg-strong text-accent-purple-text',
    pipOn:
      'border-accent-purple-border-strong bg-accent-purple-bg-strong text-accent-purple-text shadow-sm hover:shadow-md',
    pipOff:
      'bg-surface-secondary border-divider text-muted hover:border-accent-purple-border hover:text-accent-purple-text cursor-pointer',
    chipOn:
      'border-accent-purple-border bg-accent-purple-bg text-accent-purple-text',
  },
};
