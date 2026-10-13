'use client';

import Link from 'next/link';
import { DiceRoller } from '@/components/ui/game/DiceRoller';

export default function DiceTestPage() {
  return (
    <div className="bg-surface min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/" className="text-muted text-sm hover:underline">
            Back
          </Link>
          <h1 className="text-heading mt-2 text-3xl font-bold">
            Dice prototype
          </h1>
          <p className="text-body mt-2">
            Pollyroll tray with the same dice-set controls a character sheet
            uses. Rolls play on the full-screen overlay.
          </p>
        </div>
        <DiceRoller containerId="dice-test-tray" showDiceSet />
      </div>
    </div>
  );
}
