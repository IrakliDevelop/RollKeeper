'use client';

import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { EquippedWeapons } from '@/components/EquippedWeapons';
import { QuickSpells } from '@/components/QuickSpells';
import { ConcentrationTracker } from '@/components/ui/character';
import { CharacterState } from '@/types/character';

interface ActionsSectionProps {
  character: CharacterState;
  showAttackRoll: (
    name: string,
    roll: number,
    modifier: number,
    isCrit: boolean
  ) => void;
  showSavingThrow: (
    spellName: string,
    saveDC: number,
    saveType?: string,
    damage?: string,
    damageType?: string
  ) => void;
  showDamageRoll: (
    weaponName: string,
    damageRoll: string,
    damageType?: string,
    versatile?: boolean
  ) => void;
  animateRoll?: (notation: string) => Promise<unknown>;
  switchToTab: (tabId: string) => void;
  onStopConcentration: () => void;
}

export default function ActionsSection({
  character,
  showAttackRoll,
  showSavingThrow,
  showDamageRoll,
  animateRoll,
  switchToTab,
  onStopConcentration,
}: ActionsSectionProps) {
  return (
    <section className="rounded-xl border-2 border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100 p-6 shadow-lg backdrop-blur-sm">
      <h2 className="mb-6 border-b-2 border-slate-400 pb-3 text-center text-2xl font-bold text-slate-800">
        ⚔️ Actions & Combat
      </h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Attack Actions */}
        <ErrorBoundary
          fallback={
            <div className="rounded-lg border border-blue-200 bg-white p-4 shadow">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-blue-800">
                <span className="text-red-600">⚔️</span>
                Ready Weapons
              </h3>
              <p className="text-gray-500">Unable to load equipped weapons</p>
            </div>
          }
        >
          <EquippedWeapons
            showAttackRoll={showAttackRoll}
            showDamageRoll={showDamageRoll}
            animateRoll={animateRoll}
          />
        </ErrorBoundary>

        {/* Cantrips & Spells */}
        <ErrorBoundary
          fallback={
            <div className="rounded-lg border border-blue-200 bg-white p-4 shadow">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-blue-800">
                <span className="text-purple-600">✨</span>
                Quick Spells
              </h3>
              <p className="text-gray-500">Unable to load quick spells</p>
            </div>
          }
        >
          <div className="rounded-lg border border-blue-200 bg-white p-4 shadow">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-blue-800">
              <span className="text-purple-600">✨</span>
              Quick Spells
            </h3>
            <QuickSpells
              showAttackRoll={showAttackRoll}
              showSavingThrow={showSavingThrow}
              showDamageRoll={showDamageRoll}
              animateRoll={animateRoll}
            />
            <div className="mt-4 border-t border-gray-200 pt-3">
              <p className="text-center text-xs text-gray-500">
                Manage spells in the{' '}
                <button
                  onClick={() => switchToTab('spellcasting')}
                  className="font-semibold text-purple-600 underline transition-colors hover:text-purple-800 hover:no-underline"
                >
                  Spellcasting tab
                </button>
                .
              </p>
            </div>
          </div>
        </ErrorBoundary>

        {/* Concentration Tracker */}
        {character.concentration.isConcentrating && (
          <ConcentrationTracker
            concentration={character.concentration}
            onStopConcentration={onStopConcentration}
          />
        )}
      </div>
    </section>
  );
}
