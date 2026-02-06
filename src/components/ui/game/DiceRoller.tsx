import React, { useState } from 'react';
import { useDiceRoller, UseDiceRollerOptions } from '@/hooks/useDiceRoller';
import { DiceResultDisplay } from './DiceResultDisplay';
import { RollSummary } from '@/types/dice';

export interface DiceRollerProps
  extends Omit<UseDiceRollerOptions, 'containerId'> {
  containerId?: string;
  showControls?: boolean;
  showHistory?: boolean;
  showQuickButtons?: boolean;
  showCustomInput?: boolean;
  showAutoClearControl?: boolean;
  maxHistoryResults?: number;
  quickButtons?: Array<{
    label: string;
    notation: string;
    color?: string;
  }>;
  className?: string;
  onRollResult?: (summary: RollSummary) => void;
}

export function DiceRoller({
  containerId = 'dice-roller-container',
  showControls = true,
  showHistory = true,
  showQuickButtons = true,
  showCustomInput = true,
  showAutoClearControl = true,
  maxHistoryResults = 10,
  quickButtons = [
    { label: '1d20', notation: '1d20', color: 'bg-blue-500 hover:bg-blue-600' },
    { label: '2d6', notation: '2d6', color: 'bg-green-500 hover:bg-green-600' },
    {
      label: '1d12',
      notation: '1d12',
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    { label: '4d6', notation: '4d6', color: 'bg-red-500 hover:bg-red-600' },
  ],
  className = '',
  onRollResult,
  ...diceOptions
}: DiceRollerProps) {
  const [customNotation, setCustomNotation] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [
      ...prev.slice(-9),
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const handleRollComplete = (summary: RollSummary) => {
    if (onRollResult) {
      onRollResult(summary);
    }
  };

  const {
    isInitialized,
    isRolling,
    rollHistory,
    roll,
    clearDice,
    clearHistory,
    setAutoClearDelay,
    autoClearDelay,
  } = useDiceRoller({
    containerId,
    onRollComplete: handleRollComplete,
    onError: addLog,
    onLog: addLog,
    ...diceOptions,
  });

  const handleCustomRoll = () => {
    if (customNotation.trim()) {
      roll(customNotation.trim());
      setCustomNotation('');
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Dice Container */}
      <div
        id={containerId}
        className="pointer-events-none fixed inset-0"
        style={{
          width: '100vw',
          height: '100vh',
          top: 0,
          left: 0,
          zIndex: 9999,
          position: 'fixed',
        }}
      />
      <style jsx global>{`
        #${containerId} {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
        }
        #${containerId} canvas,
        #${containerId} > div,
        #${containerId} > canvas {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          max-height: 100% !important;
          display: block !important;
        }
      `}</style>

      {/* Status */}
      {showControls && (
        <div className="border-divider bg-surface-raised rounded-lg border p-4 shadow">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Dice Roller</h3>
            <div
              className={`flex items-center gap-2 ${isInitialized ? 'text-green-600' : 'text-yellow-600'}`}
            >
              <div
                className={`h-3 w-3 rounded-full ${isInitialized ? 'bg-green-500' : 'bg-yellow-500'}`}
              ></div>
              <span className="text-sm">
                {isRolling
                  ? 'Rolling...'
                  : isInitialized
                    ? 'Ready'
                    : 'Initializing...'}
              </span>
            </div>
          </div>

          {/* Clear Controls */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={clearDice}
              disabled={!isInitialized}
              className="rounded bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-600 disabled:bg-gray-300"
            >
              🧹 Clear Dice
            </button>
            {showHistory && (
              <button
                onClick={clearHistory}
                disabled={rollHistory.length === 0}
                className="rounded bg-gray-500 px-4 py-2 text-white transition-colors hover:bg-gray-600 disabled:bg-gray-300"
              >
                Clear History
              </button>
            )}
          </div>

          {/* Auto-clear control */}
          {showAutoClearControl && (
            <div className="mb-4 flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Auto-clear:
              </label>
              <select
                value={autoClearDelay}
                onChange={e => setAutoClearDelay(Number(e.target.value))}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value={0}>Disabled</option>
                <option value={2000}>2 seconds</option>
                <option value={3000}>3 seconds</option>
                <option value={5000}>5 seconds</option>
                <option value={10000}>10 seconds</option>
              </select>
            </div>
          )}

          {/* Quick Buttons */}
          {showQuickButtons && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700">
                Quick Rolls
              </h4>
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {quickButtons.map((button, index) => (
                  <button
                    key={index}
                    onClick={() => roll(button.notation)}
                    disabled={!isInitialized || isRolling}
                    className={`rounded px-3 py-2 text-white transition-colors disabled:bg-gray-300 ${
                      button.color || 'bg-blue-500 hover:bg-blue-600'
                    }`}
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Input */}
          {showCustomInput && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700">
                Custom Roll
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customNotation}
                  onChange={e => setCustomNotation(e.target.value)}
                  placeholder="e.g., 3d8+2"
                  className="flex-1 rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleCustomRoll();
                    }
                  }}
                  disabled={!isInitialized || isRolling}
                />
                <button
                  onClick={handleCustomRoll}
                  disabled={
                    !isInitialized || isRolling || !customNotation.trim()
                  }
                  className="rounded bg-orange-500 px-4 py-2 text-white transition-colors hover:bg-orange-600 disabled:bg-gray-300"
                >
                  Roll
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Display */}
      {showHistory && (
        <DiceResultDisplay
          rollHistory={rollHistory}
          onClearHistory={clearHistory}
          maxResults={maxHistoryResults}
        />
      )}

      {/* Debug Logs (minimal) */}
      {logs.length > 0 && (
        <details className="rounded bg-gray-50 p-2">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            Debug Logs ({logs.length})
          </summary>
          <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="font-mono text-xs text-gray-600">
                {log}
              </div>
            ))}
          </div>
          <button
            onClick={clearLogs}
            className="mt-2 rounded bg-gray-500 px-2 py-1 text-xs text-white hover:bg-gray-600"
          >
            Clear Logs
          </button>
        </details>
      )}
    </div>
  );
}
