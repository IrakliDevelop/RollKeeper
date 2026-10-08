'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Viewport } from '@fieldnotes/core';

import { DmBattleMapCanvas } from '@/components/ui/campaign/dm-vtt/DmBattleMapCanvas';
import type { DmTokenConfig } from '@/components/ui/campaign/dm-vtt/combatantToken';
import { PlacementBanner } from '@/components/ui/campaign/dm-vtt/PlacementBanner';
import {
  TokenPlacementController,
  type PendingTokenPlacement,
} from '@/components/ui/campaign/dm-vtt/TokenPlacementController';
import type { BattleMapConnection } from '@/lib/battlemapSync';
import type { TableRepository } from '@/lib/table/repository';
import type { TableSceneAdapter } from '@/lib/table/sceneAdapter';

import { createTableRosterCanvas } from '../tableRosterCanvas';
import { TableRosterPanel } from '../TableRosterPanel';

const TOKEN_INFO = { mode: null, onCycle: () => {} };

/**
 * Scene-level part of the workspace (W4), keyed by `${sceneId}:${epoch}`:
 * the one canvas writer (`DmBattleMapCanvas` + the scene adapter), token
 * placement and the scene roster. Everything here is created and torn down
 * with the scene; workspace-level state lives in `TableWorkspace`.
 */
export function TableSceneStage(props: {
  campaignCode: string;
  dmId: string;
  sceneId: string;
  repository: TableRepository;
  adapter: TableSceneAdapter;
  header: ReactNode;
  relayLive: boolean;
  connection: BattleMapConnection | null;
  onViewportReady: (sceneId: string, viewport: Viewport) => void;
  onConnectionReady: (connection: BattleMapConnection | null) => void;
  onStatus: (sceneId: string, status: string) => void;
  onExportError: (message: string) => void;
  /** Extra scene-level chrome inside the canvas viewport (Phase C tools). */
  children?: ReactNode;
}) {
  const tokenConfigRef = useRef<DmTokenConfig | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [pendingPlacement, setPendingPlacement] =
    useState<PendingTokenPlacement | null>(null);
  const cancelPlacement = useCallback(() => setPendingPlacement(null), []);
  const { onViewportReady, onStatus, sceneId } = props;
  const handleViewportReady = useCallback(
    (next: Viewport) => {
      setViewport(next);
      onViewportReady(sceneId, next);
    },
    [onViewportReady, sceneId]
  );
  const handleStatus = useCallback(
    (status: string) => onStatus(sceneId, status),
    [onStatus, sceneId]
  );
  // Roster canvas operations follow committed roster commands and travel the
  // v1 room as ordinary DM edits (placement, control conversion, bands).
  const rosterCanvas = useMemo(
    () =>
      viewport
        ? createTableRosterCanvas({
            viewport,
            connection: props.connection,
            onArm: setPendingPlacement,
          })
        : null,
    [viewport, props.connection]
  );

  return (
    <DmBattleMapCanvas
      campaignCode={props.campaignCode}
      battleMapId={props.sceneId}
      dmId={props.dmId}
      tableSceneAdapter={props.adapter}
      onConnectionReady={props.onConnectionReady}
      onStatus={handleStatus}
      tokenConfigRef={tokenConfigRef}
      onViewportReady={handleViewportReady}
      tokenInfoToggle={TOKEN_INFO}
      onExportError={props.onExportError}
      sessionControls={props.header}
    >
      <TokenPlacementController
        pending={pendingPlacement}
        configRef={tokenConfigRef}
        onCancel={cancelPlacement}
      />
      {pendingPlacement && (
        <PlacementBanner
          entityName={pendingPlacement.entityName}
          onCancel={cancelPlacement}
        />
      )}
      <TableRosterPanel
        repository={props.repository}
        sceneId={props.sceneId}
        campaignCode={props.campaignCode}
        dmId={props.dmId}
        canvas={rosterCanvas}
        live={props.relayLive}
      />
      {props.children}
    </DmBattleMapCanvas>
  );
}
