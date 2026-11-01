'use client';

import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import BookmarkTabs from '@/components/ui/layout/BookmarkTabs';
import { SectionFramesProvider } from '@/components/ui/layout/section';
import type { BookmarkTabsRef } from '@/components/ui/layout/BookmarkTabs';
import {
  createTabbedSheetConfig,
  TabbedSheetConfigParams,
} from './tabbedSheetConfig';

export interface TabbedCharacterSheetRef {
  switchToTab: (tabId: string, options?: { scroll?: boolean }) => void;
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

  const tabs = createTabbedSheetConfig(props);

  useImperativeHandle(
    ref,
    () => ({
      switchToTab: (tabId: string, options?: { scroll?: boolean }) => {
        const mappedId = TAB_ID_MAP[tabId] || tabId;
        tabsRef.current?.switchToTab(mappedId, options);
      },
      getCurrentTab: () => tabsRef.current?.getCurrentTab() || 'actions',
    }),
    []
  );

  return (
    <SectionFramesProvider value={true}>
      <BookmarkTabs
        ref={tabsRef}
        tabs={tabs}
        defaultTab="actions"
        persistKey="tabbed-layout-active-tab"
        // Tab jumps scroll the tabs to the top; keep them below the sticky bar.
        className="scroll-mt-[calc(var(--app-header-height,4rem)+1rem)]"
      />
    </SectionFramesProvider>
  );
});

TabbedCharacterSheet.displayName = 'TabbedCharacterSheet';

export default TabbedCharacterSheet;
