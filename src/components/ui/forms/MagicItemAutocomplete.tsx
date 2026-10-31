'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ProcessedMagicItem } from '@/types/items';
import { Search, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import {
  AppIcon,
  MAGIC_ITEM_CATEGORY_ICONS,
  getIconName,
} from '@/components/ui/icons';

interface MagicItemAutocompleteProps {
  items: ProcessedMagicItem[];
  onSelect: (item: ProcessedMagicItem) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function MagicItemAutocomplete({
  items,
  onSelect,
  loading = false,
  disabled = false,
  placeholder = 'Search magic items',
  className = '',
}: MagicItemAutocompleteProps) {
  const searchId = React.useId();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();

    return items
      .filter(item => {
        const name = item.name.toLowerCase();
        return (
          name.includes(q) ||
          item.category.includes(q) ||
          item.rarity.includes(q)
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
  }, [items, query]);

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

  const handleSelect = (item: ProcessedMagicItem) => {
    setQuery('');
    setIsOpen(false);
    onSelect(item);
    setSelectedName(item.name);
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    setSelectedName(null);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setSelectedName(null);
  };

  return (
    <div className={`relative min-w-0 ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        <label htmlFor={searchId} className="text-body text-sm font-semibold">
          Search magic items
        </label>
        {loading && <Loader2 className="text-muted h-4 w-4 animate-spin" />}
      </div>

      <div className="relative">
        <div className="relative">
          <Search className="text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            ref={inputRef}
            id={searchId}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => query && setIsOpen(true)}
            placeholder={placeholder}
            disabled={disabled || loading}
            className="border-divider text-heading disabled:bg-surface-inset focus-visible:outline-ring w-full min-w-0 rounded-sm border py-2 pr-10 pl-10 text-sm focus-visible:outline-2 disabled:cursor-not-allowed"
          />
          {query && (
            <button
              onClick={handleClear}
              aria-label="Clear magic item search"
              className="text-muted hover:bg-surface-hover hover:text-body absolute top-1/2 right-1 inline-flex min-h-6 min-w-6 -translate-y-1/2 items-center justify-center rounded-sm pointer-coarse:min-h-11 pointer-coarse:min-w-11"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isOpen && query && (
          <div
            ref={dropdownRef}
            className="border-divider bg-surface-raised absolute z-50 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border"
          >
            {filteredItems.length > 0 ? (
              <ul className="py-1">
                {filteredItems.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={`w-full min-w-0 px-4 py-2 text-left transition-colors pointer-coarse:min-h-11 ${
                        index === selectedIndex
                          ? 'bg-surface-hover'
                          : 'hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <AppIcon
                          name={getIconName(
                            MAGIC_ITEM_CATEGORY_ICONS,
                            item.category,
                            'magicItem'
                          )}
                          className="h-5 w-5 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-heading font-medium break-words">
                            {item.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="neutral" size="sm">
                              {item.rarity.charAt(0).toUpperCase() +
                                item.rarity.slice(1)}
                            </Badge>
                            <span className="text-muted text-xs">
                              {item.category.charAt(0).toUpperCase() +
                                item.category.slice(1)}
                            </span>
                            {item.requiresAttunement && (
                              <span className="text-muted text-xs italic">
                                Attunement
                              </span>
                            )}
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
                <p>No magic items match “{query}”.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-muted mt-2 text-xs">
        {selectedName
          ? `Filled in from ${selectedName}. Change anything below.`
          : 'Pick one to fill in the form, or fill it in yourself.'}
      </p>
    </div>
  );
}
