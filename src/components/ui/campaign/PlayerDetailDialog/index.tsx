'use client';

import { useEffect, useId, useState } from 'react';
import { Download, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { SubTabs, type SubTabDefinition } from '@/components/ui/layout/SubTabs';
import { playerDisplayName } from '@/components/ui/campaign/PlayerRosterRow';
import { OverviewTab } from './OverviewTab';
import { InventoryTab } from './InventoryTab';
import { SpellsTab, characterHasSpellsToShow } from './SpellsTab';
import { ensureArray } from './shared';
import { CampaignPlayerData } from '@/types/campaign';
import type { MulticlassInfo } from '@/types/character';
import { exportCharacterStateToFile } from '@/utils/fileOperations';

type DetailTab = 'overview' | 'spells' | 'inventory';

interface PlayerDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: CampaignPlayerData;
  customCounterLabel?: string;
  counterValue?: number;
  onAdjustCounter?: (delta: number) => void;
  onSendMessage?: () => void;
  campaignCode?: string;
  dmId?: string;
}

export function PlayerDetailDialog({
  open,
  onOpenChange,
  player,
  customCounterLabel,
  counterValue = 0,
  onAdjustCounter,
  onSendMessage,
  campaignCode,
  dmId,
}: PlayerDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  const tabsId = useId();

  // Reset to Overview each time the dialog opens
  useEffect(() => {
    if (open) setActiveTab('overview');
  }, [open]);

  const char = player.characterData;
  if (!char) return null;
  const name = playerDisplayName(player);
  const level = char.totalLevel || char.level || 1;
  const classes = ensureArray<MulticlassInfo>(char.classes)
    .filter(c => c.className)
    .map(c => `${c.className} ${c.level}`)
    .join(' / ');
  const classLine =
    classes ||
    (char.class?.name ? `${char.class.name} ${level}` : `Level ${level}`);
  const description = [
    [char.race, classLine].filter(Boolean).join(' '),
    char.alignment,
    player.playerName && `Played by ${player.playerName}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const showSpellsTab = characterHasSpellsToShow(char);

  const tabs: SubTabDefinition[] = [
    {
      value: 'overview',
      id: `${tabsId}-overview`,
      label: 'Overview',
      content: (
        <OverviewTab
          char={char}
          name={name}
          customCounterLabel={customCounterLabel}
          counterValue={counterValue}
          onAdjustCounter={onAdjustCounter}
          campaignCode={campaignCode}
          dmId={dmId}
          playerId={player.playerId}
          projectedExperience={player.projectedExperience}
          pendingXpAwardCount={player.pendingXpAwardCount}
        />
      ),
    },
    ...(showSpellsTab
      ? [
          {
            value: 'spells',
            id: `${tabsId}-spells`,
            label: 'Spells',
            content: <SpellsTab char={char} />,
          },
        ]
      : []),
    {
      value: 'inventory',
      id: `${tabsId}-inventory`,
      label: 'Inventory',
      content: <InventoryTab char={char} />,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader className="pr-10">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <DialogTitle>{name}</DialogTitle>
              <DialogDescription className="text-muted">
                {description}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Download size={14} />}
                onClick={() => exportCharacterStateToFile(char)}
              >
                Export character
              </Button>
              {onSendMessage && (
                <Button
                  size="sm"
                  leftIcon={<MessageSquare size={14} />}
                  onClick={onSendMessage}
                >
                  Message
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <SubTabs
          label="Character sheet"
          value={
            activeTab === 'spells' && !showSpellsTab ? 'overview' : activeTab
          }
          onValueChange={v => setActiveTab(v as DetailTab)}
          className="flex min-h-0 flex-1 flex-col"
          contentClassName="min-h-0 flex-1 overflow-y-auto"
          tabs={tabs}
        />
      </DialogContent>
    </Dialog>
  );
}
