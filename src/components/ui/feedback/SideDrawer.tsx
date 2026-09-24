'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/utils/cn';

export interface SideDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name; rendered visually hidden. */
  title: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Non-modal right-edge drawer. The page behind it (e.g. the battle map)
 * stays interactive: no overlay, no focus trap outside, no aria-hidden.
 * Escape closes; clicks outside do NOT close (the map is meant to be used).
 */
export function SideDrawer({
  open,
  onOpenChange,
  title,
  children,
  className,
}: SideDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          onInteractOutside={e => e.preventDefault()}
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
