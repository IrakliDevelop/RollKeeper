'use client';

import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { Button, Input, Switch } from '@/components/ui/forms';
import {
  getXPForLevel,
  getXPToNextLevel,
  getXPProgress,
  shouldLevelUp,
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
  className = '',
}: XPTrackerProps) {
  const [mode, setMode] = useState<'add' | 'set'>('add');
  const [inputValue, setInputValue] = useState('');
  const [showLevelUp, setShowLevelUp] = useState(false);

  const xpToNext = getXPToNextLevel(currentXP, currentLevel);
  const progress = getXPProgress(currentXP, currentLevel);
  const isMaxLevel = currentLevel >= 20;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseInt(inputValue);

    if (isNaN(value) || value < 0) return;

    if (mode === 'add' && onAddXP) {
      onAddXP(value);
      if (!hideLevelUpAlert && shouldLevelUp(currentXP + value, currentLevel)) {
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 3000);
      }
    } else if (mode === 'set' && onSetXP) {
      onSetXP(value);
      if (!hideLevelUpAlert && shouldLevelUp(value, currentLevel)) {
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 3000);
      }
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
        {!hideLevelUpAlert && showLevelUp && (
          <div className="flex animate-pulse items-center space-x-1 font-bold text-green-600">
            <TrendingUp size={16} />
            <span className="text-sm">LEVEL UP!</span>
          </div>
        )}
      </div>

      {/* Current XP and Level Display */}
      <div
        className={
          compact
            ? 'flex items-center justify-between'
            : 'grid grid-cols-2 gap-4'
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
            <span className="text-heading font-semibold">
              {xpToNext.toLocaleString()} XP
            </span>
          </div>
          <div
            className={`bg-bg-tertiary w-full rounded-full ${compact ? 'h-2' : 'h-3'}`}
          >
            <div
              className={`rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out ${compact ? 'h-2' : 'h-3'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-muted text-center text-xs">
            {progress.toFixed(1)}% to Level {currentLevel + 1}
          </div>
        </div>
      )}

      {isMaxLevel && (
        <div className="border-accent-amber-border bg-accent-amber-bg rounded-md border p-3 text-center">
          <div
            className={`text-accent-amber-text font-medium ${compact ? 'text-xs' : 'text-sm'}`}
          >
            🎉 Maximum Level Reached! 🎉
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
                ➕ Add XP
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
                ✏️ Set XP
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
