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
  type CanvasElement,
  type ElementActivationEvent,
  type Tool,
  type Viewport,
} from '@fieldnotes/core';
import type { PathTool } from '@fieldnotes/vtt';
import { MeasureTool } from '@fieldnotes/vtt';
import { BattleMapMinimap } from './BattleMapMinimap';
import { PlayerMapToolControls } from './PlayerMapToolControls';
import { BattleMapExportControl } from './BattleMapExportControl';
import { PlayerHandTool } from './PlayerHandTool';
import {
  createManagedBattleMapConnection,
  type BattleMapConnectionStatus,
} from '@/lib/battlemapSync';
import { configureFogView, resolvePlayerFogStyle } from './fog';
import {
  applyFogAppearanceMetadata,
  fetchAndApplyFogAppearance,
  getAppliedFogAppearance,
  startFogAppearancePoll,
} from './fog/fogAppearancePoll';
import {
  fogAppearanceReadUrl,
  lootClaimRequest,
  markerDetailsUrl,
} from '@/components/ui/campaign/table/sideChannelRequests';
import DmLocationToolOptions from './DmLocationToolOptions';
import { useMarkerRegistration } from './useMarkerRegistration';
import {
  isCombatantToken,
  useMerchantShopActivation,
} from './useMerchantShopActivation';
import { PlayerShopDialog } from '@/components/ui/campaign/player-shop';
import type { Currency } from '@/types/character';
import { useCloseMarkerPanelOnRemove } from './useCloseMarkerPanelOnRemove';
import { resolveMarkerPanelState } from './MarkerDetailPanel/MarkerDetailPanel.utils';
import MarkerDetailPanel from './MarkerDetailPanel';
import type { PublicMarkerDetail } from '@/types/battlemap';
import {
  canonicalPlayerBand,
  ensurePlayerLayer,
  playerLayerId,
} from './playerLayer';
import { isControlBearingElement } from './tokenIdentity';
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
  PLAYER_TOKEN_KIND,
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
import { useCommittedShopSpend } from '@/hooks/useCommittedShopSpend';
import { attachAwarenessSync } from './awarenessSync';
import type { AwarenessSyncHandle } from './awarenessSync';
import { attachConnectionScope } from './connectionScope';
import { exposeStoreForE2E } from '@/lib/e2eStoreHandles';

import type { MovementResolution } from './movementTool';
import {
  createRollKeeperFogPlugin,
  getViewportFogManager,
  installVttGridController,
} from '@/lib/fieldnotesVtt';

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
  /** `sharedState.transfers` — the pending item-transfer queue, already
   *  scoped to this character server-side. Fed into `useCommittedShopSpend`
   *  alongside the local purchase receipt so the shop dialog's effective
   *  purse survives a VTT reload, not just a dialog close/reopen. */
  pendingTransfers?: { id: string; costCopper?: number }[];
  /** Own-token double-tap → open the character sheet drawer (VTT sheet drawer). */
  onOpenOwnSheet?: () => void;
  /** A party member's token double-tap → open their read-only limited-view
   *  sheet, keyed by that token's `characterId`. */
  onOpenPartySheet?: (characterId: string) => void;
}

