'use client';

import * as Tabs from '@radix-ui/react-tabs';

import type { SheetTabId } from './SheetDrawer.types';

export interface SheetTabDefinition {
  id: SheetTabId;
  label: string;
}

export interface SheetTabBarProps {
  tabs: SheetTabDefinition[];
}

const TRIGGER_CLASS =
  'type-ui flex min-h-9 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 text-muted transition-colors pointer-coarse:min-h-11 data-[state=active]:border-brass-fill data-[state=active]:text-heading focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * Radix Tabs trigger strip for the sheet's top-level tabs: the active tab
 * gets a brass underline from Radix's `data-state`. Must render inside the
 * `Tabs.Root` owned by OwnSheet, which also renders each `Tabs.Content`
 * (the unlocked banner sits between the list and the content).
 */
export function SheetTabBar({ tabs }: SheetTabBarProps) {
  return (
    <Tabs.List className="border-divider flex gap-1 overflow-x-auto border-b px-5">
      {tabs.map(tab => (
        <Tabs.Trigger key={tab.id} value={tab.id} className={TRIGGER_CLASS}>
          {tab.label}
        </Tabs.Trigger>
      ))}
    </Tabs.List>
  );
}
