'use client';

import React from 'react';
import { TrackableTrait } from '@/types/character';
import { calculateTraitMaxUses } from '@/utils/calculations';
import { RotateCcw, Zap, Eye, Trash2 } from 'lucide-react';

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
  // Safety guard to ensure traits is always an array
  const safeTraits = Array.isArray(traits) ? traits : [];

  // Filter traits based on display options
  let displayTraits = safeTraits;
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
    ? `bg-white rounded-lg border border-gray-200 p-3 ${className}`
    : `bg-white rounded-lg border border-gray-200 p-4 space-y-4 ${className}`;

  if (displayTraits.length === 0) {
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
          <div className="py-6 text-center text-gray-500">
            <Zap className="mx-auto mb-2 h-8 w-8 text-gray-400" />
            <p className="font-medium">No special abilities yet</p>
            <p className="mt-1 text-sm">
              Special abilities appear here when added through Active Abilities & Features
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between">
        <h3
          className={`flex items-center gap-2 font-semibold text-indigo-800 ${compact ? 'text-base' : 'text-lg'}`}
        >
          <Zap size={compact ? 16 : 20} />
          {compact ? 'Abilities' : 'Special Abilities'}
        </h3>
        {!readonly && !hideControls && (
          <div className="flex items-center space-x-2">
            {!hideResetButtons &&
              onResetTraits &&
              shortRestTraits.length > 0 && (
                <button
                  onClick={() => onResetTraits('short')}
                  className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
                  title="Reset short rest abilities"
                >
                  <RotateCcw size={14} />
                  <span>Short Rest</span>
                </button>
              )}
            {!hideResetButtons &&
              onResetTraits &&
              longRestTraits.length > 0 && (
                <button
                  onClick={() => onResetTraits('long')}
                  className="flex items-center space-x-1 text-sm text-indigo-600 hover:text-indigo-800"
                  title="Reset all abilities"
                >
                  <RotateCcw size={14} />
                  <span>Long Rest</span>
                </button>
              )}
          </div>
        )}
      </div>

      {/* Traits List */}
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {displayTraits.map(trait => (
          <div
            key={trait.id}
            className={`rounded-lg border border-gray-200 ${compact ? 'p-2' : 'p-3'}`}
          >
            <div>
              <div
                className={`mb-2 flex items-start justify-between ${compact ? 'mb-1' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <h4
                      className={`truncate font-medium text-gray-900 ${compact ? 'text-sm' : ''}`}
                    >
                      {trait.name}
                    </h4>
                    {trait.source && (
                      <span
                        className={`rounded bg-gray-100 px-2 py-1 text-gray-600 ${compact ? 'text-xs' : 'text-xs'}`}
                      >
                        {trait.source}
                      </span>
                    )}
                    <span
                      className={`rounded px-2 py-1 ${compact ? 'text-xs' : 'text-xs'} ${
                        trait.restType === 'short'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {trait.restType === 'short'
                        ? 'Short Rest'
                        : 'Long Rest'}
                    </span>
                  </div>
                  {trait.description && !compact && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                      {trait.description}
                    </p>
                  )}
                </div>
                {!readonly && !hideControls && (
                  <div className="ml-2 flex items-center space-x-1">
                    {onTraitClick && (
                      <button
                        onClick={() => onTraitClick(trait)}
                        className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"
                        title="View ability details"
                      >
                        <Eye size={18} />
                      </button>
                    )}
                    {onDeleteTrait && (
                      <button
                        onClick={() => onDeleteTrait(trait.id)}
                        className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-100"
                        title="Delete ability"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                )}
                {/* View button even when controls are hidden */}
                {(readonly || hideControls) && onTraitClick && (
                  <div className="ml-2">
                    <button
                      onClick={() => onTraitClick(trait)}
                      className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"
                      title="View ability details"
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span
                    className={`font-medium text-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}
                  >
                    Uses:{' '}
                    {calculateTraitMaxUses(trait, characterLevel) -
                      trait.usedUses}
                    /{calculateTraitMaxUses(trait, characterLevel)}
                    {trait.scaleWithProficiency && (
                      <span className="ml-1 text-xs text-indigo-600">
                        (Proficiency)
                      </span>
                    )}
                  </span>
                  {renderUsageCheckboxes(trait)}
                </div>
                {!readonly && onUseTrait && (
                  <button
                    onClick={() => onUseTrait(trait.id)}
                    disabled={
                      trait.usedUses >=
                      calculateTraitMaxUses(trait, characterLevel)
                    }
                    className={`rounded-lg p-2 text-indigo-600 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50`}
                    title="Use ability"
                  >
                    <Zap size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