const EMPTY_PUBLIC_MARKERS: PublicMarkerDetail[] = [];
const NEVER_ACTIVATABLE = () => false;
const EMPTY_APPLIED_TRANSFER_IDS: string[] = [];

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
      className="bg-surface-raised border-divider pointer-events-auto relative z-10 flex max-w-full min-w-0 items-center gap-3 rounded-xl border p-1 shadow-lg"
    >
      <div className="scrollbar-thin flex min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain">
        {PLAYER_TOOLS.map(({ name, label, Icon }) => {
          const isTokenHint = name === 'token' && needsTokenHint;
          return (
            <Button
              key={name}
              variant={activeTool === name ? 'primary' : 'ghost'}
              onClick={() => setTool(name)}
              className={cn(
                'min-h-[44px] min-w-[44px] shrink-0 p-0',
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
        <div className="flex shrink-0 items-center gap-1">
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
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
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
  pendingTransfers,
  onOpenOwnSheet,
  onOpenPartySheet,
}: PlayerBattleMapCanvasProps) {
  const fogPlugin = useMemo(() => createRollKeeperFogPlugin(), []);
  // R4 (Table v1): this route opens the source map URL; the server resolves
  // the presented scene. PR04 P7: side channels (marker details, loot, shop,
  // fog appearance) are addressed by the RESOLVED scene id — never the
  // source map id — and stay neutral until the token resolves one.
  const tableScoped =
    process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED === 'true';
  const [resolvedSceneId, setResolvedSceneId] = useState<string | null>(null);
  const sideChannelId = tableScoped ? resolvedSceneId : battleMapId;
  const sideChannelsEnabled = sideChannelId !== null;
  const sideChannelIdRef = useRef(sideChannelId);
  sideChannelIdRef.current = sideChannelId;
  // P10: the token 403 body decides the cover — "Scene is unavailable" is
  // neutral; any other credential denial is "Access denied".
  const [tokenDenial, setTokenDenial] = useState<
    'scene-unavailable' | 'credential' | null
  >(null);
  const tokenDenialRef = useRef(tokenDenial);
  tokenDenialRef.current = tokenDenial;
  // A2: the relay closes an audience socket with 4403 on any presentation
  // change and the SDK settles on terminal `denied` (no re-mint). Under
  // Table v1 the surface rebuilds its connection with bounded backoff so the
  // fresh mint rebinds, goes live or shows the neutral cover.
  const [withdrawn, setWithdrawn] = useState(false);
  const reconnectRef = useRef<{
    delay: number;
    timer: ReturnType<typeof setTimeout> | null;
    identityInvalid: boolean;
    lastResolved: string | null;
  }>({ delay: 1_000, timer: null, identityInvalid: false, lastResolved: null });
  // A resolved-scene change rebuilds the whole canvas (store, layers, fog)
  // under a new key; the notice tells the player unsent edits were dropped.
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const [sceneNotice, setSceneNotice] = useState<string | null>(null);
  // Table v1 relay rule 12: players delete only their own self-placed token
  // among control-bearing elements (never a bound or DM-placed one). Legacy
  // rooms keep the existing delete behavior.
  const playerMayDelete = useCallback(
    (element: CanvasElement): boolean => {
      if (!tableScoped || !isControlBearingElement(element)) return true;
      const rec = element as unknown as Record<string, unknown>;
      const absent = (key: string) =>
        rec[key] === undefined || rec[key] === null;
      return (
        rec.tokenKind === PLAYER_TOKEN_KIND &&
        rec.characterId === characterId &&
        rec.layerId === playerLayerId(characterId) &&
        absent('sceneMemberId') &&
        absent('entityId')
      );
    },
    [tableScoped, characterId]
  );
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

  // Read at gesture time via `sheetTokens` below — never captured, so a
  // parent re-render that hands in a new `onOpenOwnSheet` identity never
  // tears down and re-creates the marker registration effect.
  const onOpenOwnSheetRef = useRef(onOpenOwnSheet);
  onOpenOwnSheetRef.current = onOpenOwnSheet;
  const onOpenPartySheetRef = useRef(onOpenPartySheet);
  onOpenPartySheetRef.current = onOpenPartySheet;

  // F3: one marker request at a time; a newer refresh, a scene change or
  // unmount aborts the previous one.
  const markersAbortRef = useRef<AbortController | null>(null);
  const refreshMarkers = useCallback(async () => {
    markersAbortRef.current?.abort();
    markersAbortRef.current = null;
    if (sideChannelId === null) {
      setPublishedMarkers(EMPTY_PUBLIC_MARKERS);
      return;
    }
    const abort = new AbortController();
    markersAbortRef.current = abort;
    try {
      const response = await fetch(
        markerDetailsUrl(campaignCode, sideChannelId, {
          role: 'player',
          playerId: characterId,
        }),
        { signal: abort.signal }
      );
      if (abort.signal.aborted) return;
      // A late answer for a previous scene never lands on the new one.
      if (sideChannelIdRef.current !== sideChannelId) return;
      if (!response.ok) {
        // Table v1: 404 (not presented/blanked/deleted) is a neutral empty
        // state — never the previous scene's details.
        if (tableScoped) setPublishedMarkers(EMPTY_PUBLIC_MARKERS);
        return;
      }
      const data = (await response.json()) as {
        markers?: PublicMarkerDetail[];
      };
      if (sideChannelIdRef.current !== sideChannelId) return;
      setPublishedMarkers(data.markers ?? []);
    } catch (error) {
      if (abort.signal.aborted) return;
      // Marker details are a best-effort companion to the live canvas relay.
      // Keep the last projection when the endpoint is unavailable; activation
      // can retry, and a marker poke will refresh connected clients later.
      console.warn('Failed to refresh marker details:', error);
    }
  }, [campaignCode, characterId, sideChannelId, tableScoped]);
  const refreshMarkersRef = useRef(refreshMarkers);
  refreshMarkersRef.current = refreshMarkers;

  // PR04 Q2(b): scene-keyed markers get no relay poke (the markers route
  // pokes the legacy room), so refresh every 10 s while a Table scene is
  // resolved: one request in flight, paused while hidden, refreshed on
  // visibility, disposed on unmount or scene change.
  useEffect(() => {
    if (!tableScoped || sideChannelId === null) return;
    let disposed = false;
    const tick = () => {
      if (disposed || document.hidden) return;
      // A newer refresh aborts a still-pending one (single in flight).
      void refreshMarkersRef.current();
    };
    const timer = window.setInterval(tick, 10_000);
    const onVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      markersAbortRef.current?.abort();
    };
  }, [tableScoped, sideChannelId]);

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
  // Merchant token → shop dialog (Task 11): shares this SAME registration's
  // `setActivation` slot via `isExtraActivatable`/`onActivateExtra` rather
  // than a second, independent `useMarkerRegistration`-shaped call — see
  // that hook's doc comment on why a second call would silently replace
  // this one instead of adding a recognized element kind.
  const {
    openShop,
    handleActivate: handleShopTokenActivate,
    closeShop,
  } = useMerchantShopActivation(campaignCode);

  // Own-token AND party-member-token double-tap → sheet drawer (VTT sheet
  // drawer): shares this SAME registration's `setActivation` slot via
  // `sheetTokens` rather than a second, independent
  // `useMarkerRegistration`-shaped call — see that hook's doc comment on why
  // a second call would silently replace this one instead of adding a
  // recognized element kind. A given player token is only activatable while
  // the matching handler is supplied: this client's own token needs
  // `onOpenOwnSheet`, another party member's needs `onOpenPartySheet`.
  const sheetTokens = useMemo(
    () => ({
      isActivatable: (el: Readonly<CanvasElement>) => {
        const rec = el as Partial<{ tokenKind: unknown; characterId: unknown }>;
        if (
          rec.tokenKind !== PLAYER_TOKEN_KIND ||
          typeof rec.characterId !== 'string'
        )
          return false;
        return rec.characterId === characterId
          ? onOpenOwnSheetRef.current !== undefined
          : onOpenPartySheetRef.current !== undefined;
      },
      onActivate: (e: ElementActivationEvent) => {
        const id = (e.element as Partial<{ characterId: string }>).characterId;
        if (!id) return;
        if (id === characterId) onOpenOwnSheetRef.current?.();
        else onOpenPartySheetRef.current?.(id);
      },
    }),
    [characterId]
  );

  useMarkerRegistration({
    viewport,
    gesture: 'single',
    markerDetails: publishedMarkers,
    onActivateMarker: handleMarkerActivate,
    isExtraActivatable: sideChannelsEnabled
      ? isCombatantToken
      : NEVER_ACTIVATABLE,
    onActivateExtra: handleShopTokenActivate,
    sheetTokens,
  });

  const ownCharacterCurrency: Currency | null =
    character && character.id === characterId ? character.currency : null;

  // Purchases committed this VTT visit but not yet debited from
  // `ownCharacterCurrency` — see `useCommittedShopSpend`'s doc comment for
  // why (queue vs. sessionStorage receipt union) and how it survives both
  // a dialog close/reopen and a full VTT reload. Guarded by the same
  // `character.id === characterId` identity check as `ownCharacterCurrency`
  // above, so a stale `characterStore` (e.g. mid roster-switch) can never
  // sweep receipts against a different character's ledger.
  const appliedTransferIdsRaw = useCharacterStore(s => s.appliedTransferIds);
  const appliedTransferIds =
    character && character.id === characterId
      ? appliedTransferIdsRaw
      : EMPTY_APPLIED_TRANSFER_IDS;
  const { committedCopper, recordCommit } = useCommittedShopSpend({
    characterId,
    pendingTransfers,
    appliedTransferIds,
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
    async (entryId: string, quantity: number): Promise<number> => {
      const target = sideChannelIdRef.current;
      if (target === null)
        throw new Error('Loot is not available in this scene.');
      if (markerPanelState.kind !== 'ready')
        throw new Error('This loot container is no longer available.');
      const request = lootClaimRequest(campaignCode, target, {
        playerId: characterId,
        markerId: markerPanelState.detail.id,
        entryId,
        quantity,
        requestId: crypto.randomUUID(),
      });
      const response = await fetch(request.url, request.init);
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        markers?: PublicMarkerDetail[];
        claim?: { grantedQuantity?: number };
      };
      if (!response.ok) {
        throw new Error(
          data.error === 'depleted'
            ? 'Someone else claimed the last one.'
            : data.error === 'locked'
              ? 'This container is locked.'
              : 'Could not claim that item.'
        );
      }
      setPublishedMarkers(data.markers ?? []);
      return data.claim?.grantedQuantity ?? quantity;
    },
    [campaignCode, characterId, markerPanelState]
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
    // Mirrors the DM canvases (`DmBattleMapCanvas.hooks.ts`,
    // `DmLocationEditor.hooks.ts`) — dev/test-only, no-ops in production.
    exposeStoreForE2E('viewport', vp);

    const fogManager = fogPlugin.manager;
    installVttGridController(vp);
    configureFogView(fogManager, 'player', false);

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
    const deletableSelection = (): boolean =>
      (selectTool?.selectedIds ?? []).some(id => {
        const element = vp.store.getById(id);
        return element !== undefined && playerMayDelete(element);
      });
    if (selectTool) {
      selectTool.onSelectionChange(() => {
        setHasSelection(deletableSelection());
      });
    }
    vp.toolManager.onChange(() => {
      const active = vp.toolManager.activeTool?.name === 'select';
      setHasSelection(active ? deletableSelection() : false);
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
      fog: { manager: fogManager },
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
      onDiagnostic: message => {
        if (message.startsWith('Live map identity is invalid'))
          reconnectRef.current.identityInvalid = true;
      },
      onStatus: s => {
        setStatus(s);
        onStatusProp?.(s);
        const reconnect = reconnectRef.current;
        if (s === 'live') {
          reconnect.delay = 1_000;
          setWithdrawn(false);
        }
        if (
          s === 'denied' &&
          tableScoped &&
          tokenDenialRef.current !== 'credential' &&
          !reconnect.identityInvalid &&
          reconnect.timer === null
        ) {
          setWithdrawn(true);
          const delay = reconnect.delay;
          reconnect.delay = Math.min(delay * 2, 15_000);
          reconnect.timer = setTimeout(() => {
            reconnect.timer = null;
            setResolvedSceneId(null);
            laserCleanupRef.current?.();
            laserCleanupRef.current = null;
            connectionRef.current?.stop();
            connectionRef.current = null;
            setViewport(null);
            viewportRef.current = null;
            setCanvasEpoch(epoch => epoch + 1);
          }, delay);
        }
        if (s === 'live') {
          requestAnimationFrame(() => vp.fitToContent(60));
          // Managed sendPresence drops while not live, so the attach-time
          // frame may be lost; announce on every live transition (first
          // connect AND reconnect) — the heartbeat self-heals otherwise.
          awarenessRef.current?.announce();
        }
      },
      onTokenDenied: denial =>
        setTokenDenial(
          denial.status === 403 && denial.error === 'Scene is unavailable'
            ? 'scene-unavailable'
            : denial.status === 403 || denial.status === 400
              ? 'credential'
              : null
        ),
      onTokenMetadata: meta => {
        setTokenDenial(null);
        applyFogAppearanceMetadata(
          vp,
          meta.fogAppearance,
          meta.fogAppearanceUpdatedAt
        );
      },
      onSceneResolved: sceneId => {
        // A rebuild after a withdrawal resolves afresh: name a scene change.
        const reconnect = reconnectRef.current;
        if (
          reconnect.lastResolved !== null &&
          reconnect.lastResolved !== sceneId
        )
          setSceneNotice(
            notice =>
              notice ?? 'The presented scene changed. The map was reloaded.'
          );
        reconnect.lastResolved = sceneId;
        setResolvedSceneId(sceneId);
      },
      onSceneChange: change => {
        const count = change.discardedOperationIds.length;
        setSceneNotice(
          `The presented scene changed${
            count > 0
              ? ` — ${count} unsent edit${count === 1 ? ' was' : 's were'} discarded`
              : ''
          }. The map was reloaded.`
        );
        setResolvedSceneId(null);
        laserCleanupRef.current?.();
        laserCleanupRef.current = null;
        connectionRef.current?.stop();
        connectionRef.current = null;
        setViewport(null);
        viewportRef.current = null;
        setCanvasEpoch(epoch => epoch + 1);
      },
      onPoke: feature => {
        if (feature === 'markers') void refreshMarkersRef.current();
        const target = sideChannelIdRef.current;
        if (feature === 'fog-appearance' && target !== null) {
          fetchAndApplyFogAppearance(
            vp,
            fogAppearanceReadUrl('battlemap', campaignCode, target, {
              role: 'player',
              playerId: characterId,
            })
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
      def => connection.publishLayerUpsert(canonicalPlayerBand(def)),
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
      });
    } catch (error) {
      // attachConnectionScope already disposed every helper it saw and
      // stopped `connection`; drop the dead reference so unmount and the
      // next re-attach do not stop it twice, then surface the error.
      connectionRef.current = null;
      throw error;
    }
  };

  // Fog appearance companion, keyed by the side-channel id (the resolved
  // scene under Table v1; this map outside it).
  useEffect(() => {
    if (
      !viewport ||
      sideChannelId === null ||
      !process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL
    )
      return;
    return startFogAppearancePoll({
      viewport,
      url: fogAppearanceReadUrl('battlemap', campaignCode, sideChannelId, {
        role: 'player',
        playerId: characterId,
      }),
    });
  }, [viewport, sideChannelId, campaignCode, characterId]);

  const handleDeleteSelected = useCallback(() => {
    const vp = viewport;
    if (!vp) return;
    const selectTool = vp.toolManager.getTool<SelectTool>('select');
    if (!selectTool) return;
    const ids = selectTool.selectedIds.filter(id => {
      const element = vp.store.getById(id);
      return element !== undefined && playerMayDelete(element);
    });
    if (ids.length === 0) return;
    vp.removeElements(ids);
    selectTool.setSelection([]);
  }, [viewport, playerMayDelete]);

  useEffect(
    () => () => {
      laserCleanupRef.current?.();
      movementCommitUnsubRef.current?.();
      connectionRef.current?.stop();
      markersAbortRef.current?.abort();
      if (reconnectRef.current.timer) clearTimeout(reconnectRef.current.timer);
    },
    []
  );

  return (
    <ViewportContext.Provider value={viewport}>
      <div className="bg-surface fixed inset-0">
        <FieldNotesCanvas
          key={canvasEpoch}
          tools={tools}
          defaultTool="hand"
          onReady={handleReady}
          className="h-full w-full"
          options={{
            plugins: [fogPlugin],
            requiredCapabilities: ['vtt:fog'],
          }}
          snapToGrid
        />
        <BattleMapBootstrapPrivacyCover
          status={status}
          message={
            tokenDenial === 'credential'
              ? 'Access denied'
              : tokenDenial === 'scene-unavailable' || withdrawn
                ? "The DM isn't showing this map right now"
                : undefined
          }
        />
        {sceneNotice && (
          <div className="border-accent-amber-border bg-accent-amber-bg pointer-events-auto absolute top-16 left-1/2 z-[110] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg border px-3 py-2 shadow-lg">
            <p role="status" className="text-accent-amber-text text-sm">
              {sceneNotice}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSceneNotice(null)}
            >
              Dismiss
            </Button>
          </div>
        )}
        {viewport && (
          <PlayerMapToolControls>
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
                  getFogState={() => getViewportFogManager(viewport).getState()}
                  getFogStyle={() =>
                    resolvePlayerFogStyle(getAppliedFogAppearance(viewport))
                  }
                  onError={onExportError}
                />
              }
            />
            <div className="border-divider pointer-events-auto max-w-full overflow-x-auto overscroll-x-contain rounded-xl border shadow-lg">
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
          </PlayerMapToolControls>
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
        {/* Mounted only once a merchant token's tap has been confirmed
            (Task 11) against the shop index and the shop's own live
            projection — see `useMerchantShopActivation`. `initialShop` is
            that SAME confirmed record, so this dialog never re-fetches the
            identical URL its own `useShopData` would otherwise fetch on
            open. `ownCharacterCurrency` guards against opening before this
            route's own character has loaded. */}
        {openShop && ownCharacterCurrency && (
          <PlayerShopDialog
            open
            onOpenChange={open => {
              if (!open) closeShop();
            }}
            campaignCode={campaignCode}
            npcId={openShop.npcId}
            playerId={characterId}
            initialShop={openShop.shop}
            purse={ownCharacterCurrency}
            committedCopper={committedCopper}
            onPurchaseCommitted={recordCommit}
          />
        )}
        {viewport && children}
      </div>
    </ViewportContext.Provider>
  );
}

/** Opaque until the authoritative element and fog snapshot has been applied. */
export function BattleMapBootstrapPrivacyCover({
  status,
  message,
}: {
  status: BattleMapConnectionStatus;
  message?: string;
}) {
  if (status === 'live') return null;
  return (
    <div
      data-testid="battlemap-bootstrap-privacy-cover"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        background: '#000',
        pointerEvents: 'none',
      }}
    >
      {message ?? (status === 'denied' ? 'Access denied' : 'Connecting…')}
    </div>
  );
}
