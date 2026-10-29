'use client';

import type { ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';

export interface SubTabDefinition {
  value: string;
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface SubTabsProps {
  tabs: SubTabDefinition[];
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

/** Unpersisted text tabs. Callers own values, stable ids and selection. */
export function SubTabs({ tabs, label, ...props }: SubTabsProps) {
  return (
    <Tabs.Root {...props}>
      <Tabs.List
        aria-label={label}
        className="border-divider flex gap-1 overflow-x-auto overflow-y-hidden border-b"
      >
        {tabs.map(tab => (
          <Tabs.Trigger
            key={tab.value}
            id={tab.id}
            value={tab.value}
            disabled={tab.disabled}
            aria-controls={`${tab.id}-panel`}
            className="type-ui text-muted focus-visible:ring-brass-fill data-[state=active]:border-brass-fill data-[state=active]:text-heading -mb-px min-h-6 shrink-0 cursor-pointer border-b-2 border-transparent px-3 py-2 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11"
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map(tab => (
        <Tabs.Content
          key={tab.value}
          value={tab.value}
          id={`${tab.id}-panel`}
          aria-labelledby={tab.id}
          className="focus-visible:ring-brass-fill pt-4 focus-visible:ring-2 focus-visible:outline-none"
        >
          {tab.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
