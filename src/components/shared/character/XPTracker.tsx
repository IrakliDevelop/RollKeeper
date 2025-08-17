'use client';

import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { CustomSwitcher } from '@/components/ui/CustomSwitcher';
import { 
  getXPForLevel, 
  getXPToNextLevel, 
  getXPProgress,
  shouldLevelUp 
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
  className = ''
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
    ? `bg-white rounded-lg border border-gray-200 p-3 space-y-3 ${className}`
    : `bg-white rounded-lg border border-gray-200 p-4 space-y-4 ${className}`;

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-indigo-800 flex items-center gap-2 ${compact ? 'text-base' : 'text-lg'}`}>
          <TrendingUp size={compact ? 16 : 20} />
          {compact ? 'XP' : 'Experience Points'}
        </h3>
        {!hideLevelUpAlert && showLevelUp && (
          <div className="flex items-center space-x-1 text-green-600 font-bold animate-pulse">
            <TrendingUp size={16} />
            <span className="text-sm">LEVEL UP!</span>
          </div>
        )}
      </div>

      {/* Current XP and Level Display */}
      <div className={compact ? 'flex items-center justify-between' : 'grid grid-cols-2 gap-4'}>
        <div className="text-center">
          <div className={`font-bold text-indigo-800 ${compact ? 'text-lg' : 'text-2xl'}`}>
            {currentXP.toLocaleString()}
          </div>
          <div className={`text-gray-600 ${compact ? 'text-xs' : 'text-xs'}`}>
            {compact ? 'XP' : 'Current XP'}
          </div>
        </div>
        <div className="text-center">
          <div className={`font-bold text-purple-800 ${compact ? 'text-lg' : 'text-2xl'}`}>
            Level {currentLevel}
          </div>
          <div className={`text-gray-600 ${compact ? 'text-xs' : 'text-xs'}`}>
            {compact ? 'Level' : 'Current Level'}
          </div>
        </div>
      </div>

      {/* Progress to Next Level */}
      {!isMaxLevel && !hideProgressBar && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">To Next Level:</span>
            <span className="font-semibold text-gray-800">{xpToNext.toLocaleString()} XP</span>
          </div>
          <div className={`w-full bg-gray-200 rounded-full ${compact ? 'h-2' : 'h-3'}`}>
            <div 
              className={`bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out ${compact ? 'h-2' : 'h-3'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 text-center">
            {progress.toFixed(1)}% to Level {currentLevel + 1}
          </div>
        </div>
      )}

      {isMaxLevel && (
        <div className="text-center p-3 bg-yellow-50 border border-yellow-300 rounded-md">
          <div className={`font-medium text-yellow-800 ${compact ? 'text-xs' : 'text-sm'}`}>
            🎉 Maximum Level Reached! 🎉
          </div>
        </div>
      )}

      {/* XP Management Form */}
      {!readonly && !hideControls && (onAddXP || onSetXP) && (
        <div className={`space-y-3 border-t border-gray-100 pt-3 ${compact ? 'space-y-2 pt-2' : ''}`}>
          {onAddXP && onSetXP && !compact && (
            <CustomSwitcher
              leftLabel="➕ Add XP"
              rightLabel="✏️ Set XP"
              leftValue="add"
              rightValue="set"
              currentValue={mode}
              onChange={(value) => setMode(value as 'add' | 'set')}
              color="blue"
              size="md"
              className="w-full max-w-xs"
            />
          )}

          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={mode === 'add' ? 'XP to add...' : 'Total XP...'}
              min="0"
              className={`flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-800 ${compact ? 'text-sm' : 'text-sm'}`}
            />
            <button
              type="submit"
              disabled={!inputValue || isNaN(parseInt(inputValue))}
              className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors ${compact ? 'text-sm' : 'text-sm'}`}
            >
              {mode === 'add' ? 'Add' : 'Set'}
            </button>
          </form>

          {!compact && (
            <div className="text-xs text-gray-500">
              {mode === 'add' 
                ? '• Add XP from encounters, quests, or other sources'
                : '• Set total XP directly (useful for importing characters)'
              }
            </div>
          )}
        </div>
      )}

      {/* Level Thresholds Reference */}
      {!isMaxLevel && !hideThresholds && !compact && (
        <div className="text-xs text-gray-500 border-t border-gray-100 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div>Level {currentLevel}: {getXPForLevel(currentLevel).toLocaleString()} XP</div>
            <div>Level {currentLevel + 1}: {getXPForLevel(currentLevel + 1).toLocaleString()} XP</div>
          </div>
        </div>
      )}
    </div>
  );
}
