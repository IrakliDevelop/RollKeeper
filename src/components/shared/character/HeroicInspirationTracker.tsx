'use client';

import React from 'react';
import { HeroicInspiration } from '@/types/character';
import { Button } from '@/components/ui/forms';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Switch } from '@/components/ui/forms/switch';
import { Section } from '@/components/ui/layout/section';

interface HeroicInspirationTrackerProps {
  inspiration: HeroicInspiration;
  onUpdateInspiration?: (updates: Partial<HeroicInspiration>) => void;
  onAddInspiration?: (amount?: number) => void;
  onUseInspiration?: () => void;
  onResetInspiration?: () => void;
  readonly?: boolean;
  compact?: boolean;
  hideControls?: boolean;
  hideSettings?: boolean;
  hideHelperText?: boolean;
  stackable?: boolean;
  showStackableControl?: boolean;
  dmControlled?: boolean;
  onToggleStackable?: (enabled: boolean) => void;
  editing?: boolean;
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
  stackable = true,
  showStackableControl = false,
  dmControlled = false,
  onToggleStackable,
  editing = true,
  className = '',
}: HeroicInspirationTrackerProps) {
  const maxDisplay = Math.max(
    inspiration.count,
    inspiration.maxCount || 0,
    compact ? 3 : 5
  );
  const settingsAllowed = !readonly && editing && !hideSettings;

  return (
    <Section
      heading="Heroic Inspiration"
      className={className}
      trailing={
        settingsAllowed &&
        onResetInspiration && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetInspiration}
          >
            Clear inspiration
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div className="text-center">
          <div className="type-num-lg text-heading">
            {inspiration.count}
            {stackable && inspiration.maxCount != null && (
              <span className="text-muted text-base">
                {' '}
                / {inspiration.maxCount}
              </span>
            )}
          </div>
          <p className="text-muted text-sm">
            {stackable
              ? inspiration.count === 0
                ? 'No inspiration available'
                : inspiration.count === 1
                  ? '1 inspiration die'
                  : `${inspiration.count} inspiration dice`
              : inspiration.count > 0
                ? 'You have inspiration'
                : 'No inspiration'}
          </p>
        </div>
        {stackable && (
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: maxDisplay }, (_, index) => {
              const active = index < inspiration.count;
              const overMax =
                inspiration.maxCount != null && index >= inspiration.maxCount;
              return (
                <button
                  key={index}
                  type="button"
                  aria-label={active ? 'Use inspiration' : 'Gain inspiration'}
                  disabled={readonly || (overMax && !active)}
                  onClick={() => {
                    if (active)
                      onUpdateInspiration?.({
                        count: Math.max(0, inspiration.count - 1),
                      });
                    else onAddInspiration?.(1);
                  }}
                  className="focus-visible:outline-ring flex size-10 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 pointer-coarse:size-11"
                >
                  <span
                    aria-hidden="true"
                    className={`border-brass-border size-4 rounded-full border ${active ? 'bg-brass-fill' : ''}`}
                  />
                </button>
              );
            })}
          </div>
        )}
        {!readonly && !hideControls && (
          <div className="flex flex-wrap justify-center gap-2">
            {stackable ? (
              <>
                {onAddInspiration && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onAddInspiration(1)}
                    disabled={
                      inspiration.maxCount != null &&
                      inspiration.count >= inspiration.maxCount
                    }
                  >
                    Gain inspiration
                  </Button>
                )}
                {onUseInspiration && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onUseInspiration}
                    disabled={inspiration.count === 0}
                  >
                    Use inspiration
                  </Button>
                )}
              </>
            ) : inspiration.count > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onUseInspiration}
              >
                Use inspiration
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onAddInspiration?.(1)}
              >
                Gain inspiration
              </Button>
            )}
          </div>
        )}
        {!hideHelperText && !compact && (
          <div className="text-muted space-y-1 text-center text-sm">
            <p>
              <strong>Heroic Inspiration:</strong> Use it to reroll any die you
              just rolled. You must use the new roll.
            </p>
            <p>
              {stackable
                ? 'Your DM allows stacking.'
                : "Your DM doesn't allow stacking."}
            </p>
          </div>
        )}
        {!compact &&
          (dmControlled || (showStackableControl && settingsAllowed)) && (
            <div className="border-divider border-t pt-3">
              {dmControlled ? (
                <p className="text-muted text-sm">Set by your DM.</p>
              ) : (
                <Switch
                  label="Allow stacking (house rule)"
                  checked={stackable}
                  onCheckedChange={enabled => onToggleStackable?.(enabled)}
                />
              )}
            </div>
          )}
        {settingsAllowed && stackable && (
          <NumberInput
            label="Maximum"
            value={inspiration.maxCount}
            onChange={value => onUpdateInspiration?.({ maxCount: value })}
            min={0}
            allowEmpty
            live={false}
            placeholder="No maximum"
          />
        )}
      </div>
    </Section>
  );
}
