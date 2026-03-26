'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ProcessedItem, ProcessedMagicItem } from '@/types/items';
import { Search, X, Loader2, Package } from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import { formatCurrencyFromCopper } from '@/utils/currency';

interface ItemAutocompleteProps {
  items: ProcessedItem[];
  magicItems?: ProcessedMagicItem[];
  onSelect: (item: ProcessedItem) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const MAGIC_CATEGORY_MAP: Record<string, string> = {
  wondrous: 'magic',
  ring: 'magic',
  staff: 'magic',
  wand: 'magic',
  rod: 'magic',
  scroll: 'consumable',
  potion: 'consumable',
  armor: 'armor',
  shield: 'armor',
  weapon: 'weapon',
};

function magicItemToProcessed(mi: ProcessedMagicItem): ProcessedItem {
  const category = MAGIC_CATEGORY_MAP[mi.category] || 'magic';
  return {
    id: `magic-${mi.id}`,
    name: mi.name,
    source: mi.source,
    category,
    rarity: mi.rarity,
    weight: mi.weight,
    value: mi.value,
    description: mi.description,
    tags: [
      mi.category,
      mi.rarity,
      ...(mi.requiresAttunement ? ['attunement'] : []),
    ],
    rawType: mi.type,
  };
}

const CATEGORY_VARIANTS: Record<
  string,
  'primary' | 'info' | 'success' | 'warning' | 'secondary'
> = {
  weapon: 'danger' as 'primary',
  armor: 'info',
  tool: 'success',
  misc: 'secondary',
  magic: 'warning',
  consumable: 'success',
};

const CATEGORY_EMOJI: Record<string, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  tool: '🔧',
  misc: '📦',
  magic: '✨',
  consumable: '🧪',
};

export function ItemAutocomplete({
  items,
  magicItems,
  onSelect,
  loading = false,
  disabled = false,
  placeholder = 'Search D&D items database...',
  className = '',
}: ItemAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedItem, setSelectedItem] = useState<ProcessedItem | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allItems = useMemo(() => {
    if (!magicItems?.length) return items;
    const converted = magicItems.map(magicItemToProcessed);
    return [...items, ...converted];
  }, [items, magicItems]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();

    return allItems
      .filter(item => {
        const name = item.name.toLowerCase();
        return (
          name.includes(q) ||
          item.category.includes(q) ||
          item.tags.some(t => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        if (aName === q && bName !== q) return -1;
        if (bName === q && aName !== q) return 1;

        const aStarts = aName.startsWith(q);
        const bStarts = bName.startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;

        return aName.localeCompare(bName);
      })
      .slice(0, 50);
  }, [allItems, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredItems.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (item: ProcessedItem) => {
    setSelectedItem(item);
    setQuery('');
    setIsOpen(false);
    onSelect(item);
  };

  const handleClear = () => {
    setQuery('');
    setSelectedItem(null);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setSelectedItem(null);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        <Package className="text-accent-purple-text-muted h-5 w-5" />
        <h4 className="text-body text-sm font-semibold">
          Search Item Database
        </h4>
        {loading && (
          <Loader2 className="text-accent-purple-text-muted h-4 w-4 animate-spin" />
        )}
      </div>

      {selectedItem && (
        <div className="border-accent-purple-border-strong bg-accent-purple-bg mb-2 flex items-center justify-between rounded-lg border-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {CATEGORY_EMOJI[selectedItem.category] || '📦'}
            </span>
            <div>
              <p className="text-heading font-medium">{selectedItem.name}</p>
              <p className="text-muted text-xs">
                {selectedItem.category.charAt(0).toUpperCase() +
                  selectedItem.category.slice(1)}
                {selectedItem.weight !== undefined &&
                  ` • ${selectedItem.weight} lbs`}
                {selectedItem.value !== undefined &&
                  ` • ${formatCurrencyFromCopper(selectedItem.value)}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="text-accent-purple-text-muted hover:bg-accent-purple-bg-strong hover:text-accent-purple-text rounded p-1"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="relative">
        <div className="relative">
          <Search className="text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => query && setIsOpen(true)}
            placeholder={placeholder}
            disabled={disabled || loading}
            className="border-divider-strong text-heading focus:border-accent-purple-border-strong focus:ring-accent-purple-bg/20 disabled:bg-surface-inset w-full rounded-lg border py-2 pr-10 pl-10 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed"
          />
          {query && (
            <button
              onClick={handleClear}
              className="text-muted hover:text-body absolute top-1/2 right-3 -translate-y-1/2"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isOpen && query && (
          <div
            ref={dropdownRef}
            className="border-divider bg-surface-raised absolute z-50 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border shadow-lg"
          >
            {filteredItems.length > 0 ? (
              <ul className="py-1">
                {filteredItems.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={`w-full px-4 py-2 text-left transition-colors ${
                        index === selectedIndex
                          ? 'bg-accent-purple-bg-strong'
                          : 'hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {CATEGORY_EMOJI[item.category] || '📦'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-heading truncate font-medium">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                CATEGORY_VARIANTS[item.category] || 'secondary'
                              }
                              size="sm"
                            >
                              {item.category.charAt(0).toUpperCase() +
                                item.category.slice(1)}
                            </Badge>
                            <span className="text-muted text-xs">
                              {item.weight !== undefined &&
                                `${item.weight} lbs`}
                              {item.weight !== undefined &&
                                item.value !== undefined &&
                                ' • '}
                              {item.value !== undefined &&
                                formatCurrencyFromCopper(item.value)}
                            </span>
                            <span className="text-faint text-xs">
                              {item.source}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted px-4 py-8 text-center text-sm">
                <p>No items found</p>
                <p className="mt-1 text-xs">Try a different search term</p>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-muted mt-2 text-xs">
        {selectedItem
          ? 'Item details loaded. You can edit any field below.'
          : 'Search and select an item to auto-fill the form, or fill manually.'}
      </p>
    </div>
  );
}
