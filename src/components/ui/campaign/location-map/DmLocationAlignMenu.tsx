'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceBetween,
  AlignVerticalSpaceBetween,
} from 'lucide-react';
import { useSelectionOps } from '@fieldnotes/react';
import { Button } from '@/components/ui/forms/button';

const ALIGN_ACTIONS = [
  { edge: 'left', title: 'Align left', Icon: AlignStartVertical },
  {
    edge: 'center-x',
    title: 'Align centers horizontally',
    Icon: AlignCenterVertical,
  },
  { edge: 'right', title: 'Align right', Icon: AlignEndVertical },
  { edge: 'top', title: 'Align top', Icon: AlignStartHorizontal },
  {
    edge: 'middle',
    title: 'Align middles vertically',
    Icon: AlignCenterHorizontal,
  },
  { edge: 'bottom', title: 'Align bottom', Icon: AlignEndHorizontal },
] as const;

const DISTRIBUTE_ACTIONS = [
  {
    axis: 'horizontal',
    title: 'Distribute horizontally',
    Icon: AlignHorizontalSpaceBetween,
  },
  {
    axis: 'vertical',
    title: 'Distribute vertically',
    Icon: AlignVerticalSpaceBetween,
  },
] as const;

/**
 * Align/distribute actions for the current selection, behind one toolbar
 * button (six always-visible icon buttons would bloat the freshly slimmed
 * toolbar). Same local-popover pattern as DmLocationGridPopover. The panel
 * stays open after an action — aligning then distributing is a common
 * chain. Must render inside ViewportContext.Provider.
 */
export default function DmLocationAlignMenu() {
  const { canAlign, canDistribute, align, distribute } = useSelectionOps();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  // Selection dropping below two movable elements leaves a dead panel — close it.
  useEffect(() => {
    if (!canAlign) setOpen(false);
  }, [canAlign]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant={open ? 'primary' : 'ghost'}
        onClick={() => setOpen(o => !o)}
        disabled={!canAlign}
        title="Align & distribute"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2 py-1 text-xs"
      >
        <AlignStartVertical size={15} />
        Align
      </Button>

      {open && (
        <div className="border-divider bg-surface-raised absolute top-full left-0 z-20 mt-1 rounded-lg border p-2 shadow-lg">
          <div className="flex items-center gap-0.5">
            {ALIGN_ACTIONS.map(({ edge, title, Icon }) => (
              <Button
                key={edge}
                variant="ghost"
                onClick={() => align(edge)}
                title={title}
                className="h-8 w-8 p-0"
              >
                <Icon size={15} />
              </Button>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-0.5">
            {DISTRIBUTE_ACTIONS.map(({ axis, title, Icon }) => (
              <Button
                key={axis}
                variant="ghost"
                onClick={() => distribute(axis)}
                disabled={!canDistribute}
                title={title}
                className="h-8 w-8 p-0"
              >
                <Icon size={15} />
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
