'use client';

import React, { useState } from 'react';
import { HeroicInspiration } from '@/types/character';
import { Star, Plus, Minus, RotateCcw, Settings } from 'lucide-react';
import { Button, Input } from '@/components/ui/forms';

interface HeroicInspirationTrackerProps {
  inspiration: HeroicInspiration;
  onUpdateInspiration?: (updates: Partial<HeroicInspiration>) => void;
  onAddInspiration?: (amount?: number) => void;
  onUseInspiration?: () => void;
  onResetInspiration?: () => void;

  // Display options
  readonly?: boolean;
  compact?: boolean;
  hideControls?: boolean;
  hideSettings?: boolean;
  hideHelperText?: boolean;

  className?: string;
}

export function HeroicInspirationTracker({
  inspiration,
  onUpdateInspiration,
  onAddInspiration,
  onUseInspiration,
  onResetInspiration,
  readonly = false,
  compact = false,
  hideControls = false,
  hideSettings = false,
  hideHelperText = false,
  className = '',
}: HeroicInspirationTrackerProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [maxCountInput, setMaxCountInput] = useState(
    inspiration.maxCount?.toString() || ''
  );

  const handleMaxCountChange = () => {
    const newMax =
      maxCountInput.trim() === ''
        ? undefined
        : parseInt(maxCountInput) || undefined;
    onUpdateInspiration?.({ maxCount: newMax });
    setShowSettings(false);
  };

  const renderInspirationDice = () => {
    const maxDisplay = Math.max(
      inspiration.count,
      inspiration.maxCount || 0,
      compact ? 3 : 5
    );

    return (
      <div
        className={`flex flex-wrap justify-center gap-2 ${compact ? 'gap-1' : 'gap-2'}`}
      >
        {Array.from({ length: maxDisplay }, (_, index) => {
          const isActive = index < inspiration.count;
          const isOverMax =
            inspiration.maxCount && index >= inspiration.maxCount;

          return (
            <button
              key={index}
              onClick={() => {
                if (readonly) return;

                if (isActive && onUpdateInspiration) {
                  // Click on active dice to remove
                  const newCount = Math.max(0, inspiration.count - 1);
                  onUpdateInspiration({ count: newCount });
                } else if (!isOverMax && onAddInspiration) {
                  // Click on inactive dice to add (if not over max)
                  onAddInspiration(1);
                }
              }}
              disabled={readonly || Boolean(isOverMax && !isActive)}
              className={` ${compact ? 'h-8 w-8' : 'h-10 w-10'} flex items-center justify-center rounded-lg border-2 transition-all duration-200 ${
                isActive
                  ? 'scale-110 transform border-yellow-600 bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg hover:shadow-xl'
                  : isOverMax
                    ? 'border-border-secondary bg-bg-tertiary text-muted cursor-not-allowed'
                    : readonly
                      ? 'bg-surface-raised border-yellow-300 text-yellow-600 dark:border-yellow-600 dark:text-yellow-400'
                      : 'bg-surface-raised cursor-pointer border-yellow-300 text-yellow-600 hover:border-yellow-500 hover:bg-yellow-50 dark:border-yellow-600 dark:text-yellow-400 dark:hover:bg-yellow-900/20'
              } `}
              title={
                isActive
                  ? readonly
                    ? 'Inspiration available'
                    : 'Click to use inspiration'
                  : isOverMax
                    ? 'Over maximum limit'
                    : readonly
                      ? 'No inspiration'
                      : 'Click to add inspiration'
              }
            >
              <Star
                size={compact ? 12 : 16}
                className={isActive ? 'fill-current' : ''}
              />
            </button>
          );
        })}
      </div>
    );
  };

  const containerClasses = compact
    ? `bg-gradient-to-br from-accent-amber-bg to-accent-amber-bg-strong rounded-lg border-2 border-accent-amber-border-strong p-3 ${className}`
    : `bg-gradient-to-br from-accent-amber-bg to-accent-amber-bg-strong rounded-lg border-2 border-accent-amber-border-strong p-4 ${className}`;

  return (
    <div className={containerClasses}>
      {!compact && (
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-current text-yellow-600" />
            <h3 className="text-accent-amber-text text-lg font-bold">
              Heroic Inspiration
            </h3>
          </div>

          {!readonly && !hideSettings && (
            <div className="flex items-center gap-1">
              <Button
                onClick={() => setShowSettings(!showSettings)}
                variant="ghost"
                size="xs"
                className="text-accent-amber-text-muted hover:bg-accent-amber-bg-strong"
                title="Settings"
              >
                <Settings size={16} />
              </Button>
              {onResetInspiration && (
                <Button
                  onClick={onResetInspiration}
                  variant="ghost"
                  size="xs"
                  className="text-accent-amber-text-muted hover:bg-accent-amber-bg-strong"
                  title="Reset to 0"
                >
                  <RotateCcw size={16} />
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Settings Panel */}
      {!readonly && showSettings && !hideSettings && (
        <div className="border-accent-amber-border bg-surface-raised mb-4 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <label className="text-body text-sm font-medium">
              Max Inspiration:
            </label>
            <Input
              type="number"
              value={maxCountInput}
              onChange={e => setMaxCountInput(e.target.value)}
              placeholder="Unlimited"
              min="0"
              className="w-20 text-sm"
              size="sm"
            />
            <Button
              onClick={handleMaxCountChange}
              variant="warning"
              size="sm"
              className="bg-accent-amber-text-muted hover:bg-accent-amber-text"
            >
              Set
            </Button>
            <Button
              onClick={() => setShowSettings(false)}
              variant="secondary"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Current Count Display */}
      <div className="mb-4 text-center">
        <div
          className={`text-accent-amber-text font-bold ${compact ? 'text-xl' : 'text-3xl'}`}
        >
          {inspiration.count}
          {inspiration.maxCount && (
            <span
              className={`text-accent-amber-text-muted ml-1 ${compact ? 'text-sm' : 'text-lg'}`}
            >
              / {inspiration.maxCount}
            </span>
          )}
        </div>
        {!compact && (
          <div className="text-accent-amber-text-muted text-sm">
            {inspiration.count === 0
              ? 'No inspiration available'
              : inspiration.count === 1
                ? '1 inspiration die'
                : `${inspiration.count} inspiration dice`}
          </div>
        )}
      </div>

      {/* Inspiration Dice Visual */}
      <div className="mb-4">{renderInspirationDice()}</div>

      {/* Action Buttons */}
      {!readonly && !hideControls && (
        <div className="flex justify-center gap-2">
          {onAddInspiration && (
            <Button
              onClick={() => onAddInspiration(1)}
              disabled={
                inspiration.maxCount
                  ? inspiration.count >= inspiration.maxCount
                  : false
              }
              variant="success"
              size="sm"
              leftIcon={<Plus size={16} />}
            >
              Add
            </Button>
          )}
          {onUseInspiration && (
            <Button
              onClick={onUseInspiration}
              disabled={inspiration.count === 0}
              variant="danger"
              size="sm"
              leftIcon={<Minus size={16} />}
            >
              Use
            </Button>
          )}
        </div>
      )}

      {/* Helper Text */}
      {!hideHelperText && !compact && (
        <div className="bg-accent-amber-bg-strong text-accent-amber-text-muted mt-3 rounded p-2 text-center text-xs">
          <p>
            <strong>Heroic Inspiration:</strong> Reroll a d20 die and use the
            new roll.
          </p>
          <p className="mt-1">
            Unlike regular inspiration, you can have multiple dice and they
            stack!
          </p>
        </div>
      )}
    </div>
  );
}
