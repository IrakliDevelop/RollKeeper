/**
 * FeatureAutocomplete Component
 * Search and select features/traits from backgrounds, feats, and class features
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FeatureAutocompleteItem, FeatureSourceFilter } from '@/types/features';
import {
  Search,
  X,
  Loader2,
  Sparkles,
  Shield,
  Star,
  Swords,
} from 'lucide-react';

interface FeatureAutocompleteProps {
  features: FeatureAutocompleteItem[];
  onSelect: (feature: FeatureAutocompleteItem) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  sourceFilter?: FeatureSourceFilter;
}

// Source type icons
const SOURCE_ICONS: Record<FeatureSourceFilter, React.ReactElement> = {
  class: <Shield className="h-4 w-4" />,
  subclass: <Shield className="h-4 w-4" />,
  background: <Star className="h-4 w-4" />,
  feat: <Swords className="h-4 w-4" />,
  all: <Sparkles className="h-4 w-4" />,
};

// Source type colors
const SOURCE_COLORS: Record<FeatureSourceFilter, string> = {
  class:
    'text-accent-blue-text-muted bg-accent-blue-bg border-accent-blue-border-strong',
  subclass:
    'text-accent-purple-text-muted bg-accent-purple-bg border-accent-purple-border-strong',
  background:
    'text-accent-green-text-muted bg-accent-green-bg border-accent-green-border-strong',
  feat: 'text-accent-orange-text-muted bg-accent-orange-bg border-accent-orange-border-strong',
  all: 'text-muted bg-surface-inset border-divider-strong',
};

export function FeatureAutocomplete({
  features,
  onSelect,
  loading = false,
  disabled = false,
  placeholder = 'Search features from database...',
  className = '',
  sourceFilter = 'all',
}: FeatureAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedFeature, setSelectedFeature] =
    useState<FeatureAutocompleteItem | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter features based on query and source filter
  const filteredFeatures = React.useMemo(() => {
    if (!query.trim()) return [];

    const queryLower = query.toLowerCase().trim();

    let filtered = features;

    // Apply source filter
    if (sourceFilter !== 'all') {
      filtered = features.filter(f => f.sourceType === sourceFilter);
    }

    return filtered
      .filter(feature => {
        const nameLower = feature.name.toLowerCase();
        const descriptionLower = feature.description.toLowerCase();
        const tagsMatch = feature.tags.some(t =>
          t.toLowerCase().includes(queryLower)
        );

        return (
          nameLower.includes(queryLower) ||
          descriptionLower.includes(queryLower) ||
          tagsMatch ||
          feature.metadata.backgroundName?.toLowerCase().includes(queryLower) ||
          feature.metadata.className?.toLowerCase().includes(queryLower)
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
  }, [features, query, sourceFilter]);

  // Reset selected index when filtered features change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredFeatures]);

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
          prev < filteredFeatures.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredFeatures[selectedIndex]) {
          handleSelect(filteredFeatures[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // Handle feature selection
  const handleSelect = (feature: FeatureAutocompleteItem) => {
    setSelectedFeature(feature);
    setQuery('');
    setIsOpen(false);
    onSelect(feature);
  };

  // Handle clear
  const handleClear = () => {
    setQuery('');
    setSelectedFeature(null);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setSelectedFeature(null);
  };

  // Get source color classes
  const getSourceColor = (sourceType: FeatureSourceFilter) => {
    return SOURCE_COLORS[sourceType] || SOURCE_COLORS.all;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Header with icon */}
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="text-accent-indigo-text-muted h-5 w-5" />
        <h4 className="text-body text-sm font-semibold">
          Search Feature Database
        </h4>
        {loading && (
          <Loader2 className="text-accent-indigo-text-muted h-4 w-4 animate-spin" />
        )}
      </div>

      {/* Selected feature display */}
      {selectedFeature && (
        <div
          className={`mb-2 flex items-center justify-between rounded-lg border-2 px-3 py-2 ${getSourceColor(selectedFeature.sourceType)}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {SOURCE_ICONS[selectedFeature.sourceType]}
            </span>
            <div>
              <p className="font-medium">{selectedFeature.name}</p>
              <p className="text-xs opacity-80">
                {selectedFeature.sourceType === 'background' &&
                  selectedFeature.metadata.backgroundName}
                {selectedFeature.sourceType === 'feat' && 'Feat'}
                {(selectedFeature.sourceType === 'class' ||
                  selectedFeature.sourceType === 'subclass') &&
                  `${selectedFeature.metadata.className} - Level ${selectedFeature.metadata.level}`}
                {' • '}
                {selectedFeature.source}
              </p>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="rounded p-1 opacity-70 hover:opacity-100"
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
            className="border-divider-strong bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-bg disabled:bg-surface-inset w-full rounded-lg border py-2 pr-10 pl-10 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed"
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
            {filteredFeatures.length > 0 ? (
              <ul className="py-1">
                {filteredFeatures.map((feature, index) => (
                  <li key={`${feature.id}-${index}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(feature)}
                      className={`w-full px-4 py-2 text-left transition-colors ${
                        index === selectedIndex
                          ? 'bg-accent-indigo-bg-strong'
                          : 'hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-1">
                          {SOURCE_ICONS[feature.sourceType]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-heading truncate font-medium">
                            {feature.name}
                          </p>
                          <p className="text-muted text-xs">
                            <span
                              className={`capitalize ${getSourceColor(feature.sourceType).split(' ')[0]}`}
                            >
                              {feature.sourceType}
                            </span>
                            {feature.metadata.backgroundName &&
                              ` • ${feature.metadata.backgroundName}`}
                            {feature.metadata.className &&
                              ` • ${feature.metadata.className}`}
                            {feature.metadata.level &&
                              ` (Level ${feature.metadata.level})`}
                            {' • '}
                            <span className="text-faint">{feature.source}</span>
                          </p>
                          {feature.metadata.prerequisites &&
                            feature.metadata.prerequisites.length > 0 && (
                              <p className="mt-1 text-xs text-amber-600 italic">
                                Requires:{' '}
                                {feature.metadata.prerequisites.join(', ')}
                              </p>
                            )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted px-4 py-8 text-center text-sm">
                <p>No features found</p>
                <p className="mt-1 text-xs">Try a different search term</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Helper text */}
      <p className="text-muted mt-2 text-xs">
        {selectedFeature
          ? 'Feature details loaded. You can edit any field below.'
          : 'Search and select a feature to auto-fill the form, or fill manually.'}
      </p>
    </div>
  );
}
