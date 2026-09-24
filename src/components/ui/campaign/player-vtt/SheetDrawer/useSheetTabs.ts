import { useEffect, useMemo, useState } from 'react';
import { Activity, Award, Dices, Sparkles, Star } from 'lucide-react';

import type { CharacterState } from '@/types/character';
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

/**
 * Builds the sheet's tab list (Spells only for casters) and persists the
 * active tab across opens, falling back to Overview when the stored or
 * requested tab isn't in the current list.
 */
export function useSheetTabs(character: CharacterState) {
  const [activeTab, setActiveTab] = useState<SheetTabId>(readStoredTab);
  const showSpellsTab = isSpellcaster(character) || character.spells.length > 0;

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

  const effectiveTab = tabs.some(t => t.id === activeTab)
    ? activeTab
    : 'overview';

  useEffect(() => {
    try {
      window.localStorage.setItem(SHEET_TAB_STORAGE_KEY, effectiveTab);
    } catch {
      // localStorage unavailable — the tab still works, just doesn't persist.
    }
  }, [effectiveTab]);

  return { tabs, activeTab: effectiveTab, setActiveTab, showSpellsTab };
}
