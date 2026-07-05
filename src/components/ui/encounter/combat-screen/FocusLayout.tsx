'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { Encounter } from '@/types/encounter';
import type { EntityActions } from './types';
import { getOnDeckEntity } from '@/utils/encounterTurn';
import { CombatantRow } from './CombatantRow';
import { CombatantDetail } from './detail/CombatantDetail';

export interface FocusLayoutProps {
  encounter: Encounter;
  playerSyncMap?: Record<string, string>;
  customCounterLabel?: string;
  playerCounterValues?: Record<string, number>;
  hidePlayerHp: boolean;
  actions: EntityActions;
  drawerId: string | null;
  onOpenDrawer: (id: string) => void;
  onCloseDrawer: () => void;
}

export function FocusLayout({
  encounter,
  playerSyncMap,
  customCounterLabel,
  playerCounterValues,
  hidePlayerHp,
  actions,
  drawerId,
  onOpenDrawer,
  onCloseDrawer,
}: FocusLayoutProps): React.JSX.Element {
  const { entities, currentTurn, isActive } = encounter;
  const onDeckEntity = getOnDeckEntity(encounter);
  const drawerEntity = entities.find(e => e.id === drawerId);
  const drawerPcId = drawerEntity?.playerCharacterId;

  return (
    <div className="relative flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[760px] space-y-2 p-4">
        {entities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted mb-2">No combatants yet</p>
            <p className="text-faint text-sm">
              Use &quot;+ Add&quot; to add combatants
            </p>
          </div>
        ) : (
          entities.map((entity, index) => {
            const isEntityActive = isActive && index === currentTurn;
            const pcId = entity.playerCharacterId;
            const counterValue =
              pcId !== undefined ? playerCounterValues?.[pcId] : undefined;

            if (isEntityActive) {
              return (
                <div key={entity.id}>
                  <CombatantRow
                    entity={entity}
                    density="focus"
                    isActive
                    isSelected={false}
                    isOnDeck={false}
                    hidePlayerHp={hidePlayerHp}
                    lastSynced={
                      pcId !== undefined ? playerSyncMap?.[pcId] : undefined
                    }
                    counterLabel={customCounterLabel}
                    counterValue={counterValue}
                    actions={actions}
                    onSelect={() => {}}
                  />
                  <div className="bg-surface-raised border-divider rounded-b-lg border border-t-0">
                    <CombatantDetail
                      entity={entity}
                      actions={actions}
                      onOpenSheet={
                        pcId !== undefined
                          ? () => actions.onViewPlayer?.(pcId)
                          : undefined
                      }
                    />
                  </div>
                </div>
              );
            }

            return (
              <CombatantRow
                key={entity.id}
                entity={entity}
                density="focus"
                isActive={false}
                isSelected={false}
                isOnDeck={onDeckEntity?.id === entity.id}
                hidePlayerHp={hidePlayerHp}
                lastSynced={
                  pcId !== undefined ? playerSyncMap?.[pcId] : undefined
                }
                counterLabel={customCounterLabel}
                counterValue={counterValue}
                actions={actions}
                onSelect={() => onOpenDrawer(entity.id)}
              />
            );
          })
        )}
      </div>

      {drawerEntity && (
        <>
          <div
            className="bg-surface-overlay fixed inset-0 z-40"
            onClick={onCloseDrawer}
          />
          <div className="bg-surface-raised fixed top-0 right-0 z-50 h-full w-[min(440px,92vw)] overflow-y-auto shadow-xl">
            <div className="border-divider flex items-center justify-between border-b p-4">
              <span className="text-heading font-semibold">
                {drawerEntity.name}
              </span>
              <button
                onClick={onCloseDrawer}
                className="text-muted hover:text-heading rounded p-1 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <CombatantDetail
              entity={drawerEntity}
              actions={actions}
              onOpenSheet={
                drawerPcId !== undefined
                  ? () => actions.onViewPlayer?.(drawerPcId)
                  : undefined
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
