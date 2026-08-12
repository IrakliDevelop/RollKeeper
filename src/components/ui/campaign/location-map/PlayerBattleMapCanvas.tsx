'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Hand,
  MousePointer2,
  CircleUserRound,
  Pencil,
  MoveUpRight,
  Ruler,
  Circle,
  Trash2,
  Eye,
  Minus,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { cn } from '@/utils/cn';
import type { TokenInfoMode } from '@/components/ui/campaign/token-overlay';
import {
  FieldNotesCanvas,
  ViewportContext,
  useActiveTool,
} from '@fieldnotes/react';
import {
  SelectTool,
  ArrowTool,
  PencilTool,
  MeasureTool,
  type ElementActivationEvent,
  type Tool,
  type Viewport,
} from '@fieldnotes/core';
import { BattleMapMinimap } from './BattleMapMinimap';
import { BattleMapExportControl } from './BattleMapExportControl';
import { PlayerHandTool } from './PlayerHandTool';
import {
  createManagedBattleMapConnection,
  type BattleMapConnectionStatus,
} from '@/lib/battlemapSync';
import DmLocationToolOptions from './DmLocationToolOptions';
import { useMarkerRegistration } from './useMarkerRegistration';
import { useCloseMarkerPanelOnRemove } from './useCloseMarkerPanelOnRemove';
import { resolveMarkerPanelState } from './MarkerDetailPanel/MarkerDetailPanel.utils';
import MarkerDetailPanel from './MarkerDetailPanel';
import type { PublicMarkerDetail } from '@/types/battlemap';
import { ensurePlayerLayer, playerLayerId } from './playerLayer';
import {
  ensureCanonicalLayers,
  subscribePinCanonicalLayers,
} from './layerContract';
import { makeApplyRemoteLayer, publishOwnedLayers } from './layerSync';
import { attachRemoteLaserTrails } from './laserSync';
import { attachRemotePings } from './pingSync';
import { attachRemoteMeasurements } from './measureSync';
import { attachFocusReceiver } from './focusSync';
import {
  PlayerTokenTool,
  PlayerTemplateTool,
  tokenColorForId,
  tokenAvatarUrl,
  buildCircularTokenUrl,
} from './PlayerTokenTool';
import { useOwnTokenBackfill } from './useOwnTokenBackfill';
import { useOwnTokenPresent } from './useOwnTokenPresent';
import {
  SpellTemplateTool,
  type SpellTemplateConfig,
} from '@/components/ui/campaign/player-vtt/SpellTemplateTool';

interface PlayerBattleMapCanvasProps {
  campaignCode: string;
  battleMapId: string;
  characterId: string;
  /** Unused internally today — reserved for a future map-name/self pill. */
  characterName?: string;
  characterAvatar?: string;
  /** Chrome rendered INSIDE the ViewportContext.Provider (may use useActiveTool). */
  children?: React.ReactNode;
  /** Connection status surfaced upward (Live chip stays internal too). */
  onStatus?: (status: BattleMapConnectionStatus) => void;
  /** Relay poke passthrough (wire to useSharedCampaignState().refetchNow). */
  onPoke?: (feature: string) => void;
  /** Mutable config consumed by the registered SpellTemplateTool. */
  spellTemplateConfigRef?: React.MutableRefObject<SpellTemplateConfig | null>;
  /** Hide the built-in back-button (the VTT screen renders its own top-left chrome). */
  hideBackButton?: boolean;
  /** Show/hide/compact toggle for the token decoration overlay (optional — non-VTT routes render no toggle). */
  tokenInfoToggle?: { mode: TokenInfoMode | null; onCycle: () => void };
  /** Surfaces export-control failures; the host owns the toast container. */
  onExportError: (message: string) => void;
  /**
   * Public marker details available to resolve a tapped pin's panel state.
   * No caller supplies this yet, and that is correct: `SyncedBattleMap.markers`
   * is declared but has no live producer (owner decision recorded in task B8)
   * — battle maps sync live over the relay rather than through the snapshot
   * payload. So today every shared marker a player taps resolves to the
   * `unpublished` state, which is exactly spec §6.6's behaviour: until a
   * detail arrives, a player tapping a shared marker sees its live `label`
   * and kind with a distinct "details not shared yet" state, because the
   * label rides the element itself. Defaults to `[]` so the panel still
   * resolves correctly with no producer wired.
   */
  markers?: PublicMarkerDetail[];
}

