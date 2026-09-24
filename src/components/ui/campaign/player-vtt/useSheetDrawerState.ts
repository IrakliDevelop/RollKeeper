'use client';

import { useCallback, useRef, useState } from 'react';

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
 */
export function useSheetDrawerState({
  sheetReady,
  dockCollapsed,
  setDockCollapsed,
}: UseSheetDrawerStateParams) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const dockCollapsedBeforeSheet = useRef<boolean | null>(null);
  const openedFromDock = useRef(false);
  const sheetButtonRef = useRef<HTMLButtonElement>(null);

  const open = useCallback(
    (fromDock: boolean) => {
      if (!sheetReady || sheetOpen) return;
      openedFromDock.current = fromDock;
      dockCollapsedBeforeSheet.current = dockCollapsed;
      setDockCollapsed(true);
      setSheetOpen(true);
    },
    [sheetReady, sheetOpen, dockCollapsed, setDockCollapsed]
  );

  /** Open from the map (own-token double-tap). */
  const openSheet = useCallback(() => open(false), [open]);
  /** Open from the dock's Sheet button; focus returns to it on close. */
  const openSheetFromDock = useCallback(() => open(true), [open]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
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
    openSheet,
    openSheetFromDock,
    closeSheet,
    sheetButtonRef,
    handleSheetCloseAutoFocus,
  };
}
