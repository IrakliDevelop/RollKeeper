'use client';

import * as Tabs from '@radix-ui/react-tabs';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/utils/cn';

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
  activeTab: CreatureTabId;
}

/**
 * Radix Tabs trigger strip for the creature drawer, styled like the player
 * sheet's `SheetTabBar`. Must render inside `CreatureSheet`'s `Tabs.Root`.
 */
export function CreatureTabBar({ tabs, activeTab }: CreatureTabBarProps) {
  return (
    <Tabs.List className="border-divider bg-surface-raised sticky top-0 z-10 flex gap-1 overflow-x-auto border-b px-5">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const active = tab.id === activeTab;
        return (
          <Tabs.Trigger
            key={tab.id}
            value={tab.id}
            className={cn(
              'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors',
              active
                ? 'border-accent-emerald-text-muted text-heading'
                : 'text-muted border-transparent'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="bg-accent-red-bg text-accent-red-text rounded-full px-1.5 text-[10px] leading-4 font-bold tabular-nums">
                {tab.count}
              </span>
            )}
          </Tabs.Trigger>
        );
      })}
    </Tabs.List>
  );
}
