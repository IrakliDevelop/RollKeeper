'use client';

import { useState } from 'react';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { NpcTab } from '@/components/ui/encounter/combat-screen/AddCombatantDialog/NpcTab';
import { PlayerTab } from '@/components/ui/encounter/combat-screen/AddCombatantDialog/PlayerTab';
import type { TableCampaignPlayer } from '@/lib/table/roster';
import type {
  TableActorLiveStatsV1,
  TableActorProfileV1,
} from '@/lib/table/schema';
import type { EncounterEntity } from '@/types/encounter';

import { TableAddCreatureTab } from './TableAddCreatureTab';
import { TableAddManualPcTab } from './TableAddManualPcTab';
import { TableRosterNoticeLine } from './TableRosterNoticeLine';
import { creatureFromEntity } from './tableRosterModel';
import type { TableRosterNotice } from './useTableRosterActions';
import type { TablePlayersSnapshot } from './useTablePlayersSnapshot';

type Tab = 'party' | 'creature' | 'npc' | 'manual';
type ParticipantStats = {
  liveStats: TableActorLiveStatsV1;
  profile: TableActorProfileV1;
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'party', label: 'Party' },
  { id: 'creature', label: 'Creature' },
  { id: 'npc', label: 'Campaign NPC' },
  { id: 'manual', label: 'Manual PC' },
];

const NO_NPCS: never[] = [];

/** Add party / creature-or-NPC / manual PC to a scene (no encounter needed). */
export function TableAddMemberDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignCode: string;
  players: TablePlayersSnapshot;
  onRetryPlayers: () => void;
  notice: TableRosterNotice | null;
  busy: boolean;
  onAddParty: (player: TableCampaignPlayer) => void;
  onAddParticipant: (
    kind: 'roster.addCreatureInstance' | 'roster.addManualParticipant',
    stats: ParticipantStats
  ) => void;
}) {
  const [tab, setTab] = useState<Tab>('party');
  const players = props.players;

  const handleParty = (entity: Omit<EncounterEntity, 'id'>) => {
    if (players.status !== 'ready') return;
    const player = players.players.find(
      entry => entry.playerId === entity.playerCharacterId
    );
    if (player) props.onAddParty(player);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Add to scene</DialogTitle>
          <DialogDescription>
            Scene participants are saved on this device. Party members are
            linked to their campaign player identity.
          </DialogDescription>
        </DialogHeader>
        <div
          role="tablist"
          aria-label="Participant type"
          className="flex flex-wrap gap-2"
        >
          {TABS.map(entry => (
            <Button
              key={entry.id}
              role="tab"
              aria-selected={tab === entry.id}
              variant={tab === entry.id ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </Button>
          ))}
        </div>
        <TableRosterNoticeLine notice={props.notice} />
        <DialogBody role="tabpanel" className="min-h-[12rem]">
          {tab === 'party' &&
            (players.status === 'ready' ? (
              <PlayerTab
                players={players.campaignPlayers}
                campaignCode={props.campaignCode}
                onAdd={handleParty}
              />
            ) : (
              <div className="space-y-2">
                <p className="text-muted text-sm">
                  {players.status === 'loading'
                    ? 'Loading campaign players…'
                    : 'Campaign players are unavailable, so party control cannot be verified.'}
                </p>
                {players.status === 'unavailable' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={props.onRetryPlayers}
                  >
                    Retry
                  </Button>
                )}
              </div>
            ))}
          {tab === 'creature' && (
            <TableAddCreatureTab
              onAdd={stats =>
                props.onAddParticipant('roster.addCreatureInstance', stats)
              }
            />
          )}
          {tab === 'npc' && (
            <NpcTab
              npcs={NO_NPCS}
              campaignCode={props.campaignCode}
              onAdd={entity =>
                props.onAddParticipant(
                  'roster.addCreatureInstance',
                  creatureFromEntity(entity, 'campaign-npc')
                )
              }
            />
          )}
          {tab === 'manual' && (
            <TableAddManualPcTab
              disabled={props.busy}
              onAdd={stats =>
                props.onAddParticipant('roster.addManualParticipant', stats)
              }
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
