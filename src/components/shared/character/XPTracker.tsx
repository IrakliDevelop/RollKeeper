'use client';

import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { Button, Input, Switch } from '@/components/ui/forms';
import { AppIcon } from '@/components/ui/icons';
import {
  getXPForLevel,
  getXPToNextLevel,
  getXPProgress,
} from '@/utils/calculations';

interface XPTrackerProps {
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
  const [inputValue, setInputValue] = useState('');

  const xpToNext = getXPToNextLevel(currentXP, currentLevel);
  const progress = getXPProgress(currentXP, currentLevel);
  const isMaxLevel = currentLevel >= 20;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseInt(inputValue);

    if (isNaN(value) || value < 0) return;

    if (mode === 'add' && onAddXP) {
      onAddXP(value);
    } else if (mode === 'set' && onSetXP) {
      onSetXP(value);
    }

    setInputValue('');
  };

  const containerClasses = compact
    ? `bg-surface-raised rounded-lg border border-divider p-3 space-y-3 ${className}`
    : `bg-surface-raised rounded-lg border border-divider p-4 space-y-4 ${className}`;

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between">
        <h3
          className={`text-accent-indigo-text flex items-center gap-2 font-semibold ${compact ? 'text-base' : 'text-lg'}`}
        >
          <TrendingUp size={compact ? 16 : 20} />
          {compact ? 'XP' : 'Experience Points'}
        </h3>
        {!hideLevelUpAlert && pendingLevelUp && (
          <div className="border-accent-emerald-border bg-accent-emerald-bg text-accent-emerald-text flex animate-pulse items-center gap-1 rounded-md border px-2 py-0.5 font-bold">
            <TrendingUp size={16} />
            <span className="text-sm">Level up available!</span>
          </div>
        )}
      </div>

      {/* Current XP and Level Display */}
      <div
        className={
          compact ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-4'
        }
      >
        <div className="text-center">
          <div
            className={`text-accent-indigo-text font-bold ${compact ? 'text-lg' : 'text-2xl'}`}
          >
            {currentXP.toLocaleString()}
          </div>
          <div className={`text-muted ${compact ? 'text-xs' : 'text-xs'}`}>
            {compact ? 'XP' : 'Current XP'}
          </div>
        </div>
        <div className="text-center">
          <div
            className={`text-accent-purple-text font-bold ${compact ? 'text-lg' : 'text-2xl'}`}
          >
            Level {currentLevel}
          </div>
          <div className={`text-muted ${compact ? 'text-xs' : 'text-xs'}`}>
            {compact ? 'Level' : 'Current Level'}
          </div>
        </div>
      </div>

      {/* Progress to Next Level */}
      {!isMaxLevel && !hideProgressBar && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted">To Next Level:</span>
            {pendingLevelUp ? (
              <span className="text-accent-emerald-text font-semibold">
                Level-up pending
              </span>
            ) : (
              <span className="text-heading font-semibold">
                {xpToNext.toLocaleString()} XP
              </span>
            )}
          </div>
          <div
            className={`bg-divider-strong w-full overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/10 ${compact ? 'h-2.5' : 'h-3'}`}
            role="progressbar"
            aria-label={`XP progress to level ${currentLevel + 1}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number(progress.toFixed(1))}
          >
            <div
              className={`rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 shadow-sm transition-all duration-500 ease-out ${compact ? 'h-2.5' : 'h-3'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-muted text-center text-xs">
            {pendingLevelUp
              ? 'Level-up pending — use the Level Up button'
              : `${progress.toFixed(1)}% to Level ${currentLevel + 1}`}
          </div>
        </div>
      )}

      {isMaxLevel && (
        <div className="border-accent-amber-border bg-accent-amber-bg rounded-md border p-3 text-center">
          <div
            className={`text-accent-amber-text flex items-center justify-center gap-1 font-medium ${compact ? 'text-xs' : 'text-sm'}`}
          >
            <AppIcon name="criticalSuccess" className="h-4 w-4" />
            Maximum Level Reached!
          </div>
        </div>
      )}

      {/* XP Management Form */}
      {!readonly && !hideControls && (onAddXP || onSetXP) && (
        <div
          className={`border-divider space-y-3 border-t pt-3 ${compact ? 'space-y-2 pt-2' : ''}`}
        >
          {onAddXP && onSetXP && !compact && (
            <div className="flex items-center justify-center gap-3">
              <span
                className={`text-sm font-medium ${mode === 'add' ? 'text-accent-indigo-text-muted' : 'text-muted'}`}
              >
                <span className="inline-flex items-center gap-1">
                  <AppIcon name="experience" className="h-3.5 w-3.5" /> Add XP
                </span>
              </span>
              <Switch
                checked={mode === 'set'}
                onCheckedChange={checked => setMode(checked ? 'set' : 'add')}
                size="sm"
                variant="default"
              />
              <span
                className={`text-sm font-medium ${mode === 'set' ? 'text-accent-indigo-text-muted' : 'text-muted'}`}
              >
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Set XP
                </span>
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              type="number"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={mode === 'add' ? 'XP to add...' : 'Total XP...'}
              min="0"
              className={`flex-1 ${compact ? 'text-sm' : 'text-sm'}`}
            />
            <Button
              type="submit"
              disabled={!inputValue || isNaN(parseInt(inputValue))}
              variant="primary"
              size={compact ? 'sm' : 'md'}
              className="bg-accent-indigo-text-muted hover:bg-accent-indigo-text"
            >
              {mode === 'add' ? 'Add' : 'Set'}
            </Button>
          </form>

          {!compact && (
            <div className="text-muted text-xs">
              {mode === 'add'
                ? '• Add XP from encounters, quests, or other sources'
                : '• Set total XP directly (useful for importing characters)'}
            </div>
          )}
        </div>
      )}

      {/* Level Thresholds Reference */}
      {!isMaxLevel && !hideThresholds && !compact && (
        <div className="border-divider text-muted border-t pt-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              Level {currentLevel}:{' '}
              {getXPForLevel(currentLevel).toLocaleString()} XP
            </div>
            <div>
              Level {currentLevel + 1}:{' '}
              {getXPForLevel(currentLevel + 1).toLocaleString()} XP
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
