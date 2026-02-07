'use client';

import { RotateCcw } from 'lucide-react';
import { formatModifier } from '@/utils/calculations';
import { Button, Input, Switch } from '@/components/ui/forms';
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
                ? 'border-accent-orange-border bg-accent-orange-bg'
                : 'border-accent-amber-border bg-accent-amber-bg'
            }`}
          >
            <div className="text-accent-amber-text-muted mb-1 flex items-center justify-center gap-1 text-xs font-medium">
              INITIATIVE
              {character.initiative.isOverridden && (
                <Button
                  onClick={onResetInitiativeToDefault}
                  variant="ghost"
                  size="xs"
                  className="h-4 w-4 p-0 text-orange-600 hover:text-orange-800"
                  title="Reset to DEX modifier"
                >
                  <RotateCcw size={10} />
                </Button>
              )}
              <Button
                onClick={onRollInitiative}
                variant="ghost"
                size="xs"
                className="text-accent-amber-text-muted hover:text-accent-amber-text ml-1 h-4 w-4 p-0"
                title={`Roll initiative (d20 + ${formatModifier(getInitiativeModifier())})`}
              >
                🎲
              </Button>
            </div>
            <Input
              type="number"
              value={getInitiativeModifier().toString()}
              onChange={e =>
                onUpdateInitiative(parseInt(e.target.value) || 0, true)
              }
              className={`[appearance:textfield] border-none bg-transparent text-center text-xl font-bold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                character.initiative.isOverridden
                  ? 'text-accent-orange-text'
                  : 'text-accent-amber-text'
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
          <div className="border-accent-green-border bg-accent-green-bg flex h-20 flex-col justify-center rounded-lg border-2 p-3">
            <div className="text-accent-green-text mb-1 text-xs font-medium">
              SPEED
            </div>
            <Input
              type="number"
              value={character.speed.toString()}
              onChange={e => onUpdateSpeed(parseInt(e.target.value) || 30)}
              className="text-accent-green-text [appearance:textfield] border-none bg-transparent text-center text-xl font-bold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>
      </div>

      {/* Reaction Tracking */}
      <div className="mb-6">
        <div className="border-accent-purple-border bg-accent-purple-bg rounded-lg border-2 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-accent-purple-text text-sm font-bold">
                REACTION
              </div>
              <div className="text-accent-purple-text-muted text-xs">
                {character.reaction.hasUsedReaction
                  ? 'Used this turn'
                  : 'Available'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={!character.reaction.hasUsedReaction}
                onCheckedChange={() => onToggleReaction()}
                size="sm"
                variant="success"
                title={
                  character.reaction.hasUsedReaction
                    ? 'Mark reaction as available'
                    : 'Mark reaction as used'
                }
              />

              <Button
                onClick={onResetReaction}
                variant="ghost"
                size="xs"
                className="text-accent-purple-text-muted hover:bg-accent-purple-bg-strong p-1"
                title="Reset reaction to available"
              >
                <RotateCcw size={14} />
              </Button>
            </div>
          </div>

          <div className="bg-accent-purple-bg-strong text-accent-purple-text-muted mt-2 rounded p-2 text-xs">
            <strong>Reaction:</strong> One reaction per turn - used for
            opportunity attacks, spells like Shield, or other triggered
            abilities.
          </div>
        </div>
      </div>
    </>
  );
}
