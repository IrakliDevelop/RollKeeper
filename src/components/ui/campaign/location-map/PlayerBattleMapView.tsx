'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import {
  FieldNotesCanvas,
  ViewportContext,
  useActiveTool,
} from '@fieldnotes/react';
import {
  HandTool,
  SelectTool,
  ArrowTool,
  PencilTool,
  type Tool,
  type Viewport,
} from '@fieldnotes/core';
import {
  createManagedBattleMapConnection,
  type BattleMapConnectionStatus,
} from '@/lib/battlemapSync';
import { PlayerTokenTool, tokenColorForId } from './PlayerTokenTool';

interface PlayerBattleMapViewProps {
  campaignCode: string;
  battleMapId: string;
  characterId: string;
  characterName: string;
}

const TOOL_LABELS: { name: string; label: string }[] = [
  { name: 'hand', label: 'Pan' },
  { name: 'select', label: 'Select' },
  { name: 'token', label: 'Token' },
  { name: 'pencil', label: 'Draw' },
  { name: 'arrow', label: 'Arrow' },
];

function PlayerToolbar({ status }: { status: BattleMapConnectionStatus }) {
  const [activeTool, setTool] = useActiveTool();
  return (
    <div className="bg-surface-raised border-divider absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border p-1 shadow-lg">
      {TOOL_LABELS.map(({ name, label }) => (
        <Button
          key={name}
          variant={activeTool === name ? 'primary' : 'ghost'}
          onClick={() => setTool(name)}
          className="px-2.5 py-1 text-xs"
        >
          {label}
        </Button>
      ))}
      <span
        className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
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

export function PlayerBattleMapView({
  campaignCode,
  battleMapId,
  characterId,
  characterName,
}: PlayerBattleMapViewProps) {
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [status, setStatus] = useState<BattleMapConnectionStatus>('connecting');
  const connectionRef = useRef<{ stop: () => void } | null>(null);

  const tools = useMemo<Tool[]>(
    () => [
      new HandTool(),
      new SelectTool(),
      new PlayerTokenTool(tokenColorForId(characterId), characterName),
      new PencilTool({ color: tokenColorForId(characterId), width: 3 }),
      new ArrowTool({ color: tokenColorForId(characterId), width: 2 }),
    ],
    [characterId, characterName]
  );

  const handleReady = (vp: Viewport) => {
    setViewport(vp);
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
        if (s === 'live') requestAnimationFrame(() => vp.fitToContent(60));
      },
    });
  };

  useEffect(() => () => connectionRef.current?.stop(), []);

  return (
    <ViewportContext.Provider value={viewport}>
      <div className="bg-surface fixed inset-0">
        <FieldNotesCanvas
          tools={tools}
          defaultTool="hand"
          onReady={handleReady}
        />
        {viewport && <PlayerToolbar status={status} />}
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
      </div>
    </ViewportContext.Provider>
  );
}
