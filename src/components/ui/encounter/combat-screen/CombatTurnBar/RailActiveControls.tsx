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
          Previous turn
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onNextTurn}
          leftIcon={<SkipForward size={16} />}
        >
          Next turn
        </Button>
      </div>

      <div className="flex flex-col">
        <span className="text-muted type-caption">Round {encounter.round}</span>
        {activeEntity && (
          <div className="type-ui text-heading">
            <span>{activeEntity.name}</span>
            <span className="text-muted font-normal">&apos;s turn</span>
          </div>
        )}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {onDeckEntity && (
          <div className="flex flex-col items-end">
            <span className="text-muted type-caption">Up next</span>
            <span className="text-body text-sm font-medium">
              {onDeckEntity.name}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          selected={hidePlayerHp}
          aria-pressed={hidePlayerHp}
          size="sm"
          onClick={onToggleHidePlayerHp}
          leftIcon={hidePlayerHp ? <EyeOff size={14} /> : <Eye size={14} />}
        >
          {hidePlayerHp ? 'Show player HP' : 'Hide player HP'}
        </Button>
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
