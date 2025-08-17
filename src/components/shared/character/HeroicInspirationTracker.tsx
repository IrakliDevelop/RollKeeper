'use client';

import React, { useState } from 'react';
import { HeroicInspiration } from '@/types/character';
import { Star, Plus, Minus, RotateCcw, Settings } from 'lucide-react';

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
  className = ''
}: HeroicInspirationTrackerProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [maxCountInput, setMaxCountInput] = useState(inspiration.maxCount?.toString() || '');

  const handleMaxCountChange = () => {
    const newMax = maxCountInput.trim() === '' ? undefined : parseInt(maxCountInput) || undefined;
    onUpdateInspiration?.({ maxCount: newMax });
    setShowSettings(false);
  };

  const renderInspirationDice = () => {
    const maxDisplay = Math.max(inspiration.count, inspiration.maxCount || 0, compact ? 3 : 5);
    
    return (
      <div className={`flex flex-wrap gap-2 justify-center ${compact ? 'gap-1' : 'gap-2'}`}>
        {Array.from({ length: maxDisplay }, (_, index) => {
          const isActive = index < inspiration.count;
          const isOverMax = inspiration.maxCount && index >= inspiration.maxCount;
          
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
              className={`
                ${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg border-2 transition-all duration-200 flex items-center justify-center
                ${isActive 
                  ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 border-yellow-600 text-white shadow-lg transform scale-110 hover:shadow-xl' 
                  : isOverMax
                    ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                    : readonly
                      ? 'bg-white border-yellow-300 text-yellow-600'
                      : 'bg-white border-yellow-300 text-yellow-600 hover:border-yellow-500 hover:bg-yellow-50 cursor-pointer'
                }
              `}
              title={
                isActive 
                  ? readonly ? 'Inspiration available' : 'Click to use inspiration'
                  : isOverMax
                    ? 'Over maximum limit'
                    : readonly ? 'No inspiration' : 'Click to add inspiration'
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
    ? `bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border-2 border-yellow-300 p-3 ${className}`
    : `bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border-2 border-yellow-300 p-4 ${className}`;

  return (
    <div className={containerClasses}>
      {!compact && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-600 fill-current" />
            <h3 className="text-lg font-bold text-yellow-800">Heroic Inspiration</h3>
          </div>
          
          {!readonly && !hideSettings && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 text-yellow-600 hover:bg-yellow-100 rounded transition-colors"
                title="Settings"
              >
                <Settings size={16} />
              </button>
              {onResetInspiration && (
                <button
                  onClick={onResetInspiration}
                  className="p-1 text-yellow-600 hover:bg-yellow-100 rounded transition-colors"
                  title="Reset to 0"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Settings Panel */}
      {!readonly && showSettings && !hideSettings && (
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
        <div className={`font-bold text-yellow-800 ${compact ? 'text-xl' : 'text-3xl'}`}>
          {inspiration.count}
          {inspiration.maxCount && (
            <span className={`text-yellow-600 ml-1 ${compact ? 'text-sm' : 'text-lg'}`}>
              / {inspiration.maxCount}
            </span>
          )}
        </div>
        {!compact && (
          <div className="text-sm text-yellow-700">
            {inspiration.count === 0 ? 'No inspiration available' : 
             inspiration.count === 1 ? '1 inspiration die' :
             `${inspiration.count} inspiration dice`}
          </div>
        )}
      </div>

      {/* Inspiration Dice Visual */}
      <div className="mb-4">
        {renderInspirationDice()}
      </div>

      {/* Action Buttons */}
      {!readonly && !hideControls && (
        <div className="flex justify-center gap-2">
          {onAddInspiration && (
            <button
              onClick={() => onAddInspiration(1)}
              disabled={inspiration.maxCount ? inspiration.count >= inspiration.maxCount : false}
              className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              Add
            </button>
          )}
          {onUseInspiration && (
            <button
              onClick={onUseInspiration}
              disabled={inspiration.count === 0}
              className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              <Minus size={16} />
              Use
            </button>
          )}
        </div>
      )}

      {/* Helper Text */}
      {!hideHelperText && !compact && (
        <div className="mt-3 text-xs text-center text-yellow-700 bg-yellow-100 rounded p-2">
          <p><strong>Heroic Inspiration:</strong> Reroll a d20 die and use the new roll.</p>
          <p className="mt-1">Unlike regular inspiration, you can have multiple dice and they stack!</p>
        </div>
      )}
    </div>
  );
}
