'use client';

import React from 'react';
import { SkipBack, SkipForward, Square, Eye, EyeOff } from 'lucide-react';
import type { CombatTurnBarProps } from './index';
import { getOnDeckEntity } from '@/utils/encounterTurn';
import { Button } from '@/components/ui/forms/button';

export function RailActiveControls({
  encounter,
  hidePlayerHp,
  onToggleHidePlayerHp,
  onEndCombat,
  onNextTurn,
  onPrevTurn,
}: Pick<
  CombatTurnBarProps,
  | 'encounter'
  | 'hidePlayerHp'
  | 'onToggleHidePlayerHp'
  | 'onEndCombat'
  | 'onNextTurn'
  | 'onPrevTurn'
>) {
  const activeEntity = encounter.entities[encounter.currentTurn];
  const onDeckEntity = getOnDeckEntity(encounter);

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevTurn}
          leftIcon={<SkipBack size={16} />}
        >
          Prev
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onNextTurn}
          leftIcon={<SkipForward size={16} />}
        >
          Next Turn
        </Button>
      </div>

      <div className="ml-3 flex flex-col">
        <span className="text-muted text-xs font-bold tracking-widest uppercase">
          Round {encounter.round}
        </span>
        {activeEntity && (
          <div className="font-display text-heading text-sm font-bold">
            <span>{activeEntity.name}</span>
            <span className="text-accent-amber-text-muted font-normal">
              &apos;s turn
            </span>
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {onDeckEntity && (
          <div className="mr-2 flex flex-col items-end">
            <span className="text-muted text-xs font-bold tracking-widest uppercase">
              Up Next
            </span>
            <span className="text-body text-sm font-medium">
              {onDeckEntity.name}
            </span>
          </div>
        )}
        <Button
          variant={hidePlayerHp ? 'warning' : 'ghost'}
          size="sm"
          onClick={onToggleHidePlayerHp}
          leftIcon={hidePlayerHp ? <EyeOff size={14} /> : <Eye size={14} />}
        >
          Player HP
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEndCombat}
          className="bg-accent-red-bg text-accent-red-text hover:bg-accent-red-bg-strong"
          leftIcon={<Square size={14} />}
        >
          End Combat
        </Button>
      </div>
    </>
  );
}
