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
  Footprints,
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
  type PathTool,
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
import { configureFogView, resolveFogRendererOptions } from './fog';
import { parseFogAppearance } from './fog/fogAppearance';
import {
  fetchAndApplyFogAppearance,
  startFogAppearancePoll,
} from './fog/fogAppearancePoll';
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
import { createMovementPathTool } from './movementTool';
import { applyMovementCommit } from './movementCommit';
import { attachPathBroadcast, attachRemotePaths } from './pathSync';
import { characterWalkingSpeed } from './movementSpeed';
import { useCharacterStore } from '@/store/characterStore';
import { attachAwarenessSync } from './awarenessSync';
import type { AwarenessSyncHandle } from './awarenessSync';
import { attachConnectionScope } from './connectionScope';

import type { MovementResolution } from './movementTool';

interface PlayerBattleMapCanvasProps {
  campaignCode: string;
  battleMapId: string;
  characterId: string;
  /**
   * Fallback display name for this client's own awareness identity, used
   * only while `character.playerName` (the character-store field) is
   * empty — see the identity effect in the component body.
   */
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

const EMPTY_PUBLIC_MARKERS: PublicMarkerDetail[] = [];

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
  { name: 'path', label: 'Move', Icon: Footprints },
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
  characterName,
  characterAvatar,
  children,
  onStatus: onStatusProp,
  onPoke,
  spellTemplateConfigRef,
  hideBackButton = false,
  tokenInfoToggle,
  onExportError,
  markers: suppliedMarkers = EMPTY_PUBLIC_MARKERS,
}: PlayerBattleMapCanvasProps) {
  const [publishedMarkers, setPublishedMarkers] =
    useState<PublicMarkerDetail[]>(suppliedMarkers);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [status, setStatus] = useState<BattleMapConnectionStatus>('connecting');
  const [hasSelection, setHasSelection] = useState(false);
  const [activeMarkerElementId, setActiveMarkerElementId] = useState<
    string | null
  >(null);
  const connectionRef = useRef<{ stop: () => void } | null>(null);
  const laserCleanupRef = useRef<(() => void) | null>(null);
  // `viewport` is state, so a plain closure over it would be null inside a
  // tool built on the first render (mirrors DmBattleMapCanvas.hooks.ts).
  const viewportRef = useRef<Viewport | null>(null);
  const movementCommitUnsubRef = useRef<(() => void) | null>(null);
  const [movementDash, setMovementDash] = useState(false);
  const movementDashRef = useRef(false);
  const handleSetMovementDash = useCallback((enabled: boolean) => {
    movementDashRef.current = enabled;
    setMovementDash(enabled);
  }, []);
  // Own-character speed source (spec decision 3): character.speed + buffs,
  // fallback 30 ft when no character is loaded. Read live per path. Gated on
  // IDENTITY, not mere presence: `character` from `useCharacterStore` is
  // never null once a character has ever loaded, so during a roster switch
  // it can briefly still hold the PREVIOUS character's name/speed while
  // `characterId` (this route's prop) has already moved on — resolving to
  // null (→ the tool's own 30 ft default) until the store catches up avoids
  // stamping a path with the wrong character's name/speed.
  const ownMovementRef = useRef<MovementResolution | null>(null);
  const character = useCharacterStore(s => s.character);
  useEffect(() => {
    ownMovementRef.current =
      character && character.id === characterId
        ? { name: character.name, walkFeet: characterWalkingSpeed(character) }
        : null;
  }, [character, characterId]);
  // Awareness identity name: same identity gate as `ownMovementRef` above —
  // during a roster switch `character` can briefly still hold the PREVIOUS
  // character until the store catches up, so it only counts when its id
  // matches this route's `characterId`. Falls back to the `characterName`
  // prop when the character store has no `playerName` yet.
  const awarenessNameRef = useRef<string>(characterName ?? '');
  const awarenessRef = useRef<AwarenessSyncHandle | null>(null);
  useEffect(() => {
    const own = character && character.id === characterId ? character : null;
    const name = (own?.playerName || characterName || '').trim();
    awarenessNameRef.current = name;
    awarenessRef.current?.setIdentity({
      id: characterId,
      name,
      role: 'player',
    });
  }, [character, characterId, characterName]);
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

  const refreshMarkers = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/campaign/${campaignCode}/battlemaps/${battleMapId}/markers`
      );
      if (!response.ok) return;
      const data = (await response.json()) as {
        markers?: PublicMarkerDetail[];
      };
      setPublishedMarkers(data.markers ?? []);
    } catch (error) {
      // Marker details are a best-effort companion to the live canvas relay.
      // Keep the last projection when the endpoint is unavailable; activation
      // can retry, and a marker poke will refresh connected clients later.
      console.warn('Failed to refresh marker details:', error);
    }
  }, [battleMapId, campaignCode]);

  useEffect(() => {
    setPublishedMarkers(suppliedMarkers);
    void refreshMarkers();
  }, [refreshMarkers, suppliedMarkers]);

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
      createMovementPathTool({
        getViewport: () => viewportRef.current,
        role: 'player',
        // `characterIdRef.current`, not the bare `characterId` closed over
        // here: this file's convention (see `characterIdRef` above) is to
        // read identity through the ref, not a construction-time capture.
        // `MovementToolConfig.characterId` is a plain string, not a live
        // getter, so this still freezes at whatever the ref holds THIS
        // render — a full fix (characterId tracking a route change with no
        // remount) needs an SDK-type change (a function instead of a
        // string) and is out of scope here; `movableTokenMatch` reads it
        // once per tool construction either way.
        characterId: characterIdRef.current ?? undefined,
        resolveMovement: () => ownMovementRef.current,
        isDashActive: () => movementDashRef.current,
      }),
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

  const handleMarkerActivate = useCallback(
    (event: ElementActivationEvent) => {
      setActiveMarkerElementId(event.element.id);
      void refreshMarkers();
    },
    [refreshMarkers]
  );

  // OUTSIDE the `if (relayUrl)` guard in `handleReady`, and NOT part of
  // `laserCleanupRef` or any other connection-scoped cleanup: painter
  // registration and single-tap activation are connection-independent (spec
  // §7.2) — players can open a marker's read-only panel with no relay URL
  // configured.
  useMarkerRegistration({
    viewport,
    gesture: 'single',
    markerDetails: publishedMarkers,
    onActivateMarker: handleMarkerActivate,
  });

  const activeMarkerElement =
    activeMarkerElementId !== null
      ? (viewport?.store.getById(activeMarkerElementId) ?? null)
      : null;
  const markerPanelState = resolveMarkerPanelState(
    activeMarkerElement,
    publishedMarkers,
    'player'
  );
  const handleCloseMarkerPanel = useCallback(() => {
    setActiveMarkerElementId(null);
  }, []);

  const handleClaimLoot = useCallback(
    async (entryId: string) => {
      if (markerPanelState.kind !== 'ready')
        throw new Error('This loot container is no longer available.');
      const response = await fetch(
        `/api/campaign/${campaignCode}/battlemaps/${battleMapId}/markers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-rollkeeper-csrf': '1',
          },
          body: JSON.stringify({
            playerId: characterId,
            markerId: markerPanelState.detail.id,
            entryId,
            requestId: crypto.randomUUID(),
          }),
        }
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        markers?: PublicMarkerDetail[];
      };
      if (!response.ok) {
        throw new Error(
          data.error === 'depleted'
            ? 'Someone else claimed the last one.'
            : 'Could not claim that item.'
        );
      }
      setPublishedMarkers(data.markers ?? []);
    },
    [battleMapId, campaignCode, characterId, markerPanelState]
  );

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
    viewportRef.current = vp;

    configureFogView(vp.fog, 'player', false);

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

    // Movement commit: connection-independent — moving a token needs no
    // relay connection at all, so this runs unconditionally, before the
    // relay-gated block below.
    movementCommitUnsubRef.current?.();
    const movementTool = vp.toolManager.getTool<PathTool>('path');
    if (movementTool) {
      movementCommitUnsubRef.current = movementTool.onCommit(emission => {
        applyMovementCommit(emission, {
          viewport: vp,
          role: 'player',
          // Built fresh inside this per-commit callback, reading the LIVE
          // ref rather than closing over `handleReady`'s `characterId` —
          // `handleReady` itself only runs once (passed as `onReady`), so a
          // bare `characterId` here would freeze at mount-time forever.
          characterId: characterIdRef.current ?? undefined,
          resolveMovement: () => ownMovementRef.current,
          // No combat log on the player surface this cycle (locked decision 2).
        });
      });
    }

    const relayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
    if (!relayUrl) return;
    // Re-attach: tear down the OLD connection-scoped handles BEFORE stopping
    // the old connection, so their final frames (awareness `cleared`, etc.)
    // ride the still-live socket — the same order the unmount effect uses.
    laserCleanupRef.current?.();
    laserCleanupRef.current = null;
    connectionRef.current?.stop();
    connectionRef.current = null;
    const ownLayerId = playerLayerId(characterId);
    const connection = createManagedBattleMapConnection({
      relayUrl,
      campaignCode,
      battleMapId,
      store: vp.store,
      clientId: characterId,
      tokenRequest: { role: 'player', battleMapId, playerId: characterId },
      fog: { manager: vp.fog },
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
        if (s === 'live') {
          requestAnimationFrame(() => vp.fitToContent(60));
          // Managed sendPresence drops while not live, so the attach-time
          // frame may be lost; announce on every live transition (first
          // connect AND reconnect) — the heartbeat self-heals otherwise.
          awarenessRef.current?.announce();
        }
      },
      onTokenMetadata: meta => {
        const appearance = parseFogAppearance(meta.fogAppearance);
        vp.setFogStyle(resolveFogRendererOptions(appearance));
      },
      onPoke: feature => {
        if (feature === 'markers') void refreshMarkers();
        if (feature === 'fog-appearance') {
          fetchAndApplyFogAppearance(
            vp,
            `/api/campaign/${campaignCode}/battlemaps/${battleMapId}/fog-appearance?role=player&playerId=${encodeURIComponent(characterId)}`
          );
        }
        onPokeRef.current?.(feature);
      },
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
    //
    // The whole attach sequence runs inside a connection scope: if any
    // helper below throws, everything already created is unwound (in push
    // order) and the NEW connection is stopped before the error surfaces —
    // no half-attached handles, no orphaned socket. On success the returned
    // composite cleanup is what laserCleanupRef carries forward (unmount and
    // re-attach both call it before connection.stop()).
    try {
      laserCleanupRef.current = attachConnectionScope(connection, scope => {
        scope.push(attachRemoteLaserTrails(vp, connection));
        scope.push(attachRemotePings(vp, connection).dispose);
        scope.push(attachRemoteMeasurements(vp, connection).dispose);
        scope.push(
          attachFocusReceiver(vp, connection, PLAYER_FOCUS_OPTIONS).dispose
        );
        scope.push(attachRemotePaths(vp, connection).dispose);
        // Player self-paths always broadcast (spec decision 5) — no sharing
        // toggle on this surface.
        if (movementTool) {
          scope.push(
            attachPathBroadcast(movementTool, connection, {
              role: 'player',
              // Players hold no dmOnlyElements state; DM-only elements never
              // reach them (relay canRead), so an own-token anchor cannot be
              // DM-only from this client's view.
              isDmOnlyElement: () => false,
              getElement: id => vp.store.getById(id) ?? null,
            }).dispose
          );
        }

        // Shared presence: players publish their cursor always (path
        // precedent — quiet-by-default is the DM's viewer switch), no
        // colour on the wire, never selection/tool; they draw the DM's
        // cursor only (awarenessSync CURSOR_RULES.player). No share or
        // viewer control on this surface. Pushed last so the `cleared`
        // frame rides the live socket before connection.stop().
        const awareness = attachAwarenessSync(vp, connection, {
          identity: {
            id: characterId,
            name: awarenessNameRef.current,
            role: 'player',
          },
          shareCursor: true,
          showPlayerCursors: true,
        });
        awarenessRef.current = awareness;
        scope.push(() => {
          awarenessRef.current = null;
          awareness.dispose();
        });

        scope.push(
          startFogAppearancePoll({
            viewport: vp,
            url: `/api/campaign/${campaignCode}/battlemaps/${battleMapId}/fog-appearance?role=player&playerId=${encodeURIComponent(characterId)}`,
          })
        );
      });
    } catch (error) {
      // attachConnectionScope already disposed every helper it saw and
      // stopped `connection`; drop the dead reference so unmount and the
      // next re-attach do not stop it twice, then surface the error.
      connectionRef.current = null;
      throw error;
    }
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
      movementCommitUnsubRef.current?.();
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
          options={{ fog: {} }}
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
                getFogState={() => viewport.fog.getState()}
                onError={onExportError}
              />
            }
          />
        )}
        {viewport && (
          <div className="border-divider absolute top-16 left-1/2 z-10 max-w-[92vw] -translate-x-1/2 overflow-hidden rounded-xl border shadow-lg">
            <DmLocationToolOptions
              mode="battlemap"
              movementControls={{
                dash: {
                  enabled: movementDash,
                  onChange: handleSetMovementDash,
                },
              }}
            />
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
            onClaimLoot={handleClaimLoot}
          />
        )}
        {viewport && children}
      </div>
    </ViewportContext.Provider>
  );
}
