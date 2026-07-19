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
  type Tool,
  type Viewport,
} from '@fieldnotes/core';
import { PlayerHandTool } from './PlayerHandTool';
import {
  createManagedBattleMapConnection,
  type BattleMapConnectionStatus,
} from '@/lib/battlemapSync';
import DmLocationToolOptions from './DmLocationToolOptions';
import { ensurePlayerLayer } from './playerLayer';
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
}

/** Viewport exposes historyRecorder at runtime for batched store ops. */
type ViewportHistoryAccess = {
  historyRecorder: { begin: () => void; commit: () => void };
};

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

export function PlayerToolbar({
  status,
  hasSelection,
  onDeleteSelected,
  tokenInfoToggle,
  characterId,
}: {
  status: BattleMapConnectionStatus;
  hasSelection: boolean;
  onDeleteSelected: () => void;
  tokenInfoToggle?: { mode: TokenInfoMode | null; onCycle: () => void };
  characterId: string;
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
    <div className="bg-surface-raised border-divider absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-xl border p-1 shadow-lg">
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
      {(hasSelection || (tokenInfoToggle && TokenInfoIcon)) && (
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
}: PlayerBattleMapCanvasProps) {
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [status, setStatus] = useState<BattleMapConnectionStatus>('connecting');
  const [hasSelection, setHasSelection] = useState(false);
  const connectionRef = useRef<{ stop: () => void } | null>(null);
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

  const handleReady = (vp: Viewport) => {
    setViewport(vp);

    // Everything this player places lives on a layer whose id is stable
    // across sessions — after a reload, their own elements from the snapshot
    // land on this known unlocked layer instead of being mirrored as locked
    // "DM" content (which made them permanently uncontrollable).
    ensurePlayerLayer(vp, characterId);

    // Layers aren't synced: remote elements reference the DM's layer ids,
    // which don't exist here — and unknown layers count as unlocked, making
    // the (locked) map image hit-testable, so it swallowed every click and
    // marquee multi-select never started. Mirror each unknown remote layer
    // locally as a LOCKED layer: hit-test and marquee then skip DM content
    // entirely (players couldn't move it anyway — the relay rejects that),
    // and clicking the map pans/marquees like it does for the DM.
    vp.store.on('add', el => {
      if (el.layerId && !vp.layerManager.getLayer(el.layerId)) {
        vp.layerManager.addLayerDirect({
          id: el.layerId,
          name: 'DM layer',
          visible: true,
          locked: true,
          order: -1,
          opacity: 1,
        });
        vp.requestRender();
      }
    });

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
    connectionRef.current = createManagedBattleMapConnection({
      relayUrl,
      campaignCode,
      battleMapId,
      store: vp.store,
      clientId: characterId,
      tokenRequest: { role: 'player', battleMapId, playerId: characterId },
      onStatus: s => {
        setStatus(s);
        onStatusProp?.(s);
        if (s === 'live') requestAnimationFrame(() => vp.fitToContent(60));
      },
      onPoke: feature => onPokeRef.current?.(feature),
    });
  };

  const handleDeleteSelected = useCallback(() => {
    const vp = viewport;
    if (!vp) return;
    const selectTool = vp.toolManager.getTool<SelectTool>('select');
    if (!selectTool) return;
    const ids = selectTool.selectedIds.filter(id => vp.store.getById(id));
    if (ids.length === 0) return;
    const { historyRecorder } = vp as unknown as ViewportHistoryAccess;
    historyRecorder.begin();
    for (const id of ids) {
      vp.store.remove(id);
    }
    historyRecorder.commit();
    selectTool.setSelection([]);
    vp.requestRender();
  }, [viewport]);

  useEffect(() => () => connectionRef.current?.stop(), []);

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
        {viewport && children}
      </div>
    </ViewportContext.Provider>
  );
}
