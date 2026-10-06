'use client';

import { useMemo, useState } from 'react';

import { RosterTray } from '@/components/ui/campaign/dm-vtt/RosterTray';
import { Button } from '@/components/ui/forms/button';
import type { TableRepository } from '@/lib/table/repository';

import { TableAddMemberDialog } from './TableAddMemberDialog';
import { TableMemberDialog } from './TableMemberDialog';
import { TableRosterNoticeLine } from './TableRosterNoticeLine';
import { describeEntry, placedIndex, rosterEntities } from './tableRosterModel';
import { useTableRosterActions } from './useTableRosterActions';
import {
  useTableRosterState,
  type TableRosterCanvas,
} from './useTableRosterState';

export type {
  TableRosterCanvas,
  TablePlacementRequest,
} from './useTableRosterState';

const NO_DRAG = () => {};

/**
 * Scene roster for the Table route: party, creatures and manual PCs held by
 * the scene repository (no encounter needed), rendered through the existing
 * roster tray. Placement, control and stats all go through typed commands.
 */
export function TableRosterPanel(props: {
  repository: TableRepository;
  sceneId: string;
  campaignCode: string;
  dmId: string;
  canvas: TableRosterCanvas | null;
  live: boolean;
}) {
  const state = useTableRosterState(props);
  const actions = useTableRosterActions({
    ...props,
    playerList: state.playerList,
    liveIds: state.liveIds,
    canvasElements: state.canvasElements,
  });
  const [collapsed, setCollapsed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const roster = state.roster;
  const entities = useMemo(
    () => (roster ? rosterEntities(roster) : []),
    [roster]
  );
  const index = useMemo(
    () => (roster ? placedIndex(roster, state.liveIds) : new Map()),
    [roster, state.liveIds]
  );
  const byMember = useMemo(
    () =>
      new Map(roster?.entries.map(entry => [entry.sceneMemberId, entry]) ?? []),
    [roster]
  );
  const details = detailsId ? (byMember.get(detailsId) ?? null) : null;
  const ambiguous = roster?.ambiguousTokenIds.length ?? 0;

  const closeAdd = (open: boolean) => {
    setAdding(open);
    if (!open) actions.clearNotice();
  };
  const afterAdd = (result: Promise<{ status: string }>) =>
    void result.then(outcome => {
      if (outcome.status === 'committed' || outcome.status === 'unchanged')
        setAdding(false);
    });

  return (
    <>
      <RosterTray
        entities={entities}
        placedIndex={index}
        armedEntityId={null}
        onArmPlacement={entity => {
          const entry = byMember.get(entity.id);
          if (entry) void actions.place(entry);
        }}
        onSelectEntity={entityId => {
          const entry = byMember.get(entityId);
          if (entry) void actions.place(entry);
        }}
        onDragStart={NO_DRAG}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(value => !value)}
        hasLinkedEncounter
        emptyMessage="Add party members, creatures or manual PCs to this scene."
        headerActions={
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={() => setAdding(true)}
          >
            Add to scene
          </Button>
        }
        describeRow={entity => {
          const entry = byMember.get(entity.id);
          return entry ? describeEntry(entry, state.liveIds) : '';
        }}
        onOpenDetails={entity => setDetailsId(entity.id)}
      />
      {!collapsed && !adding && details === null && (
        <div className="bg-surface-raised border-divider pointer-events-auto fixed bottom-24 left-0 max-w-[clamp(150px,16vw,180px)] rounded-r-xl border px-2 py-1 shadow-lg">
          {ambiguous > 0 && (
            <p className="text-accent-amber-text px-1 text-xs">
              {`${ambiguous} map token${ambiguous === 1 ? '' : 's'} match several members — open a member to bind.`}
            </p>
          )}
          <TableRosterNoticeLine
            notice={state.ensureNotice ?? actions.notice}
          />
        </div>
      )}
      <TableAddMemberDialog
        open={adding}
        onOpenChange={closeAdd}
        campaignCode={props.campaignCode}
        players={state.players.snapshot}
        onRetryPlayers={state.players.refresh}
        notice={actions.notice}
        busy={actions.busy}
        onAddParty={player => afterAdd(actions.addParty(player))}
        onAddParticipant={(kind, stats) =>
          afterAdd(actions.addParticipant(kind, stats))
        }
      />
      <TableMemberDialog
        entry={details}
        onClose={() => {
          setDetailsId(null);
          actions.clearNotice();
        }}
        players={state.players.snapshot}
        ambiguousTokenIds={roster?.ambiguousTokenIds ?? []}
        unmatchedTokenIds={roster?.unmatchedTokenIds ?? []}
        liveIds={state.liveIds}
        notice={actions.notice}
        busy={actions.busy}
        onSave={stats => details && void actions.updateStats(details, stats)}
        onPlace={() => details && void actions.place(details)}
        onRemove={() => {
          if (details) void actions.remove(details);
          setDetailsId(null);
        }}
        actions={{
          onGive: legacyPlayerId =>
            details &&
            void actions.reassign(details, { kind: 'player', legacyPlayerId }),
          onReturn: () =>
            details && void actions.reassign(details, { kind: 'dm' }),
          onRepair: () => details && actions.repair(details),
          onBind: tokenId =>
            details && void actions.bind(details, tokenId, true),
          onUnbind: tokenId =>
            details && void actions.bind(details, tokenId, false),
        }}
      />
    </>
  );
}
