'use client';

import { RotateCcw } from "lucide-react";
import { formatModifier } from "@/utils/calculations";
import { CharacterState } from "@/types/character";

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
  onRollInitiative
}: CombatStatsProps) {
  return (
    <>
      {/* Initiative and Speed Row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Initiative */}
        <div className="text-center">
          <div className={`rounded-lg p-3 h-20 flex flex-col justify-center border-2 transition-colors ${
            character.initiative.isOverridden 
              ? 'bg-orange-50 border-orange-300' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="text-xs font-medium text-yellow-700 mb-1 flex items-center justify-center gap-1">
              INITIATIVE
              {character.initiative.isOverridden && (
                <button
                  onClick={onResetInitiativeToDefault}
                  className="text-orange-600 hover:text-orange-800 transition-colors"
                  title="Reset to DEX modifier"
                >
                  <RotateCcw size={10} />
                </button>
              )}
              <button
                onClick={onRollInitiative}
                className="text-yellow-600 hover:text-yellow-800 transition-colors ml-1"
                title={`Roll initiative (d20 + ${formatModifier(getInitiativeModifier())})`}
              >
                🎲
              </button>
            </div>
            <input
              type="number"
              value={getInitiativeModifier()}
              onChange={(e) => onUpdateInitiative(parseInt(e.target.value) || 0, true)}
              className={`text-xl font-bold bg-transparent border-none outline-none text-center w-full ${
                character.initiative.isOverridden ? 'text-orange-800' : 'text-yellow-800'
              }`}
              title={character.initiative.isOverridden ? 'Custom initiative (overridden)' : 'DEX modifier (auto-calculated)'}
            />
          </div>
        </div>
        
        {/* Speed */}
        <div className="text-center">
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 h-20 flex flex-col justify-center">
            <div className="text-xs font-medium text-green-700 mb-1">SPEED</div>
            <input
              type="number"
              value={character.speed}
              onChange={(e) => onUpdateSpeed(parseInt(e.target.value) || 30)}
              className="text-xl font-bold text-green-800 bg-transparent border-none outline-none text-center w-full"
            />
          </div>
        </div>
      </div>

      {/* Reaction Tracking */}
      <div className="mb-6">
        <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm font-bold text-purple-800">REACTION</div>
              <div className="text-xs text-purple-600">
                {character.reaction.hasUsedReaction ? 'Used this turn' : 'Available'}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleReaction}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${character.reaction.hasUsedReaction 
                    ? 'bg-red-600' 
                    : 'bg-green-600'
                  }
                `}
                title={character.reaction.hasUsedReaction ? 'Mark reaction as available' : 'Mark reaction as used'}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${character.reaction.hasUsedReaction ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
              
              <button
                onClick={onResetReaction}
                className="p-1 text-purple-600 hover:bg-purple-100 rounded transition-colors"
                title="Reset reaction to available"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
          
          <div className="mt-2 text-xs text-purple-700 bg-purple-100 rounded p-2">
            <strong>Reaction:</strong> One reaction per turn - used for opportunity attacks, spells like Shield, or other triggered abilities.
          </div>
        </div>
      </div>
    </>
  );
}
