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
 * Session-controls row for the DM VTT command dock: back link, map name, grid
 * segmented control (mirrors `useDmVttGrid`'s `setGridMode`), TV display
 * launcher (Task 1's `openTvDisplay` helper), a live-status chip (the
 * chip's single home — the Play toolbar no longer duplicates it), and the
 * Setup|Play mode switch (state + persistence owned by the page).
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
    <div className="flex min-h-[44px] min-w-0 items-center justify-center gap-2 px-2 py-1 sm:gap-3 sm:px-3">
      <Link href={`/dm/campaign/${campaignCode}/battlemaps`}>
        <Button variant="ghost" size="lg" aria-label="Back to battle maps">
          <ArrowLeft size={18} />
        </Button>
      </Link>
      <span className="text-heading min-w-0 flex-1 truncate text-sm font-semibold sm:max-w-[160px] sm:flex-none">
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
        className="min-h-[44px] min-w-[44px] px-2 text-xs lg:px-3"
        aria-label="Open display"
      >
        <span className="hidden lg:inline">Open Display</span>
      </Button>
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full sm:h-auto sm:w-auto sm:px-2 sm:py-0.5 sm:text-xs ${
          status === 'live'
            ? 'bg-accent-emerald-bg text-accent-emerald-text'
            : status === 'denied'
              ? 'bg-accent-red-bg text-accent-red-text'
              : 'bg-accent-amber-bg text-accent-amber-text'
        }`}
      >
        <span className="sr-only sm:not-sr-only">
          {status === 'live'
            ? 'Live'
            : status === 'denied'
              ? 'Access denied'
              : 'Connecting…'}
        </span>
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
