'use client';

import React, { forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import BookmarkTabs from '@/components/ui/layout/BookmarkTabs';
import type { BookmarkTabsRef } from '@/components/ui/layout/BookmarkTabs';
import {
  createTabbedSheetConfig,
  TabbedSheetConfigParams,
} from './tabbedSheetConfig';

export interface TabbedCharacterSheetRef {
  switchToTab: (tabId: string) => void;
  getCurrentTab: () => string;
}

type TabbedCharacterSheetProps = TabbedSheetConfigParams;

const TAB_ID_MAP: Record<string, string> = {
  conditions: 'combat',
  spellcasting: 'spells',
  equipment: 'inventory',
  currency: 'inventory',
  'character-details': 'character',
  notes: 'character',
};

const TabbedCharacterSheet = forwardRef<
  TabbedCharacterSheetRef,
  TabbedCharacterSheetProps
>((props, ref) => {
  const tabsRef = useRef<BookmarkTabsRef>(null);

  const tabs = useMemo(() => createTabbedSheetConfig(props), [props]);

  useImperativeHandle(
    ref,
    () => ({
      switchToTab: (tabId: string) => {
        const mappedId = TAB_ID_MAP[tabId] || tabId;
        tabsRef.current?.switchToTab(mappedId);
      },
      getCurrentTab: () => tabsRef.current?.getCurrentTab() || 'actions',
    }),
    []
  );

  return (
    <BookmarkTabs
      ref={tabsRef}
      tabs={tabs}
      defaultTab="actions"
      persistKey="tabbed-layout-active-tab"
    />
  );
});

TabbedCharacterSheet.displayName = 'TabbedCharacterSheet';

export default TabbedCharacterSheet;
