import React from 'react';
import { RollSummary } from '@/types/dice';
import {
  formatDiceResults,
  getRollResultColor,
  hasCriticalSuccess,
  hasCriticalFailure,
} from '@/utils/diceUtils';

interface DiceResultDisplayProps {
  rollHistory: RollSummary[];
  onClearHistory: () => void;
  maxResults?: number;
}

export function DiceResultDisplay({
  rollHistory,
  onClearHistory,
  maxResults = 10,
}: DiceResultDisplayProps) {
  const recentRolls = rollHistory.slice(-maxResults).reverse();

  if (recentRolls.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-4 shadow">
        <h3 className="mb-2 text-lg font-bold text-gray-900">
          Dice Roll Results
        </h3>
        <p className="text-sm text-gray-500 italic">
          No rolls yet. Start rolling some dice!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Dice Roll Results</h3>
        <button
          onClick={onClearHistory}
          className="rounded bg-gray-500 px-3 py-1 text-sm text-white transition-colors hover:bg-gray-600"
        >
          Clear History
        </button>
      </div>

      <div className="max-h-96 space-y-3 overflow-y-auto">
        {recentRolls.map(roll => (
          <DiceResultItem key={roll.rollId} summary={roll} />
        ))}
      </div>

      {rollHistory.length > maxResults && (
        <p className="mt-2 text-center text-xs text-gray-500">
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
    <div
      className={`rounded-lg border-l-4 p-3 ${
        isCritSuccess
          ? 'border-green-500 bg-green-50'
          : isCritFailure
            ? 'border-red-500 bg-red-50'
            : 'border-gray-300 bg-gray-50'
      }`}
    >
      {/* Main result */}
      <div className={`font-mono text-sm ${resultColor}`}>
        {formatDiceResults(summary)}
      </div>

      {/* Individual dice breakdown */}
      <div className="mt-2 flex flex-wrap gap-1">
        {summary.diceResults.map((die, index) => (
          <span
            key={index}
            className={`inline-flex items-center rounded px-2 py-1 text-xs font-semibold ${
              die.value === die.sides
                ? 'bg-green-200 text-green-800'
                : die.value === 1
                  ? 'bg-red-200 text-red-800'
                  : 'bg-gray-200 text-gray-700'
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
      <div className="mt-1 text-xs text-gray-500">
        {summary.rollTime.toLocaleTimeString()}
      </div>

      {/* Critical indicators */}
      {isCritSuccess && (
        <div className="mt-1 text-xs font-semibold text-green-600">
          🎉 Critical Success!
        </div>
      )}
      {isCritFailure && (
        <div className="mt-1 text-xs font-semibold text-red-600">
          💥 Critical Failure!
        </div>
      )}
    </div>
  );
}
