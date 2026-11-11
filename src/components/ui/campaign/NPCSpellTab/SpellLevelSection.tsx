'use client';

import React from 'react';
import { Section } from '@/components/ui/layout/section';
import { SlotPipsButtons } from '@/components/ui/game/SlotPipsButtons';
import { LEVEL_NAMES } from './NPCSpellTab.utils';

interface SpellLevelSectionProps {
  level: number;
  slot?: { max: number; used: number };
  /** Inline slot mode: pips sit in the heading row. */
  showPips: boolean;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onSpend: () => void;
  onRestore: () => void;
  children: React.ReactNode;
}

/** One spell level: a heading, its slot pips and the rows under it. */
export function SpellLevelSection({
  level,
  slot,
  showPips,
  collapsed,
  onCollapsedChange,
  onSpend,
  onRestore,
  children,
}: SpellLevelSectionProps) {
  const available = slot ? slot.max - slot.used : 0;

  return (
    <Section
      level={4}
      heading={LEVEL_NAMES[level] ?? `Level ${level}`}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      trailing={
        showPips && level > 0 && slot && slot.max > 0 ? (
          <>
            <SlotPipsButtons
              level={level}
              total={slot.max}
              available={available}
              onSpend={onSpend}
              onRestore={onRestore}
            />
            <span
              aria-hidden="true"
              className="type-small text-muted tabular-nums"
            >
              {available}/{slot.max}
            </span>
          </>
        ) : undefined
      }
    >
      {React.Children.count(children) > 0 && (
        <ul className="divide-divider divide-y">{children}</ul>
      )}
    </Section>
  );
}
