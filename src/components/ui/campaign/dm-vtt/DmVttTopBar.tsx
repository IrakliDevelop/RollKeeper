'use client';

import Link from 'next/link';
import { ArrowLeft, Monitor } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { openTvDisplay } from '@/lib/openTvDisplay';

import type { BattleMapConnectionStatus } from '@/lib/battlemapSync';

export type DmVttMode = 'setup' | 'play';
export type DmVttGridMode = 'hex' | 'square' | 'off';

interface DmVttTopBarProps {
  campaignCode: string;
  battleMapId: string;
  dmId: string;
  mapName: string;
  status: BattleMapConnectionStatus;
  gridMode: DmVttGridMode;
  onSetGridMode: (mode: DmVttGridMode) => void;
  mode: DmVttMode;
  onModeChange: (mode: DmVttMode) => void;
}

const GRID_OPTIONS: { key: DmVttGridMode; label: string }[] = [
  { key: 'hex', label: 'Hex' },
  { key: 'square', label: 'Square' },
  { key: 'off', label: 'Off' },
];

const MODE_OPTIONS: { key: DmVttMode; label: string }[] = [
  { key: 'setup', label: 'Setup' },
  { key: 'play', label: 'Play' },
];

/**
 * Top chrome bar for the DM VTT play screen: back link, map name, grid
 * segmented control (mirrors `useDmVttGrid`'s `setGridMode`), TV display
 * launcher (Task 1's `openTvDisplay` helper), a live-status chip (mirrors
 * `DmVttToolbar`'s status pill), and the Setup|Play mode switch (state +
 * persistence owned by the page).
 */
export function DmVttTopBar({
  campaignCode,
  battleMapId,
  dmId,
  mapName,
  status,
  gridMode,
  onSetGridMode,
  mode,
  onModeChange,
}: DmVttTopBarProps) {
  return (
    <div className="bg-surface-raised border-divider pointer-events-auto fixed top-3 left-4 flex min-h-[44px] items-center gap-3 rounded-2xl border px-3 py-1.5 shadow-xl">
      <Link href={`/dm/campaign/${campaignCode}/battlemaps`}>
        <Button variant="ghost" size="lg" aria-label="Back to battle maps">
          <ArrowLeft size={18} />
        </Button>
      </Link>
      <span className="text-heading max-w-[160px] truncate text-sm font-semibold">
        {mapName}
      </span>
      <div className="border-divider flex items-center gap-0.5 rounded-lg border p-0.5">
        {GRID_OPTIONS.map(({ key, label }) => (
          <Button
            key={key}
            variant={gridMode === key ? 'primary' : 'ghost'}
            onClick={() => onSetGridMode(key)}
            className="min-h-[44px] px-2 text-xs"
          >
            {label}
          </Button>
        ))}
      </div>
      <Button
        variant="ghost"
        size="lg"
        leftIcon={<Monitor size={16} />}
        onClick={() => openTvDisplay(campaignCode, battleMapId, dmId)}
        className="text-xs"
      >
        Open Display
      </Button>
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
      <div className="border-divider flex items-center gap-0.5 rounded-lg border p-0.5">
        {MODE_OPTIONS.map(({ key, label }) => (
          <Button
            key={key}
            variant={mode === key ? 'primary' : 'ghost'}
            onClick={() => onModeChange(key)}
            className="min-h-[44px] px-2 text-xs"
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
