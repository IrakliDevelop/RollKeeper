'use client';

import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Unlock } from 'lucide-react';

import RestDialog from '@/components/ui/character/RestDialog';
import type { ToastData } from '@/components/ui/feedback/Toast';
import { Button } from '@/components/ui/forms/button';
import { useSheetRoll } from '@/hooks/useSheetRoll';
import { useCharacterStore } from '@/store/characterStore';

import { SheetAbilities } from './SheetAbilities';
import {
  SHEET_DICE_ROLLS_ENABLED,
  type SheetSpellCastingProps,
  type SheetTabId,
} from './SheetDrawer.types';
import { SheetHeader } from './SheetHeader';
import { SheetTabBar } from './SheetTabBar';
import { SheetVitals } from './SheetVitals';
import { AbilitiesTab } from './tabs/AbilitiesTab';
import { EffectsTab } from './tabs/EffectsTab';
import { FeaturesTab } from './tabs/FeaturesTab';
import { InventoryTab } from './tabs/InventoryTab';
import { OverviewTab } from './tabs/OverviewTab';
import { SpellsTab } from './tabs/SpellsTab';
import { useSheetTabs } from './useSheetTabs';

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
  spellCasting: SheetSpellCastingProps;
}

export function OwnSheet({
  onClose,
  addToast,
  showAttackRoll,
  onRested,
  spellCasting,
}: OwnSheetProps) {
  const name = useCharacterStore(s => s.character.name);
  const takeShortRest = useCharacterStore(s => s.takeShortRest);
  const takeLongRest = useCharacterStore(s => s.takeLongRest);

  const [locked, setLocked] = useState(true);
  const [restType, setRestType] = useState<'short' | 'long' | null>(null);
  const { tabs, activeTab, setActiveTab } = useSheetTabs();

  const roll = useSheetRoll({ diceReady: false, showAttackRoll });
  const rollOrUndefined = SHEET_DICE_ROLLS_ENABLED ? roll : undefined;

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
        <SheetVitals addToast={addToast} roll={rollOrUndefined} />
        <SheetAbilities locked={locked} roll={rollOrUndefined} />
      </div>

      <Tabs.Root
        value={activeTab}
        onValueChange={v => setActiveTab(v as SheetTabId)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <SheetTabBar tabs={tabs} activeTab={activeTab} />

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
          <OverviewTab addToast={addToast} spellCasting={spellCasting} />
        </Tabs.Content>
        {tabs
          .filter(tab => tab.id !== 'overview')
          .map(tab => (
            <Tabs.Content
              key={tab.id}
              value={tab.id}
              className="flex-1 overflow-y-auto px-5 py-4"
            >
              {tab.id === 'abilities' && (
                <AbilitiesTab locked={locked} roll={rollOrUndefined} />
              )}
              {tab.id === 'spells' && (
                <SpellsTab
                  locked={locked}
                  addToast={addToast}
                  spellCasting={spellCasting}
                  roll={rollOrUndefined}
                />
              )}
              {tab.id === 'inventory' && (
                <InventoryTab locked={locked} addToast={addToast} />
              )}
              {tab.id === 'features' && <FeaturesTab />}
              {tab.id === 'effects' && (
                <EffectsTab addToast={addToast} roll={rollOrUndefined} />
              )}
            </Tabs.Content>
          ))}
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