const PLAYER_TOOLS: {
  name: string;
  label: string;
  Icon: typeof Hand;
}[] = [
  { name: 'hand', label: 'Pan', Icon: Hand },
  { name: 'select', label: 'Select', Icon: MousePointer2 },
  { name: 'token', label: 'Place token', Icon: CircleUserRound },
  { name: 'pencil', label: 'Draw', Icon: Pencil },
  { name: 'arrow', label: 'Arrow', Icon: MoveUpRight },
  { name: 'measure', label: 'Measure', Icon: Ruler },
  { name: 'template', label: 'Spell template', Icon: Circle },
];

const TOKEN_INFO_ICON: Record<TokenInfoMode, typeof Eye> = {
  full: Eye,
  compact: Minus,
  off: EyeOff,
};

const TOKEN_INFO_LABEL: Record<TokenInfoMode, string> = {
  full: 'Token info: full',
  compact: 'Token info: compact',
  off: 'Token info: hidden',
};

/**
 * This receive site's role for `attachFocusReceiver`. Pulled out to a named,
 * directly-assertable constant — swapping this literal with the display
 * page's `DISPLAY_FOCUS_OPTIONS` would otherwise pass type-check, lint, and
 * every test while making a DM's "send to the TV" move every player's
 * camera instead. See PlayerBattleMapCanvas.focusOptions.test.ts.
 */
export const PLAYER_FOCUS_OPTIONS = {
  role: 'player',
  color: '#F4C430',
} as const;

export function PlayerToolbar({
  status,
  hasSelection,
  onDeleteSelected,
  tokenInfoToggle,
  characterId,
  exportControl,
}: {
  status: BattleMapConnectionStatus;
  hasSelection: boolean;
  onDeleteSelected: () => void;
  tokenInfoToggle?: { mode: TokenInfoMode | null; onCycle: () => void };
  characterId: string;
  exportControl?: React.ReactNode;
}) {
  const [activeTool, setTool] = useActiveTool();
  const TokenInfoIcon = tokenInfoToggle
    ? TOKEN_INFO_ICON[tokenInfoToggle.mode ?? 'compact']
    : null;
  const hasOwnToken = useOwnTokenPresent(characterId);
  useOwnTokenBackfill(characterId);
  const needsTokenHint =
    status === 'live' && !hasOwnToken && activeTool !== 'token';
  return (
    <div
      data-testid="player-toolbar"
      className="bg-surface-raised border-divider absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-xl border p-1 shadow-lg"
    >
      <div className="flex items-center gap-1">
        {PLAYER_TOOLS.map(({ name, label, Icon }) => {
          const isTokenHint = name === 'token' && needsTokenHint;
          return (
            <Button
              key={name}
              variant={activeTool === name ? 'primary' : 'ghost'}
              onClick={() => setTool(name)}
              className={cn(
                'min-h-[44px] min-w-[44px] p-0',
                isTokenHint &&
                  'bg-accent-emerald-bg text-accent-emerald-text animate-pulse'
              )}
              title={isTokenHint ? 'Place your token on the map' : label}
              aria-label={isTokenHint ? 'Place your token on the map' : label}
            >
              <Icon size={16} />
            </Button>
          );
        })}
      </div>
      {(hasSelection ||
        (tokenInfoToggle && TokenInfoIcon) ||
        exportControl) && (
        <div className="flex items-center gap-1">
          {hasSelection && (
            <Button
              variant="danger"
              onClick={onDeleteSelected}
              className="min-h-[44px] min-w-[44px] p-0"
              title="Delete selected"
              aria-label="Delete selected"
            >
              <Trash2 size={16} />
            </Button>
          )}
          {tokenInfoToggle && TokenInfoIcon && (
            <Button
              variant="ghost"
              onClick={tokenInfoToggle.onCycle}
              className="min-h-[44px] min-w-[44px] p-0"
              title={TOKEN_INFO_LABEL[tokenInfoToggle.mode ?? 'compact']}
              aria-label={TOKEN_INFO_LABEL[tokenInfoToggle.mode ?? 'compact']}
            >
              <TokenInfoIcon size={16} />
            </Button>
          )}
          {exportControl}
        </div>
      )}
      <span
        className={`rounded-full px-2 py-0.5 text-xs ${
          status === 'live'
            ? 'bg-accent-emerald-bg text-accent-emerald-text'
            : status === 'denied'
              ? 'bg-accent-red-bg text-accent-red-text'
              : 'bg-accent-amber-bg text-accent-amber-text'
        }`}
      >
        {status === 'live'
          ? 'Live'
          : status === 'denied'
            ? 'Access denied'
            : 'Connecting…'}
      </span>
    </div>
  );
}

