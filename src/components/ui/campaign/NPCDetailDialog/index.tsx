'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { SubTabs, type SubTabDefinition } from '@/components/ui/layout/SubTabs';
import { RowAvatar } from '@/components/ui/campaign/RowAvatar';
import { NPCSpellTab } from '../NPCSpellTab';
import { NPCShopTab } from '../NPCShopTab';
import { NPCStatBlockExport } from '../NPCStatBlockExport';
import { LIBRARY_COPY, creatureMetaLine } from '../NpcLibrary/NpcLibrary.utils';
import { StatBlockTab } from './StatBlockTab';
import { InventoryTab } from './InventoryTab';
import { LoreTab } from './LoreTab';
import { useNPCStore } from '@/store/npcStore';
import type { CampaignNPC, NPCInventoryItem } from '@/types/encounter';

type DetailTab = 'stats' | 'spells' | 'inventory' | 'lore' | 'shop';

export interface NPCDetailDialogProps {
  npc: CampaignNPC | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (npc: CampaignNPC) => void;
  onDelete?: (npc: CampaignNPC) => void;
  onUpdateInventory?: (npcId: string, inventory: NPCInventoryItem[]) => void;
  onSendItemToPlayer?: (item: NPCInventoryItem, npcName: string) => void;
  initialTab?: DetailTab;
  readOnly?: boolean;
  encounterId?: string;
  npcEntityId?: string;
}

export function NPCDetailDialog({
  npc,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onUpdateInventory,
  onSendItemToPlayer,
  initialTab,
  readOnly,
  encounterId,
  npcEntityId,
}: NPCDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('stats');
  const addSpellRef = useRef<(() => void) | null>(null);
  const tabsId = useId();

  const handleTabChange = useCallback(
    (tab: DetailTab) => {
      setActiveTab(tab);
      if (npc) {
        useNPCStore
          .getState()
          .updateNPC(npc.campaignCode, npc.id, { lastDetailTab: tab });
      }
    },
    [npc]
  );

  useEffect(() => {
    if (open) {
      if (initialTab) {
        setActiveTab(initialTab);
      } else if (npc?.lastDetailTab) {
        setActiveTab(npc.lastDetailTab);
      } else {
        setActiveTab('stats');
      }
    }
  }, [open, initialTab, npc?.lastDetailTab]);

  if (!npc) return null;

  const kind = npc.kind ?? 'npc';
  const copy = LIBRARY_COPY[kind];
  const meta = creatureMetaLine(npc);
  const note = npc.description?.trim();
  const avatar = npc.avatarUrl?.trim();
  const showSpellsTab = !!npc.spellcasting;

  const canEditDelete = !readOnly && !!onEdit && !!onDelete;
  const showAddSpell = activeTab === 'spells' && showSpellsTab;
  const hasFooter = !!npc.monsterStatBlock || showAddSpell || canEditDelete;

  // The tab list scrolls sideways; a tab reached by keyboard must be in view.
  const revealFocusedTab = (event: React.FocusEvent<HTMLDivElement>) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.matches('[role="tab"]')) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };

  const editNpc = () => {
    onEdit?.(npc);
    onOpenChange(false);
  };

  const tabs: SubTabDefinition[] = [
    {
      value: 'stats',
      id: `${tabsId}-stats`,
      label: 'Stat block',
      content: <StatBlockTab npc={npc} readOnly={readOnly} />,
    },
    ...(showSpellsTab
      ? [
          {
            value: 'spells',
            id: `${tabsId}-spells`,
            label: 'Spells',
            content: (
              <NPCSpellTab
                npc={npc}
                campaignCode={npc.campaignCode}
                addSpellRef={addSpellRef}
                encounterId={encounterId}
                npcEntityId={npcEntityId}
              />
            ),
          },
        ]
      : []),
    {
      value: 'inventory',
      id: `${tabsId}-inventory`,
      label: 'Inventory',
      content: (
        <InventoryTab
          npc={npc}
          readOnly={readOnly}
          onUpdateInventory={onUpdateInventory}
          onSendItemToPlayer={onSendItemToPlayer}
        />
      ),
    },
    {
      value: 'lore',
      id: `${tabsId}-lore`,
      label: 'Lore',
      content: (
        <LoreTab
          npc={npc}
          onAddLore={onEdit && !readOnly ? editNpc : undefined}
        />
      ),
    },
    {
      value: 'shop',
      id: `${tabsId}-shop`,
      label: 'Shop',
      content: <NPCShopTab npc={npc} readOnly={readOnly} />,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        className="h-[85vh]"
        // Radix points aria-describedby at a description that is not
        // rendered when there is neither a meta line nor a note.
        {...(meta || note ? {} : { 'aria-describedby': undefined })}
      >
        <DialogHeader className="pr-10">
          <div className="flex gap-3">
            {avatar && <RowAvatar src={avatar} name={npc.name} />}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <DialogTitle>{npc.name}</DialogTitle>
                {npc.shop?.open && (
                  <Badge variant="neutral" size="sm">
                    Shop open
                  </Badge>
                )}
              </div>
              {meta ? (
                <>
                  <DialogDescription className="type-small text-muted">
                    {meta}
                  </DialogDescription>
                  {note && <p className="type-small text-body">{note}</p>}
                </>
              ) : (
                note && (
                  <DialogDescription className="type-small text-body">
                    {note}
                  </DialogDescription>
                )
              )}
            </div>
          </div>
        </DialogHeader>

        <div
          className="flex min-h-0 flex-1 flex-col"
          onFocusCapture={revealFocusedTab}
        >
          <SubTabs
            label={copy.sheetLabel}
            value={
              activeTab === 'spells' && !showSpellsTab ? 'stats' : activeTab
            }
            onValueChange={value => handleTabChange(value as DetailTab)}
            // The list scrolls sideways, so it can shrink; keep it whole.
            className="flex min-h-0 flex-1 flex-col [&>[role=tablist]]:shrink-0"
            contentClassName="min-h-0 flex-1 overflow-y-auto"
            tabs={tabs}
          />
        </div>

        {hasFooter && (
          <DialogFooter className="flex-row flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {npc.monsterStatBlock && <NPCStatBlockExport npc={npc} />}
            </div>
            <div className="flex flex-wrap gap-2">
              {showAddSpell && (
                <Button size="sm" onClick={() => addSpellRef.current?.()}>
                  Add spell
                </Button>
              )}
              {canEditDelete && (
                <>
                  <Button onClick={editNpc}>{copy.editLabel}</Button>
                  <Button variant="danger" onClick={() => onDelete(npc)}>
                    {copy.deleteConfirm}
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
