/**
 * SpellAutocomplete Component
 * Search and select spells from the spellbook database
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ProcessedSpell } from '@/types/spells';
import { Search, X, Loader2, Sparkles } from 'lucide-react';

interface SpellAutocompleteProps {
  spells: ProcessedSpell[];
  onSelect: (spell: ProcessedSpell) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

// School icons mapping
const SCHOOL_ICONS: Record<string, string> = {
  Abjuration: '🛡️',
  Conjuration: '🌀',
  Divination: '🔮',
  Enchantment: '💫',
  Evocation: '⚡',
  Illusion: '✨',
  Necromancy: '💀',
  Transmutation: '🔄',
};

// Level colors
const LEVEL_COLORS: Record<number, string> = {
  0: 'text-gray-500',
  1: 'text-blue-500',
  2: 'text-green-500',
  3: 'text-yellow-500',
  4: 'text-orange-500',
  5: 'text-red-500',
  6: 'text-purple-500',
  7: 'text-pink-500',
  8: 'text-cyan-500',
  9: 'text-white',
};

export function SpellAutocomplete({
  spells,
  onSelect,
  loading = false,
  disabled = false,
  placeholder = 'Search spells from spellbook...',
  className = '',
}: SpellAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedSpell, setSelectedSpell] = useState<ProcessedSpell | null>(
    null
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter spells based on query
  const filteredSpells = React.useMemo(() => {
    if (!query.trim()) return [];

    const queryLower = query.toLowerCase().trim();

    return spells
      .filter(spell => {
        const nameLower = spell.name.toLowerCase();
        const schoolLower = spell.schoolName.toLowerCase();

        return (
          nameLower.includes(queryLower) || schoolLower.includes(queryLower)
        );
      })
      .sort((a, b) => {
        // Sort by relevance
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        const aExact = aName === queryLower;
        const bExact = bName === queryLower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = aName.startsWith(queryLower);
        const bStarts = bName.startsWith(queryLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return aName.localeCompare(bName);
      })
      .slice(0, 50); // Limit to 50 results for performance
  }, [spells, query]);

  // Reset selected index when filtered spells change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredSpells]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
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
          prev < filteredSpells.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredSpells[selectedIndex]) {
          handleSelect(filteredSpells[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // Handle spell selection
  const handleSelect = (spell: ProcessedSpell) => {
    setSelectedSpell(spell);
    setQuery('');
    setIsOpen(false);
    onSelect(spell);
  };

  // Handle clear
  const handleClear = () => {
    setQuery('');
    setSelectedSpell(null);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setSelectedSpell(null);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Header with icon */}
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="text-accent-purple-text-muted h-5 w-5" />
        <h4 className="text-body text-sm font-semibold">Search Spellbook</h4>
        {loading && (
          <Loader2 className="text-accent-purple-text-muted h-4 w-4 animate-spin" />
        )}
      </div>

      {/* Selected spell display */}
      {selectedSpell && (
        <div className="border-accent-purple-border-strong bg-accent-purple-bg mb-2 flex items-center justify-between rounded-lg border-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {SCHOOL_ICONS[selectedSpell.schoolName] || '✨'}
            </span>
            <div>
              <p className="text-heading font-medium">{selectedSpell.name}</p>
              <p className="text-muted text-xs">
                {selectedSpell.level === 0
                  ? 'Cantrip'
                  : `Level ${selectedSpell.level}`}{' '}
                • {selectedSpell.schoolName}
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

      {/* Search input */}
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

        {/* Dropdown */}
        {isOpen && query && (
          <div
            ref={dropdownRef}
            className="border-divider bg-surface-raised absolute z-50 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border shadow-lg"
          >
            {filteredSpells.length > 0 ? (
              <ul className="py-1">
                {filteredSpells.map((spell, index) => (
                  <li key={spell.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(spell)}
                      className={`w-full px-4 py-2 text-left transition-colors ${
                        index === selectedIndex
                          ? 'bg-accent-purple-bg-strong'
                          : 'hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {SCHOOL_ICONS[spell.schoolName] || '✨'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-heading truncate font-medium">
                            {spell.name}
                          </p>
                          <p className="text-muted text-xs">
                            <span className={LEVEL_COLORS[spell.level]}>
                              {spell.level === 0
                                ? 'Cantrip'
                                : `Level ${spell.level}`}
                            </span>
                            {' • '}
                            {spell.schoolName}
                            {' • '}
                            <span className="text-faint">{spell.source}</span>
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted px-4 py-8 text-center text-sm">
                <p>No spells found</p>
                <p className="mt-1 text-xs">Try a different search term</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Helper text */}
      <p className="text-muted mt-2 text-xs">
        {selectedSpell
          ? 'Spell details loaded. You can edit any field below.'
          : 'Search and select a spell to auto-fill the form, or fill manually.'}
      </p>
    </div>
  );
}
