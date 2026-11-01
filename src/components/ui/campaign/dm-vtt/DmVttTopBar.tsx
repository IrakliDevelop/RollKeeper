'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, Monitor, Grid3x3, ChevronDown } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';

import { Button } from '@/components/ui/forms/button';
import { useDisplayLauncher } from '@/components/ui/campaign/table/display/useDisplayLauncher';
import {
  TableMapEntryLinkView,
  useTableMapEntry,
} from '@/components/ui/campaign/table/TableEntryLinks';
import { openTvDisplay } from '@/lib/openTvDisplay';

export type DmVttMode = 'setup' | 'play';
export type DmVttGridMode = 'hex' | 'square' | 'off';

interface DmVttTopBarProps {
  campaignCode: string;
  battleMapId: string;
  dmId: string;
  mapName: string;
  gridMode?: DmVttGridMode;
  onSetGridMode?: (mode: DmVttGridMode) => void;
  showDisplay?: boolean;
  trailing?: ReactNode;
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
 * launcher (Task 1's `openTvDisplay` helper), a privacy label (the original
 * map has no live room under Table v1), and the Setup|Play mode switch
 * (state + persistence owned by the page).
 */
export function DmVttTopBar({
  campaignCode,
  battleMapId,
  dmId,
  mapName,
  gridMode,
  showDisplay = true,
  trailing,
  onSetGridMode,
  mode,
  onModeChange,
}: DmVttTopBarProps) {
  // PR05 E12: under Table v1 this opens the persistent campaign display.
  const display = useDisplayLauncher();
  // One lookup feeds both the Table link and the privacy label (CC3).
  const tableEntry = useTableMapEntry(campaignCode, battleMapId);
  return (
    <div className="flex min-w-0 flex-col gap-1 p-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-h-11 min-w-11 p-0"
        >
          <Link
            href={`/dm/campaign/${campaignCode}/battlemaps`}
            aria-label="Back to battle maps"
          >
            <ArrowLeft size={18} aria-hidden />
          </Link>
        </Button>
        <h1
          className="type-ui text-heading min-w-0 flex-1 break-words max-[360px]:line-clamp-2"
          title={mapName}
        >
          {mapName}
        </h1>
        <div className="flex shrink-0 flex-wrap items-center gap-1 max-[360px]:w-full max-[360px]:justify-end">
          <TableMapEntryLinkView target={tableEntry} compact />
          <div
            role="group"
            aria-label="Map mode"
            className="flex shrink-0 items-center gap-0.5"
          >
            {MODE_OPTIONS.map(({ key, label }) => (
              <Button
                key={key}
                variant="ghost"
                size="sm"
                selected={mode === key}
                aria-pressed={mode === key}
                onClick={() => onModeChange(key)}
                className="min-h-11 px-2"
              >
                {label}
              </Button>
            ))}
          </div>
          {trailing}
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <p className="type-small text-muted min-w-0 flex-1 basis-64">
          {tableEntry?.kind === 'open'
            ? 'Private copy. Players see the Table scene, not edits here.'
            : "Private. Players don't see this map."}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {gridMode && onSetGridMode && (
            <Popover.Root>
              <Popover.Trigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11 px-2"
                  aria-label="Grid settings"
                >
                  <Grid3x3 size={16} aria-hidden />
                  Grid:{' '}
                  {GRID_OPTIONS.find(option => option.key === gridMode)?.label}
                  <ChevronDown size={14} aria-hidden />
                </Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  sideOffset={8}
                  collisionPadding={8}
                  aria-label="Grid settings"
                  className={`${OVERLAY_SURFACE} z-50 max-w-[calc(100vw-1rem)] p-3`}
                >
                  <p className="type-label-heading text-heading mb-2">Grid</p>
                  <div className="flex flex-wrap gap-1">
                    {GRID_OPTIONS.map(({ key, label }) => (
                      <Button
                        key={key}
                        variant="ghost"
                        size="sm"
                        selected={gridMode === key}
                        aria-pressed={gridMode === key}
                        onClick={() => onSetGridMode(key)}
                        className="min-h-11 px-3"
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )}
          {showDisplay && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Monitor size={16} />}
              onClick={() =>
                display.launch(() => openTvDisplay(campaignCode, dmId))
              }
              className="min-h-11 px-2"
            >
              Open display
            </Button>
          )}
        </div>
      </div>
      {display.message && (
        <p role="status" className="type-small text-ember-text">
          {display.message}
        </p>
      )}
    </div>
  );
}
