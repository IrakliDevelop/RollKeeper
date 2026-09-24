'use client';

import { useEffect, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Star, Unlock } from 'lucide-react';

import RestDialog from '@/components/ui/character/RestDialog';
import type { ToastData } from '@/components/ui/feedback/Toast';
import { Button } from '@/components/ui/forms/button';
import { useSheetRoll } from '@/hooks/useSheetRoll';
import { useCharacterStore } from '@/store/characterStore';

import { SheetAbilities } from './SheetAbilities';
import {
  SHEET_DICE_ROLLS_ENABLED,
  SHEET_TAB_STORAGE_KEY,
  type SheetTabId,
} from './SheetDrawer.types';
import { SheetHeader } from './SheetHeader';
import { SheetTabBar, type SheetTabDefinition } from './SheetTabBar';
import { SheetVitals } from './SheetVitals';
import { OverviewTab } from './tabs/OverviewTab';

export interface OwnSheetProps {
  onClose: () => void;
  addToast: (t: Omit<ToastData, 'id'>) => void;
  showAttackRoll: (
    label: string,
    roll: number,
    bonus: number,
    isCrit: boolean
  ) => void;
  onRested: (type: 'short' | 'long') => void;
}

// PR 1 ships only the Overview tab; later PRs extend this list.
const TABS: SheetTabDefinition[] = [
  { id: 'overview', label: 'Overview', icon: Star },
];

function readStoredTab(): SheetTabId {
  try {
    const stored = window.localStorage.getItem(SHEET_TAB_STORAGE_KEY);
    if (stored === 'overview') return stored;
  } catch {
    // localStorage unavailable (private mode, SSR) — fall back silently.
  }
  return 'overview';
}

export function OwnSheet({
  onClose,
  addToast,
  showAttackRoll,
  onRested,
}: OwnSheetProps) {
  const name = useCharacterStore(s => s.character.name);
  const takeShortRest = useCharacterStore(s => s.takeShortRest);
  const takeLongRest = useCharacterStore(s => s.takeLongRest);

  const [locked, setLocked] = useState(true);
  const [restType, setRestType] = useState<'short' | 'long' | null>(null);
  const [activeTab, setActiveTab] = useState<SheetTabId>(readStoredTab);

  const roll = useSheetRoll({ diceReady: false, showAttackRoll });

  useEffect(() => {
    try {
      window.localStorage.setItem(SHEET_TAB_STORAGE_KEY, activeTab);
    } catch {
      // localStorage unavailable — the tab still works, just doesn't persist.
    }
  }, [activeTab]);

  return (
    <div className="flex h-full flex-col">
      <SheetHeader
        locked={locked}
        onToggleLock={() => setLocked(l => !l)}
        onClose={onClose}
        onShortRest={() => setRestType('short')}
        onLongRest={() => setRestType('long')}
      />

      <div className="space-y-3 px-5 pb-4">
        <SheetVitals
          addToast={addToast}
          roll={SHEET_DICE_ROLLS_ENABLED ? roll : undefined}
        />
        <SheetAbilities
          locked={locked}
          roll={SHEET_DICE_ROLLS_ENABLED ? roll : undefined}
        />
      </div>

      <Tabs.Root
        value={activeTab}
        onValueChange={v => setActiveTab(v as SheetTabId)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <SheetTabBar tabs={TABS} activeTab={activeTab} />

        {!locked && (
          <div className="bg-accent-amber-bg border-accent-amber-border text-accent-amber-text flex items-center gap-2 border-b px-5 py-2 text-xs">
            <Unlock className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">
              Editing unlocked. Changes save to {name}&apos;s sheet and sync to
              the DM.
            </span>
            <Button variant="ghost" size="sm" onClick={() => setLocked(true)}>
              Done
            </Button>
          </div>
        )}

        <Tabs.Content
          value="overview"
          className="flex-1 overflow-y-auto px-5 py-4"
        >
          <OverviewTab addToast={addToast} />
        </Tabs.Content>
      </Tabs.Root>

      <RestDialog
        restType={restType}
        onClose={() => setRestType(null)}
        onConfirm={() => {
          if (restType === 'short') takeShortRest();
          else if (restType === 'long') takeLongRest();
          onRested(restType!);
          setRestType(null);
        }}
      />
    </div>
  );
}
