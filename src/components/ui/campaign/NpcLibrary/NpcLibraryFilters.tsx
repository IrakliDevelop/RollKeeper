'use client';

import type { Ref } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';

export interface NpcLibraryFiltersProps {
  searchRef: Ref<HTMLInputElement>;
  searchLabel: string;
  searchPlaceholder: string;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  allTags: string[];
  activeTags: ReadonlySet<string>;
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
}

/** The library's search box and tag filter. */
export function NpcLibraryFilters({
  searchRef,
  searchLabel,
  searchPlaceholder,
  searchQuery,
  onSearchQueryChange,
  allTags,
  activeTags,
  onToggleTag,
  onClearTags,
}: NpcLibraryFiltersProps) {
  return (
    <>
      <Input
        ref={searchRef}
        size="sm"
        aria-label={searchLabel}
        placeholder={searchPlaceholder}
        value={searchQuery}
        onChange={e => onSearchQueryChange(e.target.value)}
        leftIcon={<Search size={16} aria-hidden="true" />}
        clearable
        onClear={() => onSearchQueryChange('')}
      />
      {allTags.length > 0 && (
        <div
          role="group"
          aria-label="Filter by tag"
          className="flex flex-wrap items-center gap-1.5"
        >
          {allTags.map(tag => {
            const on = activeTags.has(tag);
            return (
              <Button
                key={tag}
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
            <Button variant="ghost" size="xs" onClick={onClearTags}>
              Clear tags
            </Button>
          )}
        </div>
      )}
    </>
  );
}
