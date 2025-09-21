'use client';

import { RotateCcw } from 'lucide-react';
import { formatModifier } from '@/utils/calculations';
import { CharacterState } from '@/types/character';

interface CombatStatsProps {
  character: CharacterState;
  getInitiativeModifier: () => number;
  onUpdateInitiative: (value: number, isOverridden: boolean) => void;
  onResetInitiativeToDefault: () => void;
  onUpdateSpeed: (speed: number) => void;
  onToggleReaction: () => void;
  onResetReaction: () => void;
  onRollInitiative: () => void;
}

export default function CombatStats({
  character,
  getInitiativeModifier,
  onUpdateInitiative,
  onResetInitiativeToDefault,
  onUpdateSpeed,
  onToggleReaction,
  onResetReaction,
  onRollInitiative,
}: CombatStatsProps) {
  return (
    <>
      {/* Initiative and Speed Row */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        {/* Initiative */}
        <div className="text-center">
          <div
            className={`flex h-20 flex-col justify-center rounded-lg border-2 p-3 transition-colors ${
              character.initiative.isOverridden
                ? 'border-orange-300 bg-orange-50'
                : 'border-yellow-200 bg-yellow-50'
            }`}
          >
            <div className="mb-1 flex items-center justify-center gap-1 text-xs font-medium text-yellow-700">
              INITIATIVE
              {character.initiative.isOverridden && (
                <button
                  onClick={onResetInitiativeToDefault}
                  className="text-orange-600 transition-colors hover:text-orange-800"
                  title="Reset to DEX modifier"
                >
                  <RotateCcw size={10} />
                </button>
              )}
              <button
                onClick={onRollInitiative}
                className="ml-1 text-yellow-600 transition-colors hover:text-yellow-800"
                title={`Roll initiative (d20 + ${formatModifier(getInitiativeModifier())})`}
              >
                🎲
              </button>
            </div>
            <input
              type="number"
              value={getInitiativeModifier()}
              onChange={e =>
                onUpdateInitiative(parseInt(e.target.value) || 0, true)
              }
              className={`w-full border-none bg-transparent text-center text-xl font-bold outline-none ${
                character.initiative.isOverridden
                  ? 'text-orange-800'
                  : 'text-yellow-800'
              }`}
              title={
                character.initiative.isOverridden
                  ? 'Custom initiative (overridden)'
                  : 'DEX modifier (auto-calculated)'
              }
            />
          </div>
        </div>

        {/* Speed */}
        <div className="text-center">
          <div className="flex h-20 flex-col justify-center rounded-lg border-2 border-green-200 bg-green-50 p-3">
            <div className="mb-1 text-xs font-medium text-green-700">SPEED</div>
            <input
              type="number"
              value={character.speed}
              onChange={e => onUpdateSpeed(parseInt(e.target.value) || 30)}
              className="w-full border-none bg-transparent text-center text-xl font-bold text-green-800 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Reaction Tracking */}
      <div className="mb-6">
        <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm font-bold text-purple-800">REACTION</div>
              <div className="text-xs text-purple-600">
                {character.reaction.hasUsedReaction
                  ? 'Used this turn'
                  : 'Available'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onToggleReaction}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  character.reaction.hasUsedReaction
                    ? 'bg-red-600'
                    : 'bg-green-600'
                } `}
                title={
                  character.reaction.hasUsedReaction
                    ? 'Mark reaction as available'
                    : 'Mark reaction as used'
                }
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${character.reaction.hasUsedReaction ? 'translate-x-6' : 'translate-x-1'} `}
                />
              </button>

              <button
                onClick={onResetReaction}
                className="rounded p-1 text-purple-600 transition-colors hover:bg-purple-100"
                title="Reset reaction to available"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          <div className="mt-2 rounded bg-purple-100 p-2 text-xs text-purple-700">
            <strong>Reaction:</strong> One reaction per turn - used for
            opportunity attacks, spells like Shield, or other triggered
            abilities.
          </div>
        </div>
      </div>
    </>
  );
}
