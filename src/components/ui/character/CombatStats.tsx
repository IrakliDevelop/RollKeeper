'use client';

import type { ReactNode } from 'react';
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

function StatCell({
  caption,
  children,
  note,
}: {
  caption: string;
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="min-w-16 space-y-1">
      <div className="type-num-lg text-heading flex min-h-10 items-center tabular-nums pointer-coarse:min-h-11">
        {children}
      </div>
      <p className="type-caption text-muted">{caption}</p>
      {note}
    </div>
  );
}

const EXTRA_SPEEDS = [
  { key: 'flySpeed', label: 'Fly' },
  { key: 'climbSpeed', label: 'Climb' },
  { key: 'swimSpeed', label: 'Swim' },
] as const;

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
  const initiative = getInitiativeModifier();
  const rollLabel = `Roll initiative (d20 ${initiative < 0 ? '−' : '+'} ${Math.abs(initiative)})`;
  const speedBonus = getBuffSpeedBonus(character);
  const extraSpeeds = EXTRA_SPEEDS.filter(
    ({ key }) => editing || (character[key] ?? 0) > 0
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <StatCell
          caption="Initiative"
          note={
            character.initiative.isOverridden && (
              <p className="type-small text-muted">Custom</p>
            )
          }
        >
          <span className="flex items-center gap-3">
            <span>
              {initiative >= 0 && <span>+</span>}
              <InPlaceField
                label="Initiative"
                value={initiative}
                editing={editing}
                onCommit={v => onUpdateInitiative(v, true)}
              />
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label={rollLabel}
              onClick={() => onRollInitiative()}
            >
              <AppIcon name="dice" className="size-4" />
            </Button>
          </span>
        </StatCell>
        <StatCell
          caption="Speed"
          note={
            speedBonus !== 0 && (
              <p className="type-small text-muted">
                {character.speed + speedBonus} ft with buffs
              </p>
            )
          }
        >
          <InPlaceField
            label="Speed"
            value={character.speed}
            editing={editing}
            min={0}
            onCommit={onUpdateSpeed}
          />
          <span className="type-small text-muted ml-1">ft</span>
        </StatCell>
        {extraSpeeds.map(({ key, label }) => (
          <StatCell key={key} caption={label}>
            <InPlaceField
              label={label}
              value={character[key] || 0}
              editing={editing}
              min={0}
              onCommit={v => onUpdateCharacter({ [key]: v })}
            />
            <span className="type-small text-muted ml-1">ft</span>
          </StatCell>
        ))}
      </div>
      {editing && character.initiative.isOverridden && (
        <Button size="sm" onClick={() => onResetInitiativeToDefault()}>
          Reset to Dexterity modifier
        </Button>
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
  );
}
