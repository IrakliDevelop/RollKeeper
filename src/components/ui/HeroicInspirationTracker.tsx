'use client';

import React, { useState } from 'react';
import { HeroicInspiration } from '@/types/character';
import { Star, Plus, Minus, RotateCcw, Settings } from 'lucide-react';

interface HeroicInspirationTrackerProps {
  inspiration: HeroicInspiration;
  onUpdateInspiration: (updates: Partial<HeroicInspiration>) => void;
  onAddInspiration: (amount?: number) => void;
  onUseInspiration: () => void;
  onResetInspiration: () => void;
  className?: string;
}

export default function HeroicInspirationTracker({
  inspiration,
  onUpdateInspiration,
  onAddInspiration,
  onUseInspiration,
  onResetInspiration,
  className = ''
}: HeroicInspirationTrackerProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [maxCountInput, setMaxCountInput] = useState(inspiration.maxCount?.toString() || '');

  const handleMaxCountChange = () => {
    const newMax = maxCountInput.trim() === '' ? undefined : parseInt(maxCountInput) || undefined;
    onUpdateInspiration({ maxCount: newMax });
    setShowSettings(false);
  };

  const renderInspirationDice = () => {
    const maxDisplay = Math.max(inspiration.count, inspiration.maxCount || 0, 5); // Show at least 5 slots
    return (
      <div className="flex flex-wrap gap-2 justify-center">
        {Array.from({ length: maxDisplay }, (_, index) => {
          const isActive = index < inspiration.count;
          const isOverMax = inspiration.maxCount && index >= inspiration.maxCount;
          
          return (
            <button
              key={index}
              onClick={() => {
                if (isActive) {
                  // Click on active dice to remove
                  const newCount = Math.max(0, inspiration.count - 1);
                  onUpdateInspiration({ count: newCount });
                } else if (!isOverMax) {
                  // Click on inactive dice to add (if not over max)
                  onAddInspiration(1);
                }
              }}
              disabled={Boolean(isOverMax && !isActive)}
              className={`
                w-10 h-10 rounded-lg border-2 transition-all duration-200 flex items-center justify-center
                ${isActive 
                  ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 border-yellow-600 text-white shadow-lg transform scale-110 hover:shadow-xl' 
                  : isOverMax
                    ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                    : 'bg-white border-yellow-300 text-yellow-600 hover:border-yellow-500 hover:bg-yellow-50 cursor-pointer'
                }
              `}
              title={
                isActive 
                  ? 'Click to use inspiration'
                  : isOverMax
                    ? 'Over maximum limit'
                    : 'Click to add inspiration'
              }
            >
              <Star 
                size={16} 
                className={isActive ? 'fill-current' : ''} 
              />
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border-2 border-yellow-300 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-600 fill-current" />
          <h3 className="text-lg font-bold text-yellow-800">Heroic Inspiration</h3>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 text-yellow-600 hover:bg-yellow-100 rounded transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={onResetInspiration}
            className="p-1 text-yellow-600 hover:bg-yellow-100 rounded transition-colors"
            title="Reset to 0"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-3 bg-white rounded-lg border border-yellow-200">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Max Inspiration:</label>
            <input
              type="number"
              value={maxCountInput}
              onChange={(e) => setMaxCountInput(e.target.value)}
              placeholder="Unlimited"
              min="0"
              className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 text-sm"
            />
            <button
              onClick={handleMaxCountChange}
              className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition-colors"
            >
              Set
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="px-3 py-1 bg-gray-400 text-white rounded text-sm hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Current Count Display */}
      <div className="text-center mb-4">
        <div className="text-3xl font-bold text-yellow-800">
          {inspiration.count}
          {inspiration.maxCount && (
            <span className="text-lg text-yellow-600 ml-1">/ {inspiration.maxCount}</span>
          )}
        </div>
        <div className="text-sm text-yellow-700">
          {inspiration.count === 0 ? 'No inspiration available' : 
           inspiration.count === 1 ? '1 inspiration die' :
           `${inspiration.count} inspiration dice`}
        </div>
      </div>

      {/* Inspiration Dice Visual */}
      <div className="mb-4">
        {renderInspirationDice()}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => onAddInspiration(1)}
          disabled={inspiration.maxCount ? inspiration.count >= inspiration.maxCount : false}
          className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Add
        </button>
        <button
          onClick={onUseInspiration}
          disabled={inspiration.count === 0}
          className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          <Minus size={16} />
          Use
        </button>
      </div>

      {/* Helper Text */}
      <div className="mt-3 text-xs text-center text-yellow-700 bg-yellow-100 rounded p-2">
        <p><strong>Heroic Inspiration:</strong> Reroll a d20 die and use the new roll.</p>
        <p className="mt-1">Unlike regular inspiration, you can have multiple dice and they stack!</p>
      </div>
    </div>
  );
} 