'use client';

import React from 'react';
import { SkipBack, SkipForward, Square, Eye, EyeOff } from 'lucide-react';
import type { CombatTurnBarProps } from './index';
import { getOnDeckEntity } from '@/utils/encounterTurn';
import { Button } from '@/components/ui/forms/button';

export function FocusActiveControls({
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
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevTurn}
        className="h-9 w-9 shrink-0 p-0"
        title="Previous turn"
      >
        <SkipBack size={16} />
      </Button>

      <div className="mx-3 min-w-0 flex-1">
        <span className="text-accent-amber-text-muted block text-xs font-bold tracking-widest uppercase">
          Round {encounter.round} · Now Playing
        </span>
        {activeEntity && (
          <span className="font-display text-heading block truncate text-base font-bold">
            {activeEntity.name}
          </span>
        )}
      </div>

      {onDeckEntity && (
        <div className="mr-3 flex shrink-0 flex-col items-end">
          <span className="text-muted text-xs font-bold tracking-widest uppercase">
            Up Next
          </span>
          <span className="text-body text-sm font-medium">
            {onDeckEntity.name}
          </span>
        </div>
      )}

      <Button
        variant="primary"
        size="sm"
        onClick={onNextTurn}
        rightIcon={<SkipForward size={16} />}
      >
        Next
      </Button>

      <div className="flex w-full items-center justify-end gap-2 pt-1">
        <Button
          variant={hidePlayerHp ? 'warning' : 'ghost'}
          size="sm"
          onClick={onToggleHidePlayerHp}
          aria-label={hidePlayerHp ? 'Show player HP' : 'Hide player HP'}
          leftIcon={hidePlayerHp ? <EyeOff size={14} /> : <Eye size={14} />}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onEndCombat}
          aria-label="End combat"
          className="bg-accent-red-bg text-accent-red-text hover:bg-accent-red-bg-strong"
          leftIcon={<Square size={14} />}
        >
          End
        </Button>
      </div>
    </>
  );
}
