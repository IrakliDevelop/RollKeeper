'use client';

import { useCallback, useRef, useState } from 'react';

import type { SheetOpenTarget } from './SheetDrawer/SheetDrawer.types';

interface UseSheetDrawerStateParams {
  sheetReady: boolean;
  dockCollapsed: boolean;
  setDockCollapsed: (collapsed: boolean) => void;
}

/**
 * Sheet drawer open/close state plus the dock-collapse side effect: opening
 * the sheet remembers the dock's current collapsed state and force-collapses
 * it; closing restores whatever it was before. Extracted from
 * `PlayerVttScreen` so the collapse/restore logic is unit-testable without a
 * full screen render.
 *
 * Focus return: the dock's Sheet button unmounts while the drawer is open
 * (the dock collapses to its pill), so SideDrawer's default "refocus what was
 * focused at open" can't reach it. When the dock opened the drawer,
 * `handleSheetCloseAutoFocus` focuses the re-expanded button via
 * `sheetButtonRef` instead. Canvas-opened drawers fall through to
 * SideDrawer's default, which refocuses the map element.
 *
 * `openTarget` tracks WHICH sheet is showing (own vs. a party member's
 * limited view — see `SheetOpenTarget`). Opening while already open (e.g. a
 * party token double-tapped while the own sheet is up) only swaps the
 * target — it does not re-run the dock-collapse side effect or overwrite
 * `openedFromDock`/`dockCollapsedBeforeSheet`, so the eventual close still
 * restores whatever state preceded the FIRST open.
 */
export function useSheetDrawerState({
  sheetReady,
  dockCollapsed,
  setDockCollapsed,
}: UseSheetDrawerStateParams) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [openTarget, setOpenTarget] = useState<SheetOpenTarget | null>(null);
  const dockCollapsedBeforeSheet = useRef<boolean | null>(null);
  const openedFromDock = useRef(false);
  const sheetButtonRef = useRef<HTMLButtonElement>(null);

  const open = useCallback(
    (fromDock: boolean, target: SheetOpenTarget) => {
      if (!sheetReady) return;
      if (sheetOpen) {
        setOpenTarget(target);
        return;
      }
      openedFromDock.current = fromDock;
      dockCollapsedBeforeSheet.current = dockCollapsed;
      setDockCollapsed(true);
      setSheetOpen(true);
      setOpenTarget(target);
    },
    [sheetReady, sheetOpen, dockCollapsed, setDockCollapsed]
  );

  /** Open from the map (own-token double-tap). */
  const openSheet = useCallback(() => open(false, { kind: 'own' }), [open]);
  /** Open from the dock's Sheet button; focus returns to it on close. */
  const openSheetFromDock = useCallback(
    () => open(true, { kind: 'own' }),
    [open]
  );
  /** Open (or switch to) a party member's limited view from their token. */
  const openPartySheet = useCallback(
    (characterId: string) => open(false, { kind: 'party', characterId }),
    [open]
  );

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setOpenTarget(null);
    if (dockCollapsedBeforeSheet.current !== null) {
      setDockCollapsed(dockCollapsedBeforeSheet.current);
      dockCollapsedBeforeSheet.current = null;
    }
  }, [setDockCollapsed]);

  // Radix fires this after the close commit, so the re-expanded dock's button
  // is already mounted. If it isn't (dock stayed collapsed), fall through to
  // SideDrawer's default focus return.
  const handleSheetCloseAutoFocus = useCallback((event: Event) => {
    const fromDock = openedFromDock.current;
    openedFromDock.current = false;
    const button = sheetButtonRef.current;
    if (!fromDock || !button) return;
    event.preventDefault();
    button.focus();
  }, []);

  return {
    sheetOpen,
    openTarget,
    openSheet,
    openSheetFromDock,
    openPartySheet,
    closeSheet,
    sheetButtonRef,
    handleSheetCloseAutoFocus,
  };
}
