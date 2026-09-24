'use client';

import { useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/utils/cn';

export interface SideDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name; rendered visually hidden. */
  title: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Runs when the drawer closes, before the default focus return. Call
   * `event.preventDefault()` to take over focus placement; otherwise focus
   * goes back to whatever was focused when the drawer opened (if that element
   * is still in the DOM).
   */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * Non-modal right-edge drawer. The page behind it (e.g. the battle map)
 * stays interactive: no overlay, no focus trap outside, no aria-hidden.
 * Escape closes; clicks outside do NOT close (the map is meant to be used).
 *
 * Radix's non-modal dialog only returns focus to a `Dialog.Trigger`, and this
 * drawer has none, so it remembers the element focused at open and restores
 * it on close.
 */
export function SideDrawer({
  open,
  onOpenChange,
  title,
  children,
  className,
  onCloseAutoFocus,
}: SideDrawerProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Fires before Radix moves focus into the drawer, so activeElement is still
  // the element the user opened it from.
  const handleOpenAutoFocus = () => {
    const active = document.activeElement;
    returnFocusRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
  };

  const handleCloseAutoFocus = (event: Event) => {
    onCloseAutoFocus?.(event);
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (target?.isConnected) target.focus();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          onInteractOutside={e => e.preventDefault()}
          onOpenAutoFocus={handleOpenAutoFocus}
          onCloseAutoFocus={handleCloseAutoFocus}
          aria-describedby={undefined}
          className={cn(
            'bg-surface-raised border-divider text-body fixed top-0 right-0 bottom-0 z-40 flex w-[min(580px,100vw)] flex-col border-l shadow-2xl xl:w-[min(640px,100vw)]',
            className
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {title}
          </DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
