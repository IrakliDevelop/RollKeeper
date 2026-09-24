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
 */
export function useSheetDrawerState({
  sheetReady,
  dockCollapsed,
  setDockCollapsed,
}: UseSheetDrawerStateParams) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const dockCollapsedBeforeSheet = useRef<boolean | null>(null);

  const openSheet = useCallback(() => {
    if (!sheetReady || sheetOpen) return;
    dockCollapsedBeforeSheet.current = dockCollapsed;
    setDockCollapsed(true);
    setSheetOpen(true);
  }, [sheetReady, sheetOpen, dockCollapsed, setDockCollapsed]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    if (dockCollapsedBeforeSheet.current !== null) {
      setDockCollapsed(dockCollapsedBeforeSheet.current);
      dockCollapsedBeforeSheet.current = null;
    }
  }, [setDockCollapsed]);

  return { sheetOpen, openSheet, closeSheet };
}
