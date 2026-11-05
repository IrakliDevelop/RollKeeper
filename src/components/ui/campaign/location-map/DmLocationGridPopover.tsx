'use client';

import { useEffect, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { Grid3x3 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';

interface DmLocationGridPopoverProps {
  presentation?: 'inline' | 'dock';
  gridEnabled: boolean;
  gridType: 'square' | 'hex';
  gridCellSize: number;
  gridColor: string;
  gridOpacity: number;
  onSetGridType: (type: 'square' | 'hex' | 'off') => void;
  onUpdateGridSettings: (settings: {
    cellSize?: number;
    strokeColor?: string;
    opacity?: number;
  }) => void;
}

/**
 * Grid controls collapsed behind one toolbar button — the inline
 * type-selector + color + sliders strip made the toolbar overflow on
 * smaller screens. Pure props: state lives in the editor hook, exactly as
 * it did when these controls sat inline.
 */
export default function DmLocationGridPopover({
  presentation = 'inline',
  gridEnabled,
  gridType,
  gridCellSize,
  gridColor,
  gridOpacity,
  onSetGridType,
  onUpdateGridSettings,
}: DmLocationGridPopoverProps) {
  const dock = presentation === 'dock';
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || dock) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, dock]);

  const stateLabel = !gridEnabled
    ? 'Off'
    : gridType === 'hex'
      ? 'Hex'
      : 'Square';

  const typeButton = (
    type: 'off' | 'hex' | 'square',
    title: string,
    label: string,
    active: boolean
  ) => (
    <button
      onClick={() => onSetGridType(type)}
      title={title}
      className={`rounded px-2 py-1 text-xs transition-colors ${
        active
          ? dock
            ? 'bg-brass-bg text-brass-text font-semibold'
            : 'bg-accent-blue-bg text-accent-blue-text font-semibold'
          : 'text-muted hover:bg-surface-secondary hover:text-body'
      }`}
    >
      {label}
    </button>
  );

  const trigger = (
    <Button
      variant={dock ? 'ghost' : open ? 'primary' : 'ghost'}
      selected={dock && open}
      onClick={dock ? undefined : () => setOpen(o => !o)}
      title="Grid settings"
      aria-label={dock ? 'Grid settings' : undefined}
      aria-expanded={open}
      className={
        dock
          ? 'flex min-h-11 items-center gap-1.5 px-2 py-1 text-xs'
          : 'flex items-center gap-1.5 px-2 py-1 text-xs'
      }
    >
      <Grid3x3 size={15} />
      Grid: {stateLabel}
    </Button>
  );
  const panel = (
    <div
      className={
        dock
          ? `${OVERLAY_SURFACE} z-50 w-64 max-w-[calc(100vw-1rem)] overflow-y-auto p-3 [&_button]:min-h-11 [&_button]:min-w-11 [&_input]:pointer-coarse:text-base`
          : 'border-divider bg-surface-raised absolute top-full right-0 z-20 mt-1 w-64 rounded-lg border p-3 shadow-lg'
      }
      style={
        dock
          ? { maxHeight: 'var(--radix-popover-content-available-height)' }
          : undefined
      }
    >
      <div className="border-divider bg-surface flex items-center gap-0.5 rounded-md border p-0.5">
        {typeButton('off', 'No grid', 'Off', !gridEnabled)}
        {typeButton(
          'hex',
          'Hex grid',
          'Hex',
          gridEnabled && gridType === 'hex'
        )}
        {typeButton(
          'square',
          'Square grid',
          'Square',
          gridEnabled && gridType === 'square'
        )}
      </div>

      {gridEnabled && (
        <div className="mt-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-muted w-12 text-xs">Color</span>
            <label
              className="relative h-6 w-6 cursor-pointer"
              title="Grid color"
            >
              <input
                type="color"
                value={gridColor}
                onChange={e =>
                  onUpdateGridSettings({ strokeColor: e.target.value })
                }
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div
                className="border-divider h-6 w-6 rounded border"
                style={{ backgroundColor: gridColor }}
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted w-12 text-xs">Size</span>
            <button
              onClick={() =>
                onUpdateGridSettings({
                  cellSize: Math.max(20, gridCellSize - 1),
                })
              }
              className="text-muted hover:text-body hover:bg-surface-secondary flex h-5 w-5 items-center justify-center rounded text-xs"
              title="Decrease grid size"
            >
              −
            </button>
            <input
              type="range"
              min={20}
              max={150}
              value={gridCellSize}
              title="Grid cell size"
              onChange={e =>
                onUpdateGridSettings({ cellSize: Number(e.target.value) })
              }
              className="min-w-0 flex-1"
            />
            <button
              onClick={() =>
                onUpdateGridSettings({
                  cellSize: Math.min(150, gridCellSize + 1),
                })
              }
              className="text-muted hover:text-body hover:bg-surface-secondary flex h-5 w-5 items-center justify-center rounded text-xs"
              title="Increase grid size"
            >
              +
            </button>
            <span className="text-muted w-7 text-right text-xs">
              {gridCellSize}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted w-12 text-xs">Opacity</span>
            <button
              onClick={() =>
                onUpdateGridSettings({
                  opacity: Math.max(0.1, gridOpacity - 0.01),
                })
              }
              className="text-muted hover:text-body hover:bg-surface-secondary flex h-5 w-5 items-center justify-center rounded text-xs"
              title="Decrease opacity"
            >
              −
            </button>
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(gridOpacity * 100)}
              title="Grid opacity"
              onChange={e =>
                onUpdateGridSettings({
                  opacity: Number(e.target.value) / 100,
                })
              }
              className="min-w-0 flex-1"
            />
            <button
              onClick={() =>
                onUpdateGridSettings({
                  opacity: Math.min(1, gridOpacity + 0.01),
                })
              }
              className="text-muted hover:text-body hover:bg-surface-secondary flex h-5 w-5 items-center justify-center rounded text-xs"
              title="Increase opacity"
            >
              +
            </button>
            <span className="text-muted w-8 text-right text-xs">
              {Math.round(gridOpacity * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
  if (dock)
    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            asChild
            sideOffset={8}
            collisionPadding={8}
            aria-label="Grid settings"
          >
            {panel}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  return (
    <div ref={rootRef} className="relative">
      {trigger}
      {open && panel}
    </div>
  );
}
