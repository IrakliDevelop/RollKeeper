'use client';

import Link from 'next/link';
import { ArrowLeft, Monitor } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
import { LiveSyncChip } from '@/components/ui/campaign/location-map/LiveSyncChip';
import { SegmentedGroup } from '@/components/ui/campaign/location-map/ToolOptionControls';
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

const GRID_OPTIONS: readonly { value: DmVttGridMode; label: string }[] = [
  { value: 'hex', label: 'Hex' },
  { value: 'square', label: 'Square' },
  { value: 'off', label: 'Off' },
];

const MODE_OPTIONS: readonly { value: DmVttMode; label: string }[] = [
  { value: 'setup', label: 'Setup' },
  { value: 'play', label: 'Play' },
];

/**
 * Session-controls row for the DM VTT command dock: back link, map name, grid
 * segmented control (mirrors `useDmVttGrid`'s `setGridMode`), TV display
 * launcher (Task 1's `openTvDisplay` helper), the setup toolbar's shared
 * `LiveSyncChip` (the play dock's single home for it), and the Setup|Play
 * mode switch (state + persistence owned by the page). Its tooltips sit
 * under `DmVttToolbar`'s `TooltipProvider`.
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
    <div className="scrollbar-thin flex min-h-[52px] min-w-0 items-center justify-start gap-2 overflow-x-auto overscroll-x-contain px-2 py-1 sm:gap-3 sm:px-3">
      <Tooltip content="Back to battle maps">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="w-9 shrink-0 px-0"
          aria-label="Back to battle maps"
        >
          <Link href={`/dm/campaign/${campaignCode}/battlemaps`}>
            <ArrowLeft size={16} aria-hidden />
          </Link>
        </Button>
      </Tooltip>
      <span className="type-ui text-heading min-w-[5rem] flex-1 truncate sm:max-w-[160px] sm:flex-none">
        {mapName}
      </span>
      <div className="shrink-0">
        <SegmentedGroup
          label="Grid type"
          size="sm"
          options={GRID_OPTIONS}
          value={gridMode}
          onChange={onSetGridMode}
        />
      </div>
      <Tooltip content="Open TV display">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Monitor size={16} />}
          onClick={() => openTvDisplay(campaignCode, battleMapId, dmId)}
          className="shrink-0 px-2 lg:px-3"
          aria-label="Open TV display"
        >
          <span className="hidden lg:inline">Open TV display</span>
        </Button>
      </Tooltip>
      <div className="shrink-0">
        <LiveSyncChip status={status} />
      </div>
      <div className="shrink-0">
        <SegmentedGroup
          label="Mode"
          size="sm"
          options={MODE_OPTIONS}
          value={mode}
          onChange={onModeChange}
        />
      </div>
    </div>
  );
}
