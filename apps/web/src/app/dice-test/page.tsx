'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import './dice-test.css';
// @ts-expect-error - DiceBox is not typed
import DiceBox from '@3d-dice/dice-box';
import { DiceRollResults, RollSummary } from '@/types/dice';
import { calculateRollSummary, autoClearDice } from '@/utils/diceUtils';
import { DiceResultDisplay } from '@/components/ui/game/DiceResultDisplay';

export default function DiceTestPage() {
  const [diceBox, setDiceBox] = useState<typeof DiceBox | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [rollHistory, setRollHistory] = useState<RollSummary[]>([]);
  const [autoClearDelay, setAutoClearDelay] = useState(3000);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  useEffect(() => {
    // Create dice box instance
    const box = new DiceBox({
      assetPath: '/assets/',
      container: '#dice-container',
      scale: 6,
      theme: 'diceOfRolling',
      themeColor: '#feea03',
      offscreen: true,
      throwForce: 5,
      gravity: 1,
      mass: 1,
      spinForce: 6,
    });

    setDiceBox(box);
    addLog('DiceBox instance created');

    // Initialize the dice box
    box
      .init()
      .then(() => {
        addLog('DiceBox initialized successfully!');
        setIsInitialized(true);
      })
      .catch((error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        addLog(`Failed to initialize DiceBox: ${errorMessage}`);
        setInitError(errorMessage);
      });

    return () => {
      // Cleanup if needed
      if (box && box.clear) {
        box.clear();
      }
    };
  }, []);

  const rollDice = async (notation: string) => {
    if (!diceBox || !isInitialized) {
      addLog('DiceBox not ready yet');
      return;
    }

    addLog(`Rolling: ${notation}`);
    try {
      const results: DiceRollResults = await diceBox.roll(notation);
      console.log(results);
      addLog(`Roll command sent: ${notation}`);
      addLog(`Results received: ${JSON.stringify(results, null, 2)}`);

      // Calculate and store the roll summary
      const summary = calculateRollSummary(results, notation);
      setRollHistory(prev => [...prev, summary]);
      addLog(
        `Total: ${summary.finalTotal} (dice: ${summary.total}, modifier: ${summary.modifier})`
      );

      // Auto-clear dice after a short delay to see the result (if enabled)
      if (autoClearDelay > 0) {
        autoClearDice(diceBox, autoClearDelay, () => {
          addLog(`Dice auto-cleared after ${autoClearDelay}ms`);
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addLog(`Error rolling dice: ${errorMessage}`);
    }
  };

  const clearDice = () => {
    if (!diceBox || !isInitialized) {
      addLog('DiceBox not ready yet');
      return;
    }

    addLog('Clearing dice from screen');
    try {
      if (diceBox.clear) {
        diceBox.clear();
        addLog('Dice cleared successfully');
      } else {
        addLog('Clear method not available on dice box');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addLog(`Error clearing dice: ${errorMessage}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const clearRollHistory = () => {
    setRollHistory([]);
    addLog('Roll history cleared');
  };

  return (
    <div className="dice-test-page relative min-h-screen bg-white p-8">
      {/* Dice Container */}
      <div
        id="dice-container"
        data-initialized={isInitialized}
        className="pointer-events-none fixed inset-0 z-10"
        style={{
          width: '100vw',
          height: '100vh',
          top: 0,
          left: 0,
        }}
      ></div>

      {/* UI Content */}
      <div className="relative z-20 mx-auto max-w-4xl">
        <h1 className="mb-8 text-center text-3xl font-bold text-gray-900">
          3D Dice Test Page
        </h1>

        {/* Status */}
        <div className="mb-6 rounded-lg border bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Status</h2>
          <div className="space-y-2">
            <div
              className={`flex items-center gap-2 ${isInitialized ? 'text-green-600' : 'text-yellow-600'}`}
            >
              <div
                className={`h-3 w-3 rounded-full ${isInitialized ? 'bg-green-500' : 'bg-yellow-500'}`}
              ></div>
              <span>{isInitialized ? 'Initialized' : 'Initializing...'}</span>
            </div>
            {initError && (
              <div className="rounded bg-red-50 p-2 text-sm text-red-600">
                Error: {initError}
              </div>
            )}
          </div>
        </div>

        {/* Dice Controls */}
        <div className="mb-6 rounded-lg border bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Dice Controls
          </h2>

          {/* Clear Button and Auto-clear Settings */}
          <div className="mb-4 space-y-3">
            <button
              onClick={clearDice}
              disabled={!isInitialized}
              className="w-full rounded-lg bg-red-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-600 disabled:bg-gray-300"
            >
              🧹 Clear All Dice from Screen
            </button>

            {/* Auto-clear delay setting */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Auto-clear delay:
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
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <button
              onClick={() => rollDice('1d20')}
              disabled={!isInitialized}
              className="rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600 disabled:bg-gray-300"
            >
              Roll 1d20
            </button>
            <button
              onClick={() => rollDice('2d6')}
              disabled={!isInitialized}
              className="rounded bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600 disabled:bg-gray-300"
            >
              Roll 2d6
            </button>
            <button
              onClick={() => rollDice('1d12')}
              disabled={!isInitialized}
              className="rounded bg-purple-500 px-4 py-2 text-white transition-colors hover:bg-purple-600 disabled:bg-gray-300"
            >
              Roll 1d12
            </button>
            <button
              onClick={() => rollDice('4d6')}
              disabled={!isInitialized}
              className="rounded bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-600 disabled:bg-gray-300"
            >
              Roll 4d6
            </button>
          </div>

          {/* Test buttons with modifiers */}
          <div className="mt-4">
            <h4 className="mb-2 font-semibold text-gray-900">
              Test Rolls with Modifiers
            </h4>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <button
                onClick={() => rollDice('1d20+5')}
                disabled={!isInitialized}
                className="rounded bg-indigo-500 px-3 py-2 text-sm text-white transition-colors hover:bg-indigo-600 disabled:bg-gray-300"
              >
                1d20+5
              </button>
              <button
                onClick={() => rollDice('3d6+2')}
                disabled={!isInitialized}
                className="rounded bg-teal-500 px-3 py-2 text-sm text-white transition-colors hover:bg-teal-600 disabled:bg-gray-300"
              >
                3d6+2
              </button>
              <button
                onClick={() => rollDice('2d8-1')}
                disabled={!isInitialized}
                className="rounded bg-orange-500 px-3 py-2 text-sm text-white transition-colors hover:bg-orange-600 disabled:bg-gray-300"
              >
                2d8-1
              </button>
              <button
                onClick={() => rollDice('1d4+10')}
                disabled={!isInitialized}
                className="rounded bg-pink-500 px-3 py-2 text-sm text-white transition-colors hover:bg-pink-600 disabled:bg-gray-300"
              >
                1d4+10
              </button>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="mb-2 font-semibold text-gray-900">Custom Roll</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g., 3d8+2"
                className="flex-1 rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    rollDice(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
              <button
                onClick={e => {
                  const input = e.currentTarget
                    .previousElementSibling as HTMLInputElement;
                  if (input.value) {
                    rollDice(input.value);
                    input.value = '';
                  }
                }}
                disabled={!isInitialized}
                className="rounded bg-orange-500 px-4 py-2 text-white transition-colors hover:bg-orange-600 disabled:bg-gray-300"
              >
                Roll
              </button>
            </div>
          </div>
        </div>

        {/* Dice Results Display */}
        <DiceResultDisplay
          rollHistory={rollHistory}
          onClearHistory={clearRollHistory}
          maxResults={10}
        />

        {/* Debug Info */}
        <div className="rounded-lg border bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Debug Logs</h2>
            <button
              onClick={clearLogs}
              className="rounded bg-gray-500 px-3 py-1 text-sm text-white transition-colors hover:bg-gray-600"
            >
              Clear Logs
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto rounded bg-gray-50 p-4">
            {logs.length === 0 ? (
              <p className="text-gray-500 italic">No logs yet...</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="font-mono text-sm text-gray-800">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-block rounded bg-gray-600 px-6 py-3 text-white transition-colors hover:bg-gray-700"
          >
            ← Back to Character Sheet
          </Link>
        </div>
      </div>
    </div>
  );
}
