'use client';

import React from 'react';
import Link from 'next/link';
import { DiceRoller } from '@/components/ui/game/DiceRoller';
import { DiceButton } from '@/components/ui/game/DiceButton';
import NotHydrated from '@/components/ui/feedback/NotHydrated';
import { RollSummary } from '@/types/dice';
import { useHydration } from '@/hooks/useHydration';

export default function DiceComponentsDemo() {
  const hasHydrated = useHydration();

  if (!hasHydrated) {
    return <NotHydrated />;
  }

  const handleRollResult = (summary: RollSummary) => {
    console.log('Roll completed:', summary);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 relative">
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🎲 Modular Dice Components Demo
          </h1>
          <p className="text-gray-600 mb-6">
            Showcase of reusable dice rolling components that can be plugged into any part of the app
          </p>
          <Link 
            href="/"
            className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            ← Back to Character Sheet
          </Link>
        </div>

        {/* Full DiceRoller Component */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            📦 Full DiceRoller Component
          </h2>
          <p className="text-gray-600 mb-4">
            Complete dice rolling interface with controls, history, and customization
          </p>
          <DiceRoller
            containerId="demo-dice-container"
            onRollResult={handleRollResult}
            quickButtons={[
              { label: 'Attack Roll', notation: '1d20+5', color: 'bg-red-500 hover:bg-red-600' },
              { label: 'Damage', notation: '1d8+3', color: 'bg-orange-500 hover:bg-orange-600' },
              { label: 'Healing', notation: '2d4+2', color: 'bg-green-500 hover:bg-green-600' },
              { label: 'Fireball', notation: '8d6', color: 'bg-purple-500 hover:bg-purple-600' },
            ]}
          />
        </section>

        {/* Individual DiceButton Examples */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            🎲 Individual DiceButton Components
          </h2>
          <p className="text-gray-600 mb-4">
            Lightweight buttons that can be embedded anywhere
          </p>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Attack Rolls</h3>
              <div className="flex flex-wrap gap-2">
                <DiceButton notation="1d20+5" variant="danger" onRollComplete={handleRollResult}>
                  Sword Attack (+5)
                </DiceButton>
                <DiceButton notation="1d20+3" variant="primary" onRollComplete={handleRollResult}>
                  Bow Attack (+3)
                </DiceButton>
                <DiceButton notation="1d20+7" variant="warning" onRollComplete={handleRollResult}>
                  Spell Attack (+7)
                </DiceButton>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Damage Rolls</h3>
              <div className="flex flex-wrap gap-2">
                <DiceButton notation="1d8+3" variant="danger" onRollComplete={handleRollResult}>
                  Longsword (1d8+3)
                </DiceButton>
                <DiceButton notation="1d6+1" variant="secondary" onRollComplete={handleRollResult}>
                  Dagger (1d6+1)
                </DiceButton>
                <DiceButton notation="2d6+4" variant="warning" onRollComplete={handleRollResult}>
                  Greatsword (2d6+4)
                </DiceButton>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Spells</h3>
              <div className="flex flex-wrap gap-2">
                <DiceButton notation="3d6" variant="primary" onRollComplete={handleRollResult}>
                  Magic Missile (3d6)
                </DiceButton>
                <DiceButton notation="8d6" variant="danger" onRollComplete={handleRollResult}>
                  Fireball (8d6)
                </DiceButton>
                <DiceButton notation="4d8+4" variant="success" onRollComplete={handleRollResult}>
                  Cure Wounds (4d8+4)
                </DiceButton>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Skill Checks</h3>
              <div className="flex flex-wrap gap-2">
                <DiceButton notation="1d20+4" variant="primary" onRollComplete={handleRollResult}>
                  Stealth (+4)
                </DiceButton>
                <DiceButton notation="1d20+2" variant="secondary" onRollComplete={handleRollResult}>
                  Investigation (+2)
                </DiceButton>
                <DiceButton notation="1d20+6" variant="success" onRollComplete={handleRollResult}>
                  Persuasion (+6)
                </DiceButton>
              </div>
            </div>
          </div>
        </section>

        {/* Minimal DiceRoller */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            ⚡ Minimal DiceRoller
          </h2>
          <p className="text-gray-600 mb-4">
            Stripped down version with only essential features
          </p>
          <DiceRoller
            containerId="minimal-dice-container"
            showHistory={false}
            showAutoClearControl={false}
            maxHistoryResults={5}
            quickButtons={[
              { label: '1d20', notation: '1d20' },
              { label: '1d12', notation: '1d12' },
              { label: '1d8', notation: '1d8' },
              { label: '1d6', notation: '1d6' },
            ]}
          />
        </section>

        {/* Usage Examples */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            📝 Usage Examples
          </h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">DiceButton Usage</h3>
              <pre className="bg-gray-100 text-black p-4 rounded text-sm overflow-x-auto">
{`<DiceButton 
  notation="1d20+5" 
  variant="danger"
  onRollComplete={(summary) => console.log(summary)}
>
  Attack Roll (+5)
</DiceButton>`}
              </pre>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">DiceRoller Usage</h3>
              <pre className="bg-gray-100 text-black p-4 rounded text-sm overflow-x-auto">
{`<DiceRoller
  containerId="my-dice-container"
  autoClearDelay={3000}
  onRollResult={(summary) => console.log(summary)}
  quickButtons={[
    { label: 'Attack', notation: '1d20+5', color: 'bg-red-500' },
    { label: 'Damage', notation: '1d8+3', color: 'bg-orange-500' }
  ]}
/>`}
              </pre>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">useSimpleDiceRoll Hook</h3>
              <pre className="bg-gray-100 text-black p-4 rounded text-sm overflow-x-auto">
{`const { isReady, roll, clearDice } = useSimpleDiceRoll({
  containerId: 'my-container',
  onRollComplete: (summary) => console.log(summary)
});

// Use in your component
<button onClick={() => roll('1d20+5')}>
  Roll Attack
</button>`}
              </pre>
            </div>
          </div>
        </section>

        {/* Integration Notes */}
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-blue-800 mb-4">
            🔧 Integration Notes
          </h2>
          <ul className="space-y-2 text-blue-700">
            <li>• Each component needs a unique <code>containerId</code></li>
            <li>• Components automatically handle dice initialization and cleanup</li>
            <li>• Use <code>DiceButton</code> for simple integration into existing UI</li>
            <li>• Use <code>DiceRoller</code> for complete dice rolling interfaces</li>
            <li>• Use <code>useSimpleDiceRoll</code> hook for custom implementations</li>
            <li>• All components support auto-clearing and result callbacks</li>
          </ul>
        </section>
      </div>
    </div>
  );
}