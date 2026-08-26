'use client';

import React from 'react';
import type { Encounter } from '@/types/encounter';
import { PreCombatControls } from './PreCombatControls';
import { RailActiveControls } from './RailActiveControls';
import { FocusActiveControls } from './FocusActiveControls';

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
  onRequestPlayerRolls: () => void;
  requestActive: boolean;
  waitingNames: string[];
  canRequestRolls: boolean;
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
  onRequestPlayerRolls,
  requestActive,
  waitingNames,
  canRequestRolls,
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
            hidePlayerHp={hidePlayerHp}
            onToggleHidePlayerHp={onToggleHidePlayerHp}
            onEndCombat={onEndCombat}
            onNextTurn={onNextTurn}
            onPrevTurn={onPrevTurn}
          />
        )
      ) : (
        <PreCombatControls
          encounter={encounter}
          onStartCombat={onStartCombat}
          onRollAllInitiatives={onRollAllInitiatives}
          onRequestPlayerRolls={onRequestPlayerRolls}
          requestActive={requestActive}
          waitingNames={waitingNames}
          canRequestRolls={canRequestRolls}
        />
      )}
    </div>
  );
}
