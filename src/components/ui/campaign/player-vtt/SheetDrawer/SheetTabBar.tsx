'use client';

import * as Tabs from '@radix-ui/react-tabs';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/utils/cn';

import type { SheetTabId } from './SheetDrawer.types';

export interface SheetTabDefinition {
  id: SheetTabId;
  label: string;
  icon: LucideIcon;
}

export interface SheetTabBarProps {
  tabs: SheetTabDefinition[];
  activeTab: SheetTabId;
  onChange: (id: SheetTabId) => void;
}

/**
 * Radix Tabs list for the sheet's top-level tabs. Only the trigger strip —
 * OwnSheet renders the active tab's body separately, below the unlocked
 * banner, so it stays outside Radix's Tabs.Content wiring.
 */
export function SheetTabBar({ tabs, activeTab, onChange }: SheetTabBarProps) {
  return (
    <Tabs.Root value={activeTab} onValueChange={v => onChange(v as SheetTabId)}>
      <Tabs.List className="border-divider flex gap-1 overflow-x-auto border-b px-5">
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
            </Tabs.Trigger>
          );
        })}
      </Tabs.List>
    </Tabs.Root>
  );
}
