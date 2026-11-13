'use client';

import { useEffect, useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
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
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';

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

const ICON_BUTTON_CLASS = 'w-9 shrink-0 px-0';

/**
 * Radix tooltips never open on a disabled button, so a disabled action wraps
 * its trigger in a focusable span that keeps the hint reachable.
 */
function DisableableTooltip({
  content,
  disabled,
  children,
}: {
  content: ReactNode;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip content={content}>
      <span className="inline-flex" tabIndex={disabled ? 0 : undefined}>
        {children}
      </span>
    </Tooltip>
  );
}

/**
 * Align/distribute actions for the current selection, behind one toolbar
 * button (six always-visible icon buttons would bloat the freshly slimmed
 * toolbar). The panel stays open after an action — aligning then
 * distributing is a common chain. Must render inside ViewportContext.Provider.
 */
export default function DmLocationAlignMenu() {
  const { canAlign, canDistribute, align, distribute } = useSelectionOps();
  const [open, setOpen] = useState(false);

  // Selection dropping below two movable elements leaves a dead panel — close it.
  useEffect(() => {
    if (!canAlign) setOpen(false);
  }, [canAlign]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          selected={open}
          disabled={!canAlign}
          leftIcon={<AlignStartVertical size={15} />}
        >
          Align
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={8}
          // Focus the panel, not its first button, so no tooltip opens on
          // mount (an open tooltip would swallow the first Escape).
          onOpenAutoFocus={event => {
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
          className={`${OVERLAY_SURFACE} z-[60] p-3`}
        >
          <TooltipProvider>
            <div className="flex items-center gap-0.5">
              {ALIGN_ACTIONS.map(({ edge, title, Icon }) => (
                <Tooltip key={edge} content={title}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={ICON_BUTTON_CLASS}
                    aria-label={title}
                    onClick={() => align(edge)}
                  >
                    <Icon size={16} />
                  </Button>
                </Tooltip>
              ))}
            </div>
            <div className="mt-1 flex items-center gap-0.5">
              {DISTRIBUTE_ACTIONS.map(({ axis, title, Icon }) => (
                <DisableableTooltip
                  key={axis}
                  content={title}
                  disabled={!canDistribute}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={ICON_BUTTON_CLASS}
                    aria-label={title}
                    disabled={!canDistribute}
                    onClick={() => distribute(axis)}
                  >
                    <Icon size={16} />
                  </Button>
                </DisableableTooltip>
              ))}
            </div>
          </TooltipProvider>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
