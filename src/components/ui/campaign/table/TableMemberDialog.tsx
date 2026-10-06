'use client';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import type { TableRosterEntry } from '@/lib/table/roster';
import type { TableActorLiveStatsV1 } from '@/lib/table/schema';

import {
  TableMemberControls,
  type TableMemberActions,
} from './TableMemberControls';
import { TableMemberStatsForm } from './TableMemberStatsForm';
import { TableRosterNoticeLine } from './TableRosterNoticeLine';
import { controlLabel } from './tableRosterModel';
import type { TableRosterNotice } from './useTableRosterActions';
import type { TablePlayersSnapshot } from './useTablePlayersSnapshot';

const CATEGORY_LABEL = {
  pc: 'Player character',
  npc: 'NPC',
  monster: 'Creature',
};

/** Member details: stats (DM-managed non-PCs only), control and tokens. */
export function TableMemberDialog(props: {
  entry: TableRosterEntry | null;
  onClose: () => void;
  players: TablePlayersSnapshot;
  ambiguousTokenIds: readonly string[];
  unmatchedTokenIds: readonly string[];
  liveIds: ReadonlySet<string>;
  notice: TableRosterNotice | null;
  busy: boolean;
  onSave: (stats: TableActorLiveStatsV1) => void;
  onPlace: () => void;
  onRemove: () => void;
  actions: TableMemberActions;
}) {
  const entry = props.entry;
  return (
    <Dialog
      open={entry !== null}
      onOpenChange={open => !open && props.onClose()}
    >
      <DialogContent size="sm">
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle>{entry.name}</DialogTitle>
              <DialogDescription>
                {CATEGORY_LABEL[entry.category]}
              </DialogDescription>
              <div>
                <Badge
                  variant={
                    entry.control.kind === 'unavailable' ? 'warning' : 'neutral'
                  }
                  size="sm"
                >
                  {controlLabel(entry)}
                </Badge>
              </div>
            </DialogHeader>
            <TableRosterNoticeLine notice={props.notice} />
            <DialogBody className="space-y-4">
              {entry.statsEditable && entry.liveStats ? (
                <TableMemberStatsForm
                  key={JSON.stringify(entry.liveStats)}
                  stats={entry.liveStats}
                  busy={props.busy}
                  onSave={props.onSave}
                />
              ) : (
                <p className="text-muted text-xs">
                  {entry.adoptedPc
                    ? 'Adopted PC stats are read-only in this scene.'
                    : 'Player character stats come from the player’s sheet and are read-only here.'}
                </p>
              )}
              <TableMemberControls
                entry={entry}
                players={props.players}
                ambiguousTokenIds={props.ambiguousTokenIds}
                unmatchedTokenIds={props.unmatchedTokenIds}
                liveIds={props.liveIds}
                busy={props.busy}
                actions={props.actions}
              />
            </DialogBody>
            <DialogFooter>
              <Button
                variant="danger"
                size="sm"
                disabled={props.busy}
                onClick={props.onRemove}
              >
                Remove from scene
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={props.busy}
                onClick={props.onPlace}
              >
                {entry.boundTokenIds.some(id => props.liveIds.has(id))
                  ? 'Select on map'
                  : 'Place on map'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
