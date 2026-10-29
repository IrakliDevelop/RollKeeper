'use client';

import React, { useState } from 'react';
import { Button, Switch } from '@/components/ui/forms';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Section } from '@/components/ui/layout/section';
import {
  getXPForLevel,
  getXPToNextLevel,
  getXPProgress,
} from '@/utils/calculations';

interface XPTrackerProps {
  editing?: boolean;
  hideHeading?: boolean;
  currentXP: number;
  currentLevel: number;
  onAddXP?: (xpToAdd: number) => void;
  onSetXP?: (newXP: number) => void;

  // Display options
  readonly?: boolean;
  compact?: boolean;
  hideControls?: boolean;
  hideProgressBar?: boolean;
  hideLevelUpAlert?: boolean;
  hideThresholds?: boolean;
  pendingLevelUp?: boolean;

  className?: string;
}

export function XPTracker({
  editing = true,
  hideHeading = false,
  currentXP,
  currentLevel,
  onAddXP,
  onSetXP,
  readonly = false,
  compact = false,
  hideControls = false,
  hideProgressBar = false,
  hideLevelUpAlert = false,
  hideThresholds = false,
  pendingLevelUp = false,
  className = '',
}: XPTrackerProps) {
  const [mode, setMode] = useState<'add' | 'set'>('add');
  const [inputValue, setInputValue] = useState<number | undefined>(undefined);

  const xpToNext = getXPToNextLevel(currentXP, currentLevel);
  const progress = getXPProgress(currentXP, currentLevel);
  const isMaxLevel = currentLevel >= 20;

  const effectiveMode = editing && mode === 'set' ? 'set' : 'add';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputValue;

    if (value === undefined || value < 0) return;

    if (effectiveMode === 'add' && onAddXP) {
      onAddXP(value);
    } else if (effectiveMode === 'set' && onSetXP) {
      onSetXP(value);
    }

    setInputValue(undefined);
  };

  const content = (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="type-num-lg text-heading">
            {currentXP.toLocaleString()}
          </div>
          <div className="type-caption text-muted">XP</div>
        </div>
        <div>
          <div className="type-num-lg text-heading">{currentLevel}</div>
          <div className="type-caption text-muted">Level</div>
        </div>
      </div>
      {!isMaxLevel && !hideProgressBar && (
        <div className="space-y-2">
          <div className="type-small text-muted flex flex-wrap justify-between gap-2">
            <span>To next level</span>
            {!pendingLevelUp && <span>{xpToNext.toLocaleString()} XP</span>}
          </div>
          <div
            className="bg-divider h-1 w-full"
            role="progressbar"
            aria-label={`XP progress to level ${currentLevel + 1}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number(progress.toFixed(1))}
          >
            <div
              className="bg-heading h-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="type-small text-muted">
            {pendingLevelUp && !hideLevelUpAlert
              ? `Enough XP for level ${currentLevel + 1}`
              : `${progress.toFixed(1)}% to level ${currentLevel + 1}`}
          </p>
        </div>
      )}
      {isMaxLevel && <p className="type-small text-muted">Level 20 reached</p>}
      {!readonly && !hideControls && (onAddXP || onSetXP) && (
        <div className="space-y-3">
          {editing && onAddXP && onSetXP && !compact && (
            <Switch
              label="Set XP"
              checked={mode === 'set'}
              onCheckedChange={checked => setMode(checked ? 'set' : 'add')}
            />
          )}
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <NumberInput
              aria-label={effectiveMode === 'add' ? 'XP to add' : 'Total XP'}
              value={inputValue}
              onChange={setInputValue}
              allowEmpty
              min={0}
              placeholder={effectiveMode === 'add' ? '300' : '6500'}
            />
            <Button
              type="submit"
              disabled={inputValue === undefined}
              size={compact ? 'sm' : 'md'}
            >
              {effectiveMode === 'add' ? 'Add' : 'Set'}
            </Button>
          </form>
        </div>
      )}
      {!isMaxLevel && !hideThresholds && !compact && (
        <div className="type-small text-muted border-divider grid grid-cols-2 gap-2 border-t pt-2">
          <div>
            Level {currentLevel}: {getXPForLevel(currentLevel).toLocaleString()}{' '}
            XP
          </div>
          <div>
            Level {currentLevel + 1}:{' '}
            {getXPForLevel(currentLevel + 1).toLocaleString()} XP
          </div>
        </div>
      )}
    </div>
  );
  return hideHeading ? (
    content
  ) : (
    <Section heading={compact ? 'XP' : 'Experience points'} level={3}>
      {content}
    </Section>
  );
}
