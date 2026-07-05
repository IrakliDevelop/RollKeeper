'use client';

import React from 'react';
import {
  SkipBack,
  SkipForward,
  Play,
  Square,
  Dices,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { Encounter } from '@/types/encounter';
import { getOnDeckEntity } from '@/utils/encounterTurn';
import { Button } from '@/components/ui/forms/button';

export interface CombatTurnBarProps {
  encounter: Encounter;
  layout: 'rail' | 'focus';
  hidePlayerHp: boolean;
  onToggleHidePlayerHp: () => void;
  onStartCombat: () => void;
  onEndCombat: () => void;
  onNextTurn: () => void;
  onPrevTurn: () => void;
  onRollAllInitiatives: () => void;
}

function PreCombatControls({
  encounter,
  onStartCombat,
  onRollAllInitiatives,
}: Pick<
  CombatTurnBarProps,
  'encounter' | 'onStartCombat' | 'onRollAllInitiatives'
>) {
  const isEmpty = encounter.entities.length === 0;
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
    </>
  );
}

function RailActiveControls({
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

function FocusActiveControls({
  encounter,
  onNextTurn,
  onPrevTurn,
}: Pick<CombatTurnBarProps, 'encounter' | 'onNextTurn' | 'onPrevTurn'>) {
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
    </>
  );
}

export function CombatTurnBar({
  encounter,
  layout,
  hidePlayerHp,
  onToggleHidePlayerHp,
  onStartCombat,
  onEndCombat,
  onNextTurn,
  onPrevTurn,
  onRollAllInitiatives,
}: CombatTurnBarProps): React.JSX.Element {
  return (
    <div className="bg-surface-secondary border-divider flex flex-wrap items-center gap-2 border-b px-4 py-3">
      {encounter.isActive ? (
        layout === 'rail' ? (
          <RailActiveControls
            encounter={encounter}
            hidePlayerHp={hidePlayerHp}
            onToggleHidePlayerHp={onToggleHidePlayerHp}
            onEndCombat={onEndCombat}
            onNextTurn={onNextTurn}
            onPrevTurn={onPrevTurn}
          />
        ) : (
          <FocusActiveControls
            encounter={encounter}
            onNextTurn={onNextTurn}
            onPrevTurn={onPrevTurn}
          />
        )
      ) : (
        <PreCombatControls
          encounter={encounter}
          onStartCombat={onStartCombat}
          onRollAllInitiatives={onRollAllInitiatives}
        />
      )}
    </div>
  );
}
