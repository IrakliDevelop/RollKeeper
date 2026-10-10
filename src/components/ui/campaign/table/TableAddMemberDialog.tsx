'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { PlayerTab } from '@/components/ui/encounter/combat-screen/AddCombatantDialog/PlayerTab';
import type { TableCampaignPlayer } from '@/lib/table/roster';
import type {
  TableActorLiveStatsV1,
  TableActorProfileV1,
} from '@/lib/table/schema';
import type { EncounterEntity } from '@/types/encounter';

import { TableAddCreatureTab } from './TableAddCreatureTab';
import { TableAddManualPcTab } from './TableAddManualPcTab';
import { TableAddNpcTab } from './TableAddNpcTab';
import { TableRosterNoticeLine } from './TableRosterNoticeLine';
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
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabId = (id: Tab) => `${baseId}-tab-${id}`;
  const panelId = `${baseId}-panel`;

  // WAI-ARIA tabs: roving tabindex; arrows/Home/End move focus and select.
  const handleTabKey = (event: KeyboardEvent, index: number) => {
    const last = TABS.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setTab(TABS[next]!.id);
    tabRefs.current[next]?.focus();
  };

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
            Everyone you add is saved on this device. Party members stay linked
            to their players.
          </DialogDescription>
        </DialogHeader>
        <div
          role="tablist"
          aria-label="Participant type"
          className="flex flex-wrap gap-2"
        >
          {TABS.map((entry, index) => (
            <Button
              key={entry.id}
              ref={element => {
                tabRefs.current[index] = element;
              }}
              id={tabId(entry.id)}
              role="tab"
              aria-selected={tab === entry.id}
              aria-controls={panelId}
              tabIndex={tab === entry.id ? 0 : -1}
              onKeyDown={event => handleTabKey(event, index)}
              variant={tab === entry.id ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </Button>
          ))}
        </div>
        <TableRosterNoticeLine notice={props.notice} />
        <DialogBody
          role="tabpanel"
          id={panelId}
          aria-labelledby={tabId(tab)}
          className="min-h-[12rem]"
        >
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
                    : "Couldn't load the player list, so we can't check who controls each party member."}
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
            <TableAddNpcTab
              campaignCode={props.campaignCode}
              onAdd={stats =>
                props.onAddParticipant('roster.addCreatureInstance', stats)
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
