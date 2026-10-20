/**
 * Dialog Component
 *
 * A unified dialog/modal component built on Radix UI Dialog primitive.
 * Supports multiple sizes, variants, and accessibility features.
 */

'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { cn } from '@/utils/cn';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'bg-surface-overlay fixed inset-0 z-50',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      'duration-180 ease-out',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /**
   * Size variant for the dialog.
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /**
   * If false, hides the close button.
   */
  showCloseButton?: boolean;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-[95vw]',
};

/**
 * Remembers what had focus when the dialog opened and puts focus back there
 * when it closes. Radix only returns focus to a `DialogTrigger`, so a
 * controlled dialog opened from a plain button would otherwise drop focus
 * on the page. Skipped when the caller's handler already prevented the
 * default, when the opener has gone, or when focus has already moved
 * somewhere else (a click outside a non-modal dialog).
 */
function useReturnFocus(
  onCloseAutoFocus: DialogContentProps['onCloseAutoFocus']
) {
  const openerRef = React.useRef<HTMLElement | null>(null);

  const captureOpener = React.useCallback((opener: HTMLElement | null) => {
    openerRef.current = opener;
  }, []);

  const handleCloseAutoFocus = (event: Event) => {
    const opener = openerRef.current;
    openerRef.current = null;
    onCloseAutoFocus?.(event);
    if (event.defaultPrevented) return;
    const active = document.activeElement;
    if (!opener?.isConnected || opener === document.body) return;
    if (active && active !== document.body) return;
    event.preventDefault();
    opener.focus();
  };

  return { captureOpener, handleCloseAutoFocus };
}

/**
 * Rendered first inside the content, so its layout effect reads the focused
 * element before Radix moves focus in and before a child's `autoFocus`
 * runs (Radix skips `onOpenAutoFocus` when focus is already inside).
 */
function OpenerCapture({
  onCapture,
}: {
  onCapture: (opener: HTMLElement | null) => void;
}) {
  React.useLayoutEffect(() => {
    const active = document.activeElement;
    onCapture(active instanceof HTMLElement ? active : null);
  }, [onCapture]);
  return null;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      size = 'lg',
      showCloseButton = true,
      onCloseAutoFocus,
      ...props
    },
    ref
  ) => {
    const { captureOpener, handleCloseAutoFocus } =
      useReturnFocus(onCloseAutoFocus);

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            OVERLAY_SURFACE,
            'fixed top-[50%] left-[50%] z-50 flex max-h-[90vh] w-full translate-x-[-50%] translate-y-[-50%] flex-col gap-4 p-6',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'duration-180 ease-out',
            'focus:outline-none',
            sizeClasses[size],
            className
          )}
          onCloseAutoFocus={handleCloseAutoFocus}
          {...props}
        >
          <OpenerCapture onCapture={captureOpener} />
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted hover:text-heading absolute top-4 right-4 min-h-[44px] min-w-[44px] p-0"
              >
                <X className="h-4 w-4" aria-hidden />
                <span className="sr-only">Close</span>
              </Button>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  }
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-2 text-left', className)}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('type-heading text-heading', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-body text-sm', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

const DialogBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex-1 overflow-y-auto', className)}
    {...props}
  />
));
DialogBody.displayName = 'DialogBody';

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogBody,
};