export function PlayerBattleMapCanvas({
  campaignCode,
  battleMapId,
  characterId,
  characterAvatar,
  children,
  onStatus: onStatusProp,
  onPoke,
  spellTemplateConfigRef,
  hideBackButton = false,
  tokenInfoToggle,
  onExportError,
  markers = [],
}: PlayerBattleMapCanvasProps) {
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [status, setStatus] = useState<BattleMapConnectionStatus>('connecting');
  const [hasSelection, setHasSelection] = useState(false);
  const [activeMarkerElementId, setActiveMarkerElementId] = useState<
    string | null
  >(null);
  const connectionRef = useRef<{ stop: () => void } | null>(null);
  const laserCleanupRef = useRef<(() => void) | null>(null);
  // The connection is created once inside the fire-once `handleReady`
  // callback; a plain closure over `onPoke` would go stale if the prop's
  // identity changes later after the connection is already established.
  // Read the latest value via a ref instead.
  const onPokeRef = useRef(onPoke);
  onPokeRef.current = onPoke;
  // Read by the (single, canvas-retained) token tool at placement time;
  // starts as the square avatar and upgrades to the circular render async.
  const tokenSrcRef = useRef<string | null>(tokenAvatarUrl(characterAvatar));
  // Read at placement time by the (single, canvas-retained) token tool.
  const characterIdRef = useRef<string | null>(characterId);
  characterIdRef.current = characterId;

  useEffect(() => {
    const avatar = tokenAvatarUrl(characterAvatar);
    tokenSrcRef.current = avatar;
    if (!avatar) return;
    let cancelled = false;
    void buildCircularTokenUrl(
      avatar,
      tokenColorForId(characterId),
      characterId
    ).then(url => {
      if (!cancelled && url) tokenSrcRef.current = url;
    });
    return () => {
      cancelled = true;
    };
  }, [characterAvatar, characterId]);

  const tools = useMemo<Tool[]>(() => {
    const color = tokenColorForId(characterId);
    // Shared instance: PlayerHandTool hands a press on a movable element off
    // to this select tool so the same gesture drags it.
    const selectTool = new SelectTool();
    return [
      new PlayerHandTool(selectTool),
      selectTool,
      new PlayerTokenTool(color, tokenSrcRef, characterIdRef),
      new PencilTool({ color, width: 3 }),
      new ArrowTool({ color, width: 2 }),
      new MeasureTool({ feetPerCell: 5 }),
      new PlayerTemplateTool({
        templateShape: 'circle',
        feetPerCell: 5,
        fillColor: `${color}80`,
        strokeColor: color,
        strokeWidth: 2,
        renderStyle: 'geometric',
      }),
      ...(spellTemplateConfigRef
        ? [new SpellTemplateTool(spellTemplateConfigRef)]
        : []),
    ];
  }, [characterId, spellTemplateConfigRef]);

  const handleMarkerActivate = useCallback((event: ElementActivationEvent) => {
    setActiveMarkerElementId(event.element.id);
  }, []);

  // OUTSIDE the `if (relayUrl)` guard in `handleReady`, and NOT part of
  // `laserCleanupRef` or any other connection-scoped cleanup: painter
  // registration and single-tap activation are connection-independent (spec
  // §7.2) — players can open a marker's read-only panel with no relay URL
  // configured.
  useMarkerRegistration({
    viewport,
    gesture: 'single',
    onActivateMarker: handleMarkerActivate,
  });

  const activeMarkerElement =
    activeMarkerElementId !== null
      ? (viewport?.store.getById(activeMarkerElementId) ?? null)
      : null;
  // `resolveMarkerPanelState`'s `markers` parameter is typed
  // `readonly MarkerDetail[]` (MarkerDetailPanel.utils.ts), which — unlike
  // `PublicMarkerDetail` — requires a `dmNotes` field. The player surface must
  // never originate or carry a `dmNotes` value (spec §6.4), so this
  // synthesizes an empty placeholder purely to satisfy the shared resolver's
  // type signature. What makes that safe is STRUCTURAL, not this empty string:
  // `ReadOnlyView` (MarkerDetailPanel's player-mode branch) takes a
  // `{ title, body }` prop type, so no `dmNotes` value — placeholder or real —
  // is ever passed into it or reachable from inside it. Seeding a real secret
  // here would therefore change nothing on screen; the guarantee is the prop
  // type, not the value.
  //
  // An EXPLICIT field pick, never `{ ...marker, dmNotes: '' }`: a stray
  // `deletedAt` riding in on the spread would silently downgrade a `ready`
  // panel to `unpublished`, and this is the last place on the branch where a
  // marker-shaped value is built from another object.
  const markerPanelState = resolveMarkerPanelState(
    activeMarkerElement,
    markers.map(m => ({
      id: m.id,
      title: m.title,
      body: m.body,
      dmNotes: '',
      status: m.status,
    })),
    'player'
  );
  const handleCloseMarkerPanel = useCallback(() => {
    setActiveMarkerElementId(null);
  }, []);

  // `activeMarkerElement` above is a bare render-time `getById` with no store
  // subscription. When the DM hides a marker the relay sends the player a
  // REMOVE, and without this the open panel would keep showing the pin's
  // label and body until some unrelated re-render.
  useCloseMarkerPanelOnRemove(
    viewport,
    activeMarkerElementId,
    handleCloseMarkerPanel
  );

  const handleReady = (vp: Viewport) => {
    setViewport(vp);

    // Canonical bands: map (locked) at the bottom, DM annotations (locked
    // for players) above it, this player's own layer in the player band on
    // top — see layerContract.ts. ensurePlayerLayer runs AFTER ensure so the
    // player's own layer ends up active.
    ensureCanonicalLayers(vp, 'player');
    ensurePlayerLayer(vp, characterId);
    // Players never edit the DM annotations layer — keep it pinned locked so
    // their hit-testing and marquee skip DM content (the relay rejects their
    // writes to it anyway).
    subscribePinCanonicalLayers(vp, () => ({ annotationsLocked: true }));

    // Selection state for the touch-friendly delete button.
    const selectTool = vp.toolManager.getTool<SelectTool>('select');
    if (selectTool) {
      selectTool.onSelectionChange(() => {
        setHasSelection(selectTool.selectedIds.length > 0);
      });
    }
    vp.toolManager.onChange(() => {
      const active = vp.toolManager.activeTool?.name === 'select';
      setHasSelection(
        active ? (selectTool?.selectedIds.length ?? 0) > 0 : false
      );
    });

    const relayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
    if (!relayUrl) return;
    connectionRef.current?.stop();
    const ownLayerId = playerLayerId(characterId);
    const connection = createManagedBattleMapConnection({
      relayUrl,
      campaignCode,
      battleMapId,
      store: vp.store,
      clientId: characterId,
      tokenRequest: { role: 'player', battleMapId, playerId: characterId },
      // Layer definitions sync (replaces the unknown-layer mirror): remote
      // layers apply locked for players — hit-test and marquee skip content
      // they cannot edit (the relay rejects their writes to it anyway) —
      // while their own layer is never locked or removed by remote records.
      layers: {
        applyLayer: makeApplyRemoteLayer(vp, 'player', {
          ownLayerId,
          onApplied: () => vp.requestRender(),
        }),
      },
      onStatus: s => {
        setStatus(s);
        onStatusProp?.(s);
        if (s === 'live') requestAnimationFrame(() => vp.fitToContent(60));
      },
      onPoke: feature => onPokeRef.current?.(feature),
    });
    connectionRef.current = connection;
    // Teach the room this player's own layer (the relay only accepts a
    // player's writes to player-<characterId>).
    publishOwnedLayers(
      vp,
      'player',
      def => connection.publishLayerUpsert(def),
      ownLayerId
    );
    // Render remote laser trails + map pings (DM pointer). Players do not
    // broadcast — product policy today; the wiring is role-based so enabling
    // them later is configuration, not code.
    laserCleanupRef.current?.();
    const presenceCleanups = [
      attachRemoteLaserTrails(vp, connection),
      attachRemotePings(vp, connection).dispose,
      attachRemoteMeasurements(vp, connection).dispose,
      attachFocusReceiver(vp, connection, PLAYER_FOCUS_OPTIONS).dispose,
    ];
    laserCleanupRef.current = () => {
      for (const cleanup of presenceCleanups) cleanup();
    };
  };

  const handleDeleteSelected = useCallback(() => {
    const vp = viewport;
    if (!vp) return;
    const selectTool = vp.toolManager.getTool<SelectTool>('select');
    if (!selectTool) return;
    const ids = selectTool.selectedIds.filter(id => vp.store.getById(id));
    if (ids.length === 0) return;
    vp.removeElements(ids);
    selectTool.setSelection([]);
  }, [viewport]);

  useEffect(
    () => () => {
      laserCleanupRef.current?.();
      connectionRef.current?.stop();
    },
    []
  );

  return (
    <ViewportContext.Provider value={viewport}>
      <div className="bg-surface fixed inset-0">
        <FieldNotesCanvas
          tools={tools}
          defaultTool="hand"
          onReady={handleReady}
          className="h-full w-full"
          snapToGrid
        />
        {viewport && (
          <PlayerToolbar
            status={status}
            hasSelection={hasSelection}
            onDeleteSelected={handleDeleteSelected}
            tokenInfoToggle={tokenInfoToggle}
            characterId={characterId}
            exportControl={
              <BattleMapExportControl
                getViewport={() => viewport}
                name="battle-map"
                onError={onExportError}
              />
            }
          />
        )}
        {viewport && (
          <div className="border-divider absolute top-16 left-1/2 z-10 max-w-[92vw] -translate-x-1/2 overflow-hidden rounded-xl border shadow-lg">
            <DmLocationToolOptions mode="battlemap" />
          </div>
        )}
        {!hideBackButton && (
          <div className="absolute top-3 left-3 z-10">
            <Link href={`/player/characters/${characterId}`}>
              <Button
                variant="ghost"
                className="flex items-center gap-1.5 text-xs"
              >
                <ArrowLeft size={14} />
                Back to sheet
              </Button>
            </Link>
          </div>
        )}
        {viewport && <BattleMapMinimap defaultCollapsed />}
        {/* Mounted only while a marker is active. Painting and activation
            are connection-independent, so this panel opens with no relay
            URL configured — see `useMarkerRegistration` above. Read-only:
            no `onSave`, no `onDelete` — the player surface asks for
            mode="player", which MarkerDetailPanel enforces structurally. */}
        {activeMarkerElementId !== null && (
          <MarkerDetailPanel
            open
            mode="player"
            state={markerPanelState}
            onClose={handleCloseMarkerPanel}
          />
        )}
        {viewport && children}
      </div>
    </ViewportContext.Provider>
  );
}
