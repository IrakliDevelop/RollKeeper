'use client';

import React, { useState } from 'react';
import { Plus, Edit3, TrendingUp } from 'lucide-react';
import { 
  getXPForLevel, 
  getXPToNextLevel, 
  getXPProgress,
  shouldLevelUp 
} from '@/utils/calculations';

interface XPTrackerProps {
  currentXP: number;
  currentLevel: number;
  onAddXP: (xpToAdd: number) => void;
  onSetXP: (newXP: number) => void;
  className?: string;
}

export default function XPTracker({
  currentXP,
  currentLevel,
  onAddXP,
  onSetXP,
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

    const oldLevel = currentLevel;
    
    if (mode === 'add') {
      onAddXP(value);
      // Check if this will cause a level up
      if (shouldLevelUp(currentXP + value, currentLevel)) {
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 3000);
      }
    } else {
      onSetXP(value);
      // Check if this will cause a level up
      if (shouldLevelUp(value, currentLevel)) {
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 3000);
      }
    }
    
    setInputValue('');
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-indigo-800">Experience Points</h3>
        {showLevelUp && (
          <div className="flex items-center space-x-1 text-green-600 font-bold animate-pulse">
            <TrendingUp size={16} />
            <span className="text-sm">LEVEL UP!</span>
          </div>
        )}
      </div>

      {/* Current XP and Level Display */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-indigo-800">{currentXP.toLocaleString()}</div>
          <div className="text-xs text-gray-600">Current XP</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-800">Level {currentLevel}</div>
          <div className="text-xs text-gray-600">Current Level</div>
        </div>
      </div>

      {/* Progress to Next Level */}
      {!isMaxLevel && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">To Next Level:</span>
            <span className="font-semibold text-gray-800">{xpToNext.toLocaleString()} XP</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 text-center">
            {progress.toFixed(1)}% to Level {currentLevel + 1}
          </div>
        </div>
      )}

      {isMaxLevel && (
        <div className="text-center p-3 bg-gold-50 border border-yellow-300 rounded-md">
          <div className="text-sm font-medium text-yellow-800">
            🎉 Maximum Level Reached! 🎉
          </div>
        </div>
      )}

      {/* XP Management Form */}
      <div className="space-y-3 border-t border-gray-100 pt-3">
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="xpMode"
              checked={mode === 'add'}
              onChange={() => setMode('add')}
              className="mr-2"
            />
            <span className="text-sm flex items-center space-x-1">
              <Plus size={14} />
              <span>Add XP</span>
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="xpMode"
              checked={mode === 'set'}
              onChange={() => setMode('set')}
              className="mr-2"
            />
            <span className="text-sm flex items-center space-x-1">
              <Edit3 size={14} />
              <span>Set XP</span>
            </span>
          </label>
        </div>

        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={mode === 'add' ? 'XP to add...' : 'Total XP...'}
            min="0"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-800"
          />
          <button
            type="submit"
            disabled={!inputValue || isNaN(parseInt(inputValue))}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {mode === 'add' ? 'Add' : 'Set'}
          </button>
        </form>

        <div className="text-xs text-gray-500">
          {mode === 'add' 
            ? '• Add XP from encounters, quests, or other sources'
            : '• Set total XP directly (useful for importing characters)'
          }
        </div>
      </div>

      {/* Level Thresholds Reference */}
      {!isMaxLevel && (
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