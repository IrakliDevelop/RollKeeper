'use client';

import { useId, useRef } from 'react';
import { Button } from '@/components/ui/forms/button';
import {
  ALL_SPELL_CATEGORIES,
  SPELL_CATEGORY_LABELS,
} from './NPCSpellTab.utils';
import type { SpellCategory } from './NPCSpellTab.utils';

interface SpellFiltersProps {
  categoryCounts: Record<SpellCategory, number>;
  activeCategories: ReadonlySet<SpellCategory>;
  onToggleCategory: (category: SpellCategory) => void;
  tags: string[];
  activeTags: ReadonlySet<string>;
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
}

/** Type and tag toggles. Shown only when there is something to filter by. */
export function SpellFilters({
  categoryCounts,
  activeCategories,
  onToggleCategory,
  tags,
  activeTags,
  onToggleTag,
  onClearTags,
}: SpellFiltersProps) {
  const typeLabelId = useId();
  const tagLabelId = useId();
  const firstTagRef = useRef<HTMLButtonElement>(null);

  const categories = ALL_SPELL_CATEGORIES.filter(c => categoryCounts[c] > 0);
  const showTypes = categories.length > 1;
  if (!showTypes && tags.length === 0) return null;

  const clearTags = () => {
    onClearTags();
    firstTagRef.current?.focus();
  };

  return (
    <div className="mb-3 space-y-2">
      {showTypes && (
        <div
          role="group"
          aria-labelledby={typeLabelId}
          className="flex flex-wrap items-center gap-1.5"
        >
          <span id={typeLabelId} className="type-small text-muted">
            Type
          </span>
          {categories.map(category => {
            const on = activeCategories.has(category);
            return (
              <Button
                key={category}
                variant="ghost"
                size="xs"
                selected={on}
                aria-pressed={on}
                onClick={() => onToggleCategory(category)}
              >
                {SPELL_CATEGORY_LABELS[category]}
                <span className="text-muted tabular-nums">
                  {categoryCounts[category]}
                </span>
              </Button>
            );
          })}
        </div>
      )}
      {tags.length > 0 && (
        <div
          role="group"
          aria-labelledby={tagLabelId}
          className="flex flex-wrap items-center gap-1.5"
        >
          <span id={tagLabelId} className="type-small text-muted">
            Tags
          </span>
          {tags.map((tag, i) => {
            const on = activeTags.has(tag);
            return (
              <Button
                key={tag}
                ref={i === 0 ? firstTagRef : undefined}
                variant="ghost"
                size="xs"
                selected={on}
                aria-pressed={on}
                onClick={() => onToggleTag(tag)}
              >
                {tag}
              </Button>
            );
          })}
          {activeTags.size > 0 && (
            <Button variant="ghost" size="xs" onClick={clearTags}>
              Clear tags
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
