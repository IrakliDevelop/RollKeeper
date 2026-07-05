'use client';

import React, { useState, useEffect } from 'react';
import type { Encounter } from '@/types/encounter';
import type { EntityActions } from './types';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { getOnDeckEntity } from '@/utils/encounterTurn';
import { CombatAppBar } from './CombatAppBar';
import { CombatTurnBar } from './CombatTurnBar';
import { CombatantRow } from './CombatantRow';
import { CombatantDetail } from './detail/CombatantDetail';
import { FocusLayout } from './FocusLayout';

export interface CombatScreenProps {
  encounter: Encounter;
  playerSyncMap?: Record<string, string>;
  customCounterLabel?: string;
  playerCounterValues?: Record<string, number>;
  actions: EntityActions;
  onStartCombat: () => void;
  onEndCombat: () => void;
  onNextTurn: () => void;
  onPrevTurn: () => void;
  onRollAllInitiatives: () => void;
  onRename: (name: string) => void;
  onOpenAdd: () => void;
  onOpenConfig: () => void;
  backHref: string;
}

export function CombatScreen({
  encounter,
  playerSyncMap,
  customCounterLabel,
  playerCounterValues,
  actions,
  onStartCombat,
  onEndCombat,
  onNextTurn,
  onPrevTurn,
  onRollAllInitiatives,
  onRename,
  onOpenAdd,
  onOpenConfig,
  backHref,
}: CombatScreenProps): React.JSX.Element {
  const isRail = useMediaQuery('(min-width: 1024px)');
  const [railSelectionId, setRailSelectionId] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [hidePlayerHp, setHidePlayerHp] = useState(false);

  const { entities, currentTurn, isActive } = encounter;
  const onDeckEntity = getOnDeckEntity(encounter);
  const activeEntityId = entities[currentTurn]?.id;

  // Auto-select active entity when turn changes (not on unrelated entity mutations)
  useEffect(() => {
    if (isActive && activeEntityId) setRailSelectionId(activeEntityId);
  }, [isActive, currentTurn, activeEntityId]);

  const detailEntity =
    entities.find(e => e.id === railSelectionId) ??
    entities[currentTurn] ??
    entities[0];

  const detailPcId = detailEntity?.playerCharacterId;
  const detailOpenSheet =
    detailPcId !== undefined
      ? () => actions.onViewPlayer?.(detailPcId)
      : undefined;

  const appBar = (
    <CombatAppBar
      name={encounter.name}
      backHref={backHref}
      onRename={onRename}
      onOpenAdd={onOpenAdd}
      onOpenConfig={onOpenConfig}
    />
  );

  const turnBar = (
    <CombatTurnBar
      encounter={encounter}
      layout={isRail ? 'rail' : 'focus'}
      hidePlayerHp={hidePlayerHp}
      onToggleHidePlayerHp={() => setHidePlayerHp(h => !h)}
      onStartCombat={onStartCombat}
      onEndCombat={onEndCombat}
      onNextTurn={onNextTurn}
      onPrevTurn={onPrevTurn}
      onRollAllInitiatives={onRollAllInitiatives}
    />
  );

  if (isRail) {
    return (
      <div className="flex h-full flex-col">
        {appBar}
        {turnBar}
        <div className="flex min-h-0 flex-1">
          <div className="border-divider w-[420px] shrink-0 overflow-y-auto border-r">
            {entities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-muted mb-2">No combatants yet</p>
                <p className="text-faint text-sm">
                  Use &quot;+ Add&quot; to add combatants
                </p>
              </div>
            ) : (
              <div className="space-y-2 p-3">
                {entities.map((entity, index) => {
                  const pcId = entity.playerCharacterId;
                  const syncId = pcId ?? entity.summonOwnerId;
                  const counterValue =
                    pcId !== undefined
                      ? playerCounterValues?.[pcId]
                      : undefined;
                  return (
                    <CombatantRow
                      key={entity.id}
                      entity={entity}
                      density="rail"
                      isActive={isActive && index === currentTurn}
                      isSelected={entity.id === railSelectionId}
                      isOnDeck={onDeckEntity?.id === entity.id}
                      hidePlayerHp={hidePlayerHp}
                      lastSynced={
                        syncId !== undefined
                          ? playerSyncMap?.[syncId]
                          : undefined
                      }
                      counterLabel={customCounterLabel}
                      counterValue={counterValue}
                      actions={actions}
                      onSelect={() => setRailSelectionId(entity.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 overflow-y-auto">
            {detailEntity && (
              <CombatantDetail
                entity={detailEntity}
                actions={actions}
                onOpenSheet={detailOpenSheet}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {appBar}
      {turnBar}
      <FocusLayout
        encounter={encounter}
        playerSyncMap={playerSyncMap}
        customCounterLabel={customCounterLabel}
        playerCounterValues={playerCounterValues}
        hidePlayerHp={hidePlayerHp}
        actions={actions}
        drawerId={drawerId}
        onOpenDrawer={setDrawerId}
        onCloseDrawer={() => setDrawerId(null)}
      />
    </div>
  );
}
