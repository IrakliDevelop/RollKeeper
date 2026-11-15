'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Grid3x3, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { OptionLabel, RangeField, SegmentedGroup } from './ToolOptionControls';

interface DmLocationGridPopoverProps {
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

type GridChoice = 'off' | 'hex' | 'square';

const GRID_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'hex', label: 'Hex' },
  { value: 'square', label: 'Square' },
] as const;

const STEPPER_CLASS = 'w-7 shrink-0 px-0';

/**
 * Grid controls collapsed behind one toolbar button — the inline
 * type-selector + color + sliders strip made the toolbar overflow on
 * smaller screens. Pure props: state lives in the editor hook, exactly as
 * it did when these controls sat inline.
 */
export default function DmLocationGridPopover({
  gridEnabled,
  gridType,
  gridCellSize,
  gridColor,
  gridOpacity,
  onSetGridType,
  onUpdateGridSettings,
}: DmLocationGridPopoverProps) {
  const [open, setOpen] = useState(false);

  const choice: GridChoice = gridEnabled ? gridType : 'off';
  const stateLabel =
    choice === 'off' ? 'Off' : choice === 'hex' ? 'Hex' : 'Square';
  const opacityPercent = Math.round(gridOpacity * 100);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          selected={open}
          leftIcon={<Grid3x3 size={16} />}
        >
          Grid: {stateLabel}
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          aria-label="Grid"
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className={`${OVERLAY_SURFACE} z-[60] w-72 max-w-[calc(100vw-1rem)] p-3`}
        >
          <SegmentedGroup<GridChoice>
            label="Grid type"
            options={GRID_OPTIONS}
            value={choice}
            onChange={onSetGridType}
          />

          {gridEnabled && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0">
                  <OptionLabel>Color</OptionLabel>
                </span>
                <input
                  type="color"
                  aria-label="Grid color"
                  value={gridColor}
                  onChange={e =>
                    onUpdateGridSettings({ strokeColor: e.target.value })
                  }
                  className="border-divider-strong h-9 w-9 cursor-pointer rounded-sm border bg-transparent p-0.5 pointer-coarse:h-11 pointer-coarse:w-11"
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="w-12 shrink-0">
                  <OptionLabel>Size</OptionLabel>
                </span>
                <span className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className={STEPPER_CLASS}
                    aria-label="Decrease grid size"
                    onClick={() =>
                      onUpdateGridSettings({
                        cellSize: Math.max(20, gridCellSize - 1),
                      })
                    }
                  >
                    <Minus size={14} />
                  </Button>
                  <RangeField
                    ariaLabel="Grid cell size"
                    min={20}
                    max={150}
                    value={gridCellSize}
                    onChange={cellSize => onUpdateGridSettings({ cellSize })}
                    format={value => `${value}px`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className={STEPPER_CLASS}
                    aria-label="Increase grid size"
                    onClick={() =>
                      onUpdateGridSettings({
                        cellSize: Math.min(150, gridCellSize + 1),
                      })
                    }
                  >
                    <Plus size={14} />
                  </Button>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="w-12 shrink-0">
                  <OptionLabel>Opacity</OptionLabel>
                </span>
                <span className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className={STEPPER_CLASS}
                    aria-label="Decrease opacity"
                    onClick={() =>
                      onUpdateGridSettings({
                        opacity: Math.max(0.1, gridOpacity - 0.01),
                      })
                    }
                  >
                    <Minus size={14} />
                  </Button>
                  <RangeField
                    ariaLabel="Grid opacity"
                    min={10}
                    max={100}
                    value={opacityPercent}
                    onChange={percent =>
                      onUpdateGridSettings({ opacity: percent / 100 })
                    }
                    format={value => `${value}%`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className={STEPPER_CLASS}
                    aria-label="Increase opacity"
                    onClick={() =>
                      onUpdateGridSettings({
                        opacity: Math.min(1, gridOpacity + 0.01),
                      })
                    }
                  >
                    <Plus size={14} />
                  </Button>
                </span>
              </div>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
