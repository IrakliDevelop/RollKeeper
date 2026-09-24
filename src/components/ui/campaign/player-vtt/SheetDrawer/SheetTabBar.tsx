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
}

/**
 * Radix Tabs trigger strip for the sheet's top-level tabs. Must render inside
 * the `Tabs.Root` owned by OwnSheet, which also renders each `Tabs.Content`
 * (the unlocked banner sits between the list and the content).
 */
export function SheetTabBar({ tabs, activeTab }: SheetTabBarProps) {
  return (
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
  );
}
