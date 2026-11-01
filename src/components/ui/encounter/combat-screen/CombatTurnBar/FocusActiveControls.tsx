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
        className="shrink-0"
        aria-label="Previous turn"
      >
        <SkipBack size={16} />
      </Button>

      <div className="min-w-0 flex-1">
        <span className="text-muted type-caption block">
          Round {encounter.round} · Now playing
        </span>
        {activeEntity && (
          <span className="type-subheading text-heading block truncate">
            {activeEntity.name}
          </span>
        )}
      </div>

      {onDeckEntity && (
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-muted type-caption">Up next</span>
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
        Next turn
      </Button>

      <div className="flex w-full flex-wrap items-center justify-end gap-2 pt-1">
        <Button
          variant="ghost"
          selected={hidePlayerHp}
          size="sm"
          onClick={onToggleHidePlayerHp}
          aria-label={hidePlayerHp ? 'Show player HP' : 'Hide player HP'}
          leftIcon={hidePlayerHp ? <EyeOff size={14} /> : <Eye size={14} />}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={onEndCombat}
          leftIcon={<Square size={14} />}
        >
          End combat
        </Button>
      </div>
    </>
  );
}
