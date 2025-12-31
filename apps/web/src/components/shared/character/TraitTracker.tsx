'use client';

import React, { useState } from 'react';
import { TrackableTrait } from '@/types/character';
import { calculateTraitMaxUses } from '@/utils/calculations';
import { Button } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';
import { RotateCcw, Zap, Eye, Trash2, Search, X } from 'lucide-react';

interface TraitTrackerProps {
  traits: TrackableTrait[];
  characterLevel?: number;
  onUpdateTrait?: (id: string, updates: Partial<TrackableTrait>) => void;
  onDeleteTrait?: (id: string) => void;
  onUseTrait?: (id: string) => void;
  onResetTraits?: (restType: 'short' | 'long') => void;
  onTraitClick?: (trait: TrackableTrait) => void;

  // Display options
  readonly?: boolean;
  compact?: boolean;
  hideControls?: boolean;
  hideResetButtons?: boolean;
  showOnlyUsed?: boolean;
  maxTraitsToShow?: number;

  className?: string;
}

export function TraitTracker({
  traits,
  characterLevel = 1,
  onUpdateTrait,
  onDeleteTrait,
  onUseTrait,
  onResetTraits,
  onTraitClick,
  readonly = false,
  compact = false,
  hideControls = false,
  hideResetButtons = false,
  showOnlyUsed = false,
  maxTraitsToShow,
  className = '',
}: TraitTrackerProps) {
  const [searchFilter, setSearchFilter] = useState('');

  // Safety guard to ensure traits is always an array
  const safeTraits = Array.isArray(traits) ? traits : [];

  // Filter traits based on display options
  let displayTraits = safeTraits;

  // Apply search filter
  if (searchFilter.trim()) {
    displayTraits = displayTraits.filter(
      trait =>
        trait.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (trait.description &&
          trait.description
            .toLowerCase()
            .includes(searchFilter.toLowerCase())) ||
        (trait.source &&
          trait.source.toLowerCase().includes(searchFilter.toLowerCase()))
    );
  }

  if (showOnlyUsed) {
    displayTraits = displayTraits.filter(trait => trait.usedUses > 0);
  }
  if (maxTraitsToShow) {
    displayTraits = displayTraits.slice(0, maxTraitsToShow);
  }

  const renderUsageCheckboxes = (trait: TrackableTrait) => {
    const size = compact ? 'w-3 h-3' : 'w-4 h-4';
    const gap = compact ? 'gap-0.5' : 'gap-1';
    const effectiveMaxUses = calculateTraitMaxUses(trait, characterLevel);

    return (
      <div className={`flex flex-wrap ${gap}`}>
        {Array.from({ length: effectiveMaxUses }, (_, index) => (
          <button
            key={index}
            onClick={() => {
              if (readonly || !onUpdateTrait) return;
              const newUsed =
                index < trait.usedUses ? trait.usedUses - 1 : index + 1;
              onUpdateTrait(trait.id, {
                usedUses: Math.max(0, Math.min(newUsed, effectiveMaxUses)),
              });
            }}
            disabled={readonly || !onUpdateTrait}
            className={`${size} rounded border-2 transition-colors ${
              index < trait.usedUses
                ? 'border-red-500 bg-red-500' // Used
                : readonly
                  ? 'border-gray-300 bg-white'
                  : 'border-gray-400 bg-white hover:border-gray-600' // Available
            } ${readonly ? '' : 'cursor-pointer'}`}
            title={`Use ${index + 1} - ${index < trait.usedUses ? 'Used' : 'Available'}`}
          />
        ))}
      </div>
    );
  };

  const shortRestTraits = displayTraits.filter(
    trait => trait.restType === 'short'
  );
  const longRestTraits = displayTraits.filter(
    trait => trait.restType === 'long'
  );

  const containerClasses = compact
    ? `rounded-lg border-2 border-indigo-200 bg-white p-3 shadow-sm ${className}`
    : `rounded-lg border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 space-y-4 shadow-sm ${className}`;

  if (safeTraits.length === 0) {
    return (
      <div className={containerClasses}>
        <div className="mb-4 flex items-center justify-between">
          <h3
            className={`flex items-center gap-2 font-semibold text-indigo-800 ${compact ? 'text-base' : 'text-lg'}`}
          >
            <Zap size={compact ? 16 : 20} />
            {compact ? 'Abilities' : 'Special Abilities'}
          </h3>
        </div>
        {!compact && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-8 text-center">
            <Zap className="mx-auto mb-2 h-10 w-10 text-gray-400" />
            <p className="font-medium text-gray-600">
              No special abilities yet
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Special abilities appear here when added through Active Abilities
              & Features
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3
            className={`flex items-center gap-2 font-semibold text-indigo-800 ${compact ? 'text-base' : 'text-lg'}`}
          >
            <Zap size={compact ? 16 : 20} />
            {compact ? 'Abilities' : 'Special Abilities'}
          </h3>
          {!compact && displayTraits.length > 0 && (
            <Badge variant="info" size="sm">
              {displayTraits.length}{' '}
              {displayTraits.length === 1 ? 'ability' : 'abilities'}
            </Badge>
          )}
        </div>
        {!readonly && !hideControls && (
          <div className="flex items-center space-x-2">
            {!hideResetButtons &&
              onResetTraits &&
              shortRestTraits.length > 0 && (
                <Button
                  onClick={() => onResetTraits('short')}
                  variant="ghost"
                  size="xs"
                  leftIcon={<RotateCcw className="h-3 w-3" />}
                  className="text-blue-600 hover:text-blue-800"
                  title="Reset short rest abilities"
                >
                  Short Rest
                </Button>
              )}
            {!hideResetButtons &&
              onResetTraits &&
              longRestTraits.length > 0 && (
                <Button
                  onClick={() => onResetTraits('long')}
                  variant="ghost"
                  size="xs"
                  leftIcon={<RotateCcw className="h-3 w-3" />}
                  className="text-indigo-600 hover:text-indigo-800"
                  title="Reset all abilities"
                >
                  Long Rest
                </Button>
              )}
          </div>
        )}
      </div>

      {/* Search Filter */}
      {!compact && safeTraits.length > 3 && (
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search abilities..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="w-full rounded-lg border-2 border-indigo-200 bg-white py-2 pr-10 pl-10 text-sm transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Traits List with fixed height and scroll */}
      {displayTraits.length > 0 ? (
        <div
          className={`${compact ? 'space-y-2' : 'max-h-96 space-y-3 overflow-y-auto pr-2'}`}
        >
          {displayTraits.map(trait => (
            <div
              key={trait.id}
              className={`rounded-lg border-2 border-indigo-200 bg-white ${compact ? 'p-2' : 'p-3'} transition-shadow hover:shadow-md`}
            >
              <div>
                <div
                  className={`mb-2 flex items-start justify-between ${compact ? 'mb-1' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={`font-medium text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}
                      >
                        {trait.name}
                      </h4>
                      {trait.source && (
                        <Badge variant="neutral" size="sm">
                          {trait.source}
                        </Badge>
                      )}
                      <Badge
                        variant={
                          trait.restType === 'short' ? 'info' : 'secondary'
                        }
                        size="sm"
                      >
                        {trait.restType === 'short'
                          ? 'Short Rest'
                          : 'Long Rest'}
                      </Badge>
                    </div>
                    {trait.description && !compact && (
                      <div
                        className="mt-1 line-clamp-2 text-sm text-gray-600"
                        dangerouslySetInnerHTML={{ __html: trait.description }}
                      />
                    )}
                  </div>
                  {!readonly && !hideControls && (
                    <div className="ml-2 flex items-center space-x-1">
                      {onTraitClick && (
                        <Button
                          onClick={() => onTraitClick(trait)}
                          variant="ghost"
                          size="xs"
                          className="text-indigo-600 hover:bg-indigo-100"
                          title="View ability details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {onDeleteTrait && (
                        <Button
                          onClick={() => onDeleteTrait(trait.id)}
                          variant="ghost"
                          size="xs"
                          className="text-red-600 hover:bg-red-100"
                          title="Delete ability"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                  {/* View button even when controls are hidden */}
                  {(readonly || hideControls) && onTraitClick && (
                    <div className="ml-2">
                      <Button
                        onClick={() => onTraitClick(trait)}
                        variant="ghost"
                        size="xs"
                        className="text-indigo-600 hover:bg-indigo-100"
                        title="View ability details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        calculateTraitMaxUses(trait, characterLevel) -
                          trait.usedUses >
                        0
                          ? 'success'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {calculateTraitMaxUses(trait, characterLevel) -
                        trait.usedUses}
                      /{calculateTraitMaxUses(trait, characterLevel)} Uses
                      {trait.scaleWithProficiency && ' (Prof.)'}
                    </Badge>
                    {renderUsageCheckboxes(trait)}
                  </div>
                  {!readonly && onUseTrait && (
                    <Button
                      onClick={() => onUseTrait(trait.id)}
                      disabled={
                        trait.usedUses >=
                        calculateTraitMaxUses(trait, characterLevel)
                      }
                      variant="ghost"
                      size="xs"
                      className="text-indigo-600 hover:bg-indigo-100"
                      title="Use ability"
                    >
                      <Zap className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-8 text-center">
          <Search className="mx-auto mb-2 h-10 w-10 text-gray-400" />
          <p className="font-medium text-gray-600">
            No abilities match your search
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Try a different search term
          </p>
        </div>
      )}
    </div>
  );
}
