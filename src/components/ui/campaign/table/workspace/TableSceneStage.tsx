'use client';

import {
  useCallback,
  useMemo,
  useReducer,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
import { runSceneCommand } from '@/lib/table/sceneCommands';

import { TableArrivalMarker, TableArrivalPicker } from '../TablePartyArrival';
import { createTableRosterCanvas } from '../tableRosterCanvas';
import { TableRosterPanel } from '../TableRosterPanel';
import type { SaveMessageTone } from './saveMessageTone';
import { useEnsureSceneMapImage } from './sceneMapImage';
import { TableEditMapControl } from './TableEditMapControl';

const TOKEN_INFO = { mode: null, onCycle: () => {} };
const RELAY_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL);

/**
 * Scene-level part of the workspace (W4), keyed by `${sceneId}:${epoch}`:
 * the one canvas writer (`DmBattleMapCanvas` + the scene adapter) with its
 * Edit map tools (W10), the map-image ensure step (R3-F3), token placement,
 * the party arrival picker (W11) and the scene roster. Everything here is
 * created and torn down with the scene.
 */
export function TableSceneStage(props: {
  campaignCode: string;
  dmId: string;
  sceneId: string;
  repository: TableRepository;
  adapter: TableSceneAdapter;
  header: ReactNode;
  relayStatus: string;
  relayLive: boolean;
  /** The scene is the shown, unblanked one (live editing wording). */
  presentedHere: boolean;
  connection: BattleMapConnection | null;
  onViewportReady: (sceneId: string, viewport: Viewport) => void;
  onConnectionReady: (connection: BattleMapConnection | null) => void;
  onStatus: (sceneId: string, status: string) => void;
  onMessage: (message: string, tone?: SaveMessageTone) => void;
  /** Review F9: Edit-map image work in flight. */
  onEditBusy?: (busy: boolean) => void;
  /** PR07 P10: this tab holds live control (token representation sync). */
  liveHolder?: boolean;
  /** PR07 P9: the table reports a verified scale for this shown scene. */
  scaleVerifiedHere?: boolean;
}) {
  const tokenConfigRef = useRef<DmTokenConfig | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [pendingPlacement, setPendingPlacement] =
    useState<PendingTokenPlacement | null>(null);
  const [arming, setArming] = useState(false);
  const cancelPlacement = useCallback(() => setPendingPlacement(null), []);
  const { adapter, onViewportReady, onStatus, onMessage, repository, sceneId } =
    props;
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

  const [, onScene] = useReducer((value: number) => value + 1, 0);
  useEffect(() => adapter.subscribe(onScene), [adapter]);
  const map = adapter.getBattleMap();
  const writes = useMemo(
    () => ({
      isDmOnly: (id: string) =>
        adapter.getBattleMap()?.dmOnlyElements[id] === true,
      setDmOnly: (id: string, dmOnly: boolean) => adapter.setDmOnly(id, dmOnly),
      writeSize: (size: { w: number; h: number }) =>
        adapter.updateBattleMap({ mapImageSize: size }),
      // Review F6: a broken image adds nothing and says so.
      onUnavailable: () => onMessage('Map image could not be loaded'),
    }),
    [adapter, onMessage]
  );
  useEnsureSceneMapImage({
    viewport,
    relayConfigured: RELAY_CONFIGURED,
    relayStatus: props.relayStatus,
    map: map
      ? { mapImageUrl: map.mapImageUrl, mapImageSize: map.mapImageSize }
      : null,
    writes,
  });

  const current = repository.getCurrent();
  const arrivalPoint =
    current?.status === 'ready'
      ? (current.snapshot.scenes.find(scene => scene.sceneId === sceneId)
          ?.arrivalPoint ?? null)
      : null;
  const setArrival = async (point: { x: number; y: number }) => {
    setArming(false);
    const latest = repository.getCurrent();
    const result = await runSceneCommand(repository, {
      expectedRevision:
        latest?.status === 'ready'
          ? (latest.snapshot.campaign?.revision ?? 0)
          : 0,
      operationId: crypto.randomUUID(),
      command: {
        type: 'scene.setArrivalPoint',
        sceneId,
        point: { x: point.x, y: point.y },
        at: new Date().toISOString(),
      },
    });
    onMessage(
      result.status === 'committed' || result.status === 'unchanged'
        ? 'Party arrival point saved on this device.'
        : 'The arrival point was not saved. Nothing changed.'
    );
  };

  return (
    <DmBattleMapCanvas
      campaignCode={props.campaignCode}
      battleMapId={sceneId}
      dmId={props.dmId}
      tableSceneAdapter={adapter}
      onConnectionReady={props.onConnectionReady}
      onStatus={handleStatus}
      tokenConfigRef={tokenConfigRef}
      onViewportReady={handleViewportReady}
      tokenInfoToggle={TOKEN_INFO}
      onExportError={message => onMessage(message, 'failure')}
      sessionControls={props.header}
      editMapControl={
        <TableEditMapControl
          adapter={adapter}
          viewport={viewport}
          presentedHere={props.presentedHere}
          scaleVerifiedHere={props.scaleVerifiedHere}
          onBusyChange={props.onEditBusy}
        />
      }
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
      {viewport && (
        <TableArrivalMarker viewport={viewport} point={arrivalPoint ?? null} />
      )}
      {viewport && arming && (
        <TableArrivalPicker
          viewport={viewport}
          onPick={point => void setArrival(point)}
          onCancel={() => setArming(false)}
        />
      )}
      <TableRosterPanel
        repository={repository}
        sceneId={sceneId}
        campaignCode={props.campaignCode}
        dmId={props.dmId}
        canvas={rosterCanvas}
        live={props.relayLive}
        liveHolder={props.liveHolder}
        arrival={{ arming, onArm: () => setArming(value => !value) }}
      />
    </DmBattleMapCanvas>
  );
}
