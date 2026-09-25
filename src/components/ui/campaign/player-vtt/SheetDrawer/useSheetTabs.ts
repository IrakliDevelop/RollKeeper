import { useCallback, useMemo, useState } from 'react';
import { Activity, Award, Dices, Sparkles, Star } from 'lucide-react';

import { useCharacterStore } from '@/store/characterStore';
import { isSpellcaster } from '@/utils/calculations';

import {
  SHEET_TAB_IDS,
  SHEET_TAB_STORAGE_KEY,
  type SheetTabId,
} from './SheetDrawer.types';
import type { SheetTabDefinition } from './SheetTabBar';

function readStoredTab(): SheetTabId {
  try {
    const stored = window.localStorage.getItem(SHEET_TAB_STORAGE_KEY);
    if (SHEET_TAB_IDS.includes(stored as SheetTabId)) {
      return stored as SheetTabId;
    }
  } catch {
    // localStorage unavailable (private mode, SSR) — fall back silently.
  }
  return 'overview';
}

function writeStoredTab(tab: SheetTabId) {
  try {
    window.localStorage.setItem(SHEET_TAB_STORAGE_KEY, tab);
  } catch {
    // localStorage unavailable — the tab still works, just doesn't persist.
  }
}

/**
 * Builds the sheet's tab list (Spells only for casters) and persists the
 * user's tab choice across opens. When the stored or requested tab isn't in
 * the current list the sheet shows Overview without overwriting the stored
 * preference, so e.g. 'spells' survives a visit to a non-caster.
 */
export function useSheetTabs() {
  const [activeTab, setActiveTabState] = useState<SheetTabId>(readStoredTab);
  const showSpellsTab = useCharacterStore(
    s => isSpellcaster(s.character) || (s.character.spells?.length ?? 0) > 0
  );

  const tabs: SheetTabDefinition[] = useMemo(
    () =>
      [
        { id: 'overview' as const, label: 'Overview', icon: Star },
        { id: 'abilities' as const, label: 'Abilities', icon: Dices },
        showSpellsTab && {
          id: 'spells' as const,
          label: 'Spells',
          icon: Sparkles,
        },
        { id: 'features' as const, label: 'Features', icon: Award },
        { id: 'effects' as const, label: 'Effects', icon: Activity },
      ].filter((tab): tab is SheetTabDefinition => Boolean(tab)),
    [showSpellsTab]
  );

  const setActiveTab = useCallback((tab: SheetTabId) => {
    setActiveTabState(tab);
    writeStoredTab(tab);
  }, []);

  const effectiveTab = tabs.some(t => t.id === activeTab)
    ? activeTab
    : 'overview';

  return { tabs, activeTab: effectiveTab, setActiveTab, showSpellsTab };
}
