'use client';

import * as Tabs from '@radix-ui/react-tabs';
import type { LucideIcon } from 'lucide-react';

import { badgeVariants } from '@/components/ui/layout/badge';

export type CreatureTabId = 'actions' | 'statblock' | 'effects' | 'lair';

export interface CreatureTabDefinition {
  id: CreatureTabId;
  label: string;
  icon: LucideIcon;
  /** Optional count pill after the label (e.g. active effects); hidden when 0. */
  count?: number;
}

export interface CreatureTabBarProps {
  tabs: CreatureTabDefinition[];
}

// The count uses badgeVariants on a span: Badge renders a div, which can't
// sit inside the trigger's button.
const COUNT_CLASS = badgeVariants({ variant: 'warning', size: 'sm' });

const TRIGGER_CLASS =
  'type-ui flex min-h-9 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 text-muted transition-colors pointer-coarse:min-h-11 data-[state=active]:border-brass-fill data-[state=active]:text-heading focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * Radix Tabs trigger strip for the creature drawer: the active tab gets a
 * brass underline from Radix's `data-state`. Must render inside
 * `CreatureSheet`'s `Tabs.Root`.
 */
export function CreatureTabBar({ tabs }: CreatureTabBarProps) {
  return (
    <Tabs.List className="border-divider bg-surface-elevated sticky top-0 z-10 flex gap-1 overflow-x-auto border-b px-5">
      {tabs.map(tab => {
        const Icon = tab.icon;
        return (
          <Tabs.Trigger key={tab.id} value={tab.id} className={TRIGGER_CLASS}>
            <Icon className="size-3.5" aria-hidden />
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={COUNT_CLASS}>{tab.count}</span>
            )}
          </Tabs.Trigger>
        );
      })}
    </Tabs.List>
  );
}
