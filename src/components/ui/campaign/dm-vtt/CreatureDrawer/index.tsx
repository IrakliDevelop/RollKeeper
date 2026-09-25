'use client';

import { useLayoutEffect, useRef } from 'react';

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
 * Escape inside an editable field belongs to that field (cancel rename,
 * leave an input) — keep the drawer open instead of letting Radix close it.
 */
function keepOpenWhileEditing(event: KeyboardEvent) {
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    event.preventDefault();
  }
}

const STUDIO_PANEL_SELECTOR = '[data-testid="dm-vtt-studio-panel"]';

/**
 * Remembers the element focused when the drawer opens (layout effect: runs
 * before Radix moves focus inside) and, on close, if that element has since
 * unmounted — e.g. the Sheet pill, hidden while the drawer is open — moves
 * focus into the Studio panel instead of dropping it on <body>. When the
 * opener is still connected, `SideDrawer`'s default focus return applies.
 */
function useStudioPanelFocusFallback(open: boolean) {
  const openerRef = useRef<Element | null>(null);

  useLayoutEffect(() => {
    if (open) openerRef.current = document.activeElement;
  }, [open]);

  return (event: Event) => {
    const opener = openerRef.current;
    openerRef.current = null;
    if (!opener || opener === document.body || opener.isConnected) return;
    const panel = document.querySelector<HTMLElement>(STUDIO_PANEL_SELECTOR);
    if (!panel) return;
    const target =
      panel.tabIndex >= 0
        ? panel
        : panel.querySelector<HTMLElement>('button:not([disabled])');
    if (!target) return;
    event.preventDefault();
    target.focus();
  };
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
  const handleCloseAutoFocus = useStudioPanelFocusFallback(entity !== null);

  return (
    <SideDrawer
      open={entity !== null}
      onOpenChange={open => !open && onClose()}
      title={`${entity?.name ?? 'Creature'} sheet`}
      onEscapeKeyDown={keepOpenWhileEditing}
      onCloseAutoFocus={handleCloseAutoFocus}
      className="w-[min(600px,100vw)] xl:w-[min(680px,100vw)]"
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
