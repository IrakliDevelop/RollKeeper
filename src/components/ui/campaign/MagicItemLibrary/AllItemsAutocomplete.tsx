'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/forms/input';
import { Badge } from '@/components/ui/layout/badge';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { formatRarity } from '@/utils/formatRarity';
import type { ProcessedItem, ProcessedMagicItem } from '@/types/items';

export type CompendiumItem =
  | { kind: 'magic'; item: ProcessedMagicItem }
  | { kind: 'mundane'; item: ProcessedItem };

export function AllItemsAutocomplete({
  mundaneItems,
  magicItems,
  loading,
  onSelect,
}: {
  mundaneItems: ProcessedItem[];
  magicItems: ProcessedMagicItem[];
  loading: boolean;
  onSelect: (selection: CompendiumItem) => void;
}) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const all: CompendiumItem[] = [
      ...magicItems.map(item => ({ kind: 'magic' as const, item })),
      ...mundaneItems.map(item => ({ kind: 'mundane' as const, item })),
    ];
    return all
      .filter(({ item }) =>
        [item.name, item.category, item.rarity, item.source]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      )
      .sort((a, b) => {
        const aName = a.item.name.toLowerCase();
        const bName = b.item.name.toLowerCase();
        return (
          Number(bName.startsWith(needle)) - Number(aName.startsWith(needle)) ||
          aName.localeCompare(bName)
        );
      })
      .slice(0, 40);
  }, [magicItems, mundaneItems, query]);

  return (
    <div className="relative min-w-0 space-y-2">
      <Input
        label="Start from any compendium item"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder={
          loading
            ? 'Loading item compendium…'
            : 'Search weapons, armor, gear, or magic items…'
        }
        leftIcon={<Search size={16} />}
        disabled={loading}
      />
      {query && (
        <div
          className={`${OVERLAY_SURFACE} absolute z-50 max-h-72 w-full overflow-y-auto`}
        >
          {results.length === 0 ? (
            <p className="text-muted p-4 text-sm">No matching items.</p>
          ) : (
            results.map(result => (
              <button
                type="button"
                key={`${result.kind}-${result.item.id}`}
                onClick={() => {
                  onSelect(result);
                  setQuery('');
                }}
                className="border-divider hover:bg-surface-secondary flex w-full min-w-0 items-center justify-between gap-3 border-b px-3 py-2 text-left last:border-b-0 pointer-coarse:min-h-11"
              >
                <div className="min-w-0">
                  <p className="text-heading text-sm font-medium break-words">
                    {result.item.name}
                  </p>
                  <p className="text-muted text-xs">
                    {result.item.category} · {result.item.source}
                  </p>
                </div>
                <Badge variant="neutral" size="sm">
                  {result.kind === 'magic'
                    ? formatRarity(result.item.rarity)
                    : 'Mundane'}
                </Badge>
              </button>
            ))
          )}
        </div>
      )}
      <p className="text-muted text-xs">
        Selecting an item fills the form; every field remains editable.
      </p>
    </div>
  );
}
