'use client';

import React from 'react';
import { Play, Dices, Swords } from 'lucide-react';
import type { CombatTurnBarProps } from './index';
import { Button } from '@/components/ui/forms/button';

export function PreCombatControls({
  encounter,
  onStartCombat,
  onRollAllInitiatives,
  onRequestPlayerRolls,
  requestActive,
  waitingNames,
  canRequestRolls,
}: Pick<
  CombatTurnBarProps,
  | 'encounter'
  | 'onStartCombat'
  | 'onRollAllInitiatives'
  | 'onRequestPlayerRolls'
  | 'requestActive'
  | 'waitingNames'
  | 'canRequestRolls'
>) {
  const isEmpty = encounter.entities.length === 0;
  const hasPlayers = encounter.entities.some(e => e.type === 'player');
  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={onStartCombat}
        disabled={isEmpty}
        leftIcon={<Play size={16} />}
      >
        Start Combat
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onRollAllInitiatives}
        disabled={isEmpty}
        leftIcon={<Dices size={16} />}
      >
        Roll Initiatives (NPCs/Monsters)
      </Button>
      {canRequestRolls && (
        <Button
          variant={requestActive ? 'outline' : 'secondary'}
          size="sm"
          onClick={onRequestPlayerRolls}
          disabled={isEmpty || !hasPlayers}
          leftIcon={<Swords size={16} />}
          title={
            requestActive
              ? 'Re-request (players who already answered are asked again)'
              : 'Ask players to roll initiative'
          }
        >
          {requestActive ? 'Re-request player rolls' : 'Request player rolls'}
        </Button>
      )}
      {canRequestRolls && requestActive && waitingNames.length > 0 && (
        <span className="text-muted text-xs">
          Waiting for: {waitingNames.join(', ')}
        </span>
      )}
    </>
  );
}
