import React from 'react';
import { RollSummary } from '@/types/dice';
import { formatDiceResults, getRollResultColor, hasCriticalSuccess, hasCriticalFailure } from '@/utils/diceUtils';

interface DiceResultDisplayProps {
  rollHistory: RollSummary[];
  onClearHistory: () => void;
  maxResults?: number;
}

export function DiceResultDisplay({ 
  rollHistory, 
  onClearHistory, 
  maxResults = 10 
}: DiceResultDisplayProps) {
  const recentRolls = rollHistory.slice(-maxResults).reverse();
  
  if (recentRolls.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 border">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Dice Roll Results</h3>
        <p className="text-gray-500 italic text-sm">No rolls yet. Start rolling some dice!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-900">Dice Roll Results</h3>
        <button
          onClick={onClearHistory}
          className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
        >
          Clear History
        </button>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {recentRolls.map((roll) => (
          <DiceResultItem key={roll.rollId} summary={roll} />
        ))}
      </div>
      
      {rollHistory.length > maxResults && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Showing last {maxResults} of {rollHistory.length} rolls
        </p>
      )}
    </div>
  );
}

interface DiceResultItemProps {
  summary: RollSummary;
}

function DiceResultItem({ summary }: DiceResultItemProps) {
  const resultColor = getRollResultColor(summary);
  const isCritSuccess = hasCriticalSuccess(summary.diceResults);
  const isCritFailure = hasCriticalFailure(summary.diceResults);
  
  return (
    <div className={`p-3 rounded-lg border-l-4 ${
      isCritSuccess ? 'border-green-500 bg-green-50' :
      isCritFailure ? 'border-red-500 bg-red-50' :
      'border-gray-300 bg-gray-50'
    }`}>
      {/* Main result */}
      <div className={`font-mono text-sm ${resultColor}`}>
        {formatDiceResults(summary)}
      </div>
      
      {/* Individual dice breakdown */}
      <div className="mt-2 flex flex-wrap gap-1">
        {summary.diceResults.map((die, index) => (
          <span
            key={index}
            className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
              die.value === die.sides ? 'bg-green-200 text-green-800' :
              die.value === 1 ? 'bg-red-200 text-red-800' :
              'bg-gray-200 text-gray-700'
            }`}
            title={`${die.dieType}: rolled ${die.value}`}
          >
            {die.dieType}: {die.value}
            {die.value === die.sides && ' 🎉'}
            {die.value === 1 && ' 💥'}
          </span>
        ))}
      </div>
      
      {/* Timestamp */}
      <div className="text-xs text-gray-500 mt-1">
        {summary.rollTime.toLocaleTimeString()}
      </div>
      
      {/* Critical indicators */}
      {isCritSuccess && (
        <div className="text-xs text-green-600 font-semibold mt-1">
          🎉 Critical Success!
        </div>
      )}
      {isCritFailure && (
        <div className="text-xs text-red-600 font-semibold mt-1">
          💥 Critical Failure!
        </div>
      )}
    </div>
  );
}