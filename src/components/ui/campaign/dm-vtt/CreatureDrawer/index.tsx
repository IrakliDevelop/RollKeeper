'use client';

import { SideDrawer } from '@/components/ui/feedback/SideDrawer';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';
import type { EncounterEntity } from '@/types/encounter';

import { CreatureSheet } from './CreatureSheet';

export interface CreatureDrawerProps {
  /** Entity shown; null = closed. */
  entity: EncounterEntity | null;
  actions: EntityActions;
  /** Whether this entity holds the current turn. */
  isTurn: boolean;
  onClose: () => void;
  onTokenIdentityChange?: (
    entity: EncounterEntity,
    updates: Pick<
      EncounterEntity,
      'avatarUrl' | 'tokenSize' | 'chessPiece' | 'color'
    >
  ) => void;
}

/**
 * DM battle-map creature sheet: a non-modal `SideDrawer` around
 * `CreatureSheet`. Keyed by entity id, so switching creatures resets the
 * Play/Editing lock and the active tab.
 */
export function CreatureDrawer({
  entity,
  actions,
  isTurn,
  onClose,
  onTokenIdentityChange,
}: CreatureDrawerProps) {
  return (
    <SideDrawer
      open={entity !== null}
      onOpenChange={open => !open && onClose()}
      title={`${entity?.name ?? 'Creature'} sheet`}
    >
      {entity && (
        <CreatureSheet
          key={entity.id}
          entity={entity}
          actions={actions}
          isTurn={isTurn}
          onClose={onClose}
          onTokenIdentityChange={
            onTokenIdentityChange
              ? updates => onTokenIdentityChange(entity, updates)
              : undefined
          }
        />
      )}
    </SideDrawer>
  );
}
