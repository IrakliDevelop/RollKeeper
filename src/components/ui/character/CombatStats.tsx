'use client';

import { useState } from 'react';
import { getBuffSpeedBonus } from '@/utils/calculations';
import { Button, Switch } from '@/components/ui/forms';
import { InPlaceField } from '@/components/ui/forms/InPlaceField';
import { CharacterState } from '@/types/character';
import { AppIcon } from '@/components/ui/icons';

interface CombatStatsProps {
  character: CharacterState;
  /**
   * Sheet mode: false shows the build values as plain text. Defaults to true
   * (editable) for callers outside the character sheet.
   */
  editing?: boolean;
  getInitiativeModifier: () => number;
  onUpdateInitiative: (value: number, isOverridden: boolean) => void;
  onResetInitiativeToDefault: () => void;
  onUpdateSpeed: (speed: number) => void;
  onUpdateCharacter: (updates: Partial<CharacterState>) => void;
  onToggleReaction: () => void;
  onResetReaction: () => void;
  onRollInitiative: () => void;
}

export default function CombatStats({
  character,
  editing = true,
  getInitiativeModifier,
  onUpdateInitiative,
  onResetInitiativeToDefault,
  onUpdateSpeed,
  onUpdateCharacter,
  onToggleReaction,
  onRollInitiative,
}: CombatStatsProps) {
  const [showExtraSpeeds, setShowExtraSpeeds] = useState(
    !!(character.flySpeed || character.climbSpeed || character.swimSpeed)
  );
  const initiative = getInitiativeModifier();
  const rollLabel = `Roll initiative (d20 ${initiative < 0 ? '−' : '+'} ${Math.abs(initiative)})`;
  const speedBonus = getBuffSpeedBonus(character);
  return (
    <div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="type-num-lg text-heading flex items-center gap-3">
              <InPlaceField
                label="Initiative"
                value={initiative}
                editing={editing}
                onCommit={v => onUpdateInitiative(v, true)}
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={rollLabel}
                onClick={onRollInitiative}
              >
                <AppIcon name="dice" className="size-4" />
              </Button>
            </div>
            <p className="type-caption text-muted">Initiative</p>
            {character.initiative.isOverridden && (
              <p className="type-small text-muted">Custom</p>
            )}
            {editing && character.initiative.isOverridden && (
              <Button size="sm" onClick={onResetInitiativeToDefault}>
                Reset to Dexterity modifier
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <div className="type-num-lg text-heading">
              <InPlaceField
                label="Speed"
                value={character.speed}
                editing={editing}
                min={0}
                onCommit={onUpdateSpeed}
              />
            </div>
            <p className="type-caption text-muted">Speed</p>
            {speedBonus !== 0 && (
              <p className="type-small text-muted">
                {character.speed + speedBonus} ft with buffs
              </p>
            )}
            <Button
              size="sm"
              onClick={() => setShowExtraSpeeds(!showExtraSpeeds)}
              aria-expanded={showExtraSpeeds}
              aria-label={
                showExtraSpeeds
                  ? 'Hide extra speeds'
                  : 'Add fly/climb/swim speeds'
              }
            >
              {showExtraSpeeds
                ? 'Hide extra speeds'
                : 'Add fly/climb/swim speeds'}
            </Button>
          </div>
        </div>
        {showExtraSpeeds && (
          <div className="grid grid-cols-3 gap-3">
            {(['fly', 'climb', 'swim'] as const).map(kind => {
              const key = `${kind}Speed` as const;
              const label =
                kind === 'fly' ? 'Fly' : kind === 'climb' ? 'Climb' : 'Swim';
              return (
                <div key={kind} className="space-y-2">
                  <div className="type-num-lg text-heading">
                    <InPlaceField
                      label={label}
                      value={character[key] || 0}
                      editing={editing}
                      min={0}
                      onCommit={v => onUpdateCharacter({ [key]: v })}
                    />
                  </div>
                  <p className="type-caption text-muted">{label}</p>
                </div>
              );
            })}
          </div>
        )}
        <Switch
          label="Reaction used"
          description={
            character.reaction.hasUsedReaction ? 'Used this turn' : 'Available'
          }
          checked={character.reaction.hasUsedReaction}
          onCheckedChange={() => onToggleReaction()}
        />
      </div>
    </div>
  );
}
