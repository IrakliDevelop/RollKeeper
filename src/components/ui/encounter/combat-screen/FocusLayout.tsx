'use client';

import React, { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/feedback/dialog';
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
  const focusAfterRemove = useRef<string | null>(null);
  const detailActions: EntityActions = {
    ...actions,
    onRemove: id => {
      const index = entities.findIndex(entity => entity.id === id);
      const targetId = (entities[index + 1] ?? entities[index - 1])?.id ?? '';
      focusAfterRemove.current = targetId;
      actions.onRemove(id);
      onCloseDrawer();
      setTimeout(() => {
        if (focusAfterRemove.current !== targetId) return;
        const next = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            '[data-combatant-select]'
          )
        ).find(button => button.dataset.combatantSelect === targetId);
        (
          next ?? document.querySelector<HTMLButtonElement>('[data-combat-add]')
        )?.focus();
      }, 0);
    },
  };

  return (
    <div className="relative flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[760px] space-y-2 p-4">
        {entities.length === 0 ? (
          <div className="py-12 text-center">
            <p className="type-subheading text-heading">
              Add combatants to set initiative.
            </p>
          </div>
        ) : (
          entities.map((entity, index) => {
            const isEntityActive = isActive && index === currentTurn;
            const pcId = entity.playerCharacterId;
            const syncId = pcId ?? entity.summonOwnerId;
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
                      syncId !== undefined ? playerSyncMap?.[syncId] : undefined
                    }
                    counterLabel={customCounterLabel}
                    counterValue={counterValue}
                    actions={actions}
                    onSelect={() => {}}
                  />
                  <div className="border-divider border-t pt-3">
                    <CombatantDetail
                      key={entity.id}
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
                  syncId !== undefined ? playerSyncMap?.[syncId] : undefined
                }
                counterLabel={customCounterLabel}
                counterValue={counterValue}
                actions={actions}
                onSelect={() => {
                  focusAfterRemove.current = null;
                  onOpenDrawer(entity.id);
                }}
              />
            );
          })
        )}
      </div>

      <Dialog
        open={!!drawerEntity}
        onOpenChange={open => {
          if (!open) onCloseDrawer();
        }}
      >
        {drawerEntity && (
          <DialogContent
            size="md"
            aria-describedby={undefined}
            onCloseAutoFocus={event => {
              if (focusAfterRemove.current !== null) event.preventDefault();
            }}
          >
            <DialogHeader>
              <DialogTitle>{drawerEntity.name} details</DialogTitle>
            </DialogHeader>
            <DialogBody className="min-h-0 overflow-y-auto">
              <CombatantDetail
                key={drawerEntity.id}
                entity={drawerEntity}
                actions={detailActions}
                hideNameHeading
                onOpenSheet={
                  drawerPcId !== undefined
                    ? () => actions.onViewPlayer?.(drawerPcId)
                    : undefined
                }
              />
            </DialogBody>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
