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
                ? 'border-red-500 bg-red-500 dark:border-red-400 dark:bg-red-400' // Used
                : readonly
                  ? 'border-border-secondary bg-surface-raised'
                  : 'border-border-secondary bg-surface-raised hover:border-border-primary' // Available
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
    ? `rounded-lg border-2 border-accent-indigo-border bg-surface-raised p-3 shadow-sm ${className}`
    : `rounded-lg border-2 border-accent-indigo-border bg-gradient-to-br from-accent-indigo-bg to-accent-purple-bg p-4 space-y-4 shadow-sm ${className}`;

  if (safeTraits.length === 0) {
    return (
      <div className={containerClasses}>
        <div className="mb-4 flex items-center justify-between">
          <h3
            className={`text-accent-indigo-text flex items-center gap-2 font-semibold ${compact ? 'text-base' : 'text-lg'}`}
          >
            <Zap size={compact ? 16 : 20} />
            {compact ? 'Abilities' : 'Special Abilities'}
          </h3>
        </div>
        {!compact && (
          <div className="border-border-secondary bg-surface-inset rounded-lg border-2 border-dashed py-8 text-center">
            <Zap className="text-muted mx-auto mb-2 h-10 w-10" />
            <p className="text-body font-medium">No special abilities yet</p>
            <p className="text-muted mt-1 text-sm">
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
            className={`text-accent-indigo-text flex items-center gap-2 font-semibold ${compact ? 'text-base' : 'text-lg'}`}
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
                  className="text-accent-blue-text-muted hover:text-accent-blue-text"
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
                  className="text-accent-indigo-text-muted hover:text-accent-indigo-text"
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
          <Search className="text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search abilities..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="border-accent-indigo-border bg-surface-raised text-heading focus:border-accent-indigo-border-strong focus:ring-accent-indigo-bg w-full rounded-lg border-2 py-2 pr-10 pl-10 text-sm transition-colors focus:ring-2 focus:outline-none"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="text-muted hover:text-body absolute top-1/2 right-3 -translate-y-1/2"
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
              className={`border-accent-indigo-border bg-surface-raised rounded-lg border-2 ${compact ? 'p-2' : 'p-3'} transition-shadow hover:shadow-md`}
            >
              <div>
                <div
                  className={`mb-2 flex items-start justify-between ${compact ? 'mb-1' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={`text-heading font-medium ${compact ? 'text-sm' : 'text-base'}`}
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
                        className="text-muted mt-1 line-clamp-2 text-sm"
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
                          className="text-accent-indigo-text-muted hover:bg-accent-indigo-bg"
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
                          className="text-accent-red-text-muted hover:bg-accent-red-bg"
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
        <div className="border-border-secondary bg-surface-inset rounded-lg border-2 border-dashed py-8 text-center">
          <Search className="text-muted mx-auto mb-2 h-10 w-10" />
          <p className="text-body font-medium">
            No abilities match your search
          </p>
          <p className="text-muted mt-1 text-sm">Try a different search term</p>
        </div>
      )}
    </div>
  );
}
