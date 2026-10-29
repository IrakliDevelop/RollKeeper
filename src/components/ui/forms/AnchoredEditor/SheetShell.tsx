'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  EDITABLE_ORNAMENT,
  OVERLAY_SURFACE,
} from '@/components/ui/primitives/variants';
import { cn } from '@/utils/cn';
import { useKeyboardInset } from './AnchoredEditor.hooks';
import type {
  EditorShellProps,
  StructuredEditorShellProps,
} from './AnchoredEditor.types';
import { EditorPanel } from './EditorPanel';

/**
 * Narrower than 640px: a bottom sheet. It clears the home indicator and
 * rises above the on-screen keyboard. The trigger is the dialog's trigger,
 * so focus goes back to it on close.
 */
export function SheetShell({
  open,
  onOpenChange,
  trigger,
  ...panel
}: EditorShellProps | StructuredEditorShellProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild className={EDITABLE_ORNAMENT}>
        {trigger}
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'bg-surface-overlay fixed inset-0 z-50',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-180 ease-out'
          )}
        />
        <SheetContent {...panel} />
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SheetContent(
  panel:
    | Omit<EditorShellProps, 'open' | 'onOpenChange' | 'trigger'>
    | Omit<StructuredEditorShellProps, 'open' | 'onOpenChange' | 'trigger'>
) {
  const keyboardInset = useKeyboardInset();
  return (
    <DialogPrimitive.Content
      data-anchored-editor="sheet"
      aria-describedby={undefined}
      style={{
        bottom: keyboardInset,
        ...('children' in panel
          ? { maxHeight: `calc(100dvh - ${keyboardInset}px - 2rem)` }
          : {}),
      }}
      className={cn(
        OVERLAY_SURFACE,
        'fixed inset-x-0 bottom-0 z-50 rounded-b-none border-x-0 border-b-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        'duration-180 ease-out',
        'focus:outline-none',
        'children' in panel && 'overflow-y-auto'
      )}
      onOpenAutoFocus={event => {
        event.preventDefault();
        panel.fieldRef.current?.focus();
      }}
    >
      {'children' in panel ? (
        <div className="flex flex-col gap-3">
          <DialogPrimitive.Title className="type-label-heading text-heading">
            {panel.label}
          </DialogPrimitive.Title>
          {panel.children}
        </div>
      ) : (
        <EditorPanel
          {...panel}
          keyboardInset={keyboardInset}
          heading={
            // The title supplies the id the sheet is labelled by.
            <DialogPrimitive.Title asChild>
              <label
                htmlFor={panel.ids.field}
                className="type-label-heading text-heading"
              >
                {panel.label}
              </label>
            </DialogPrimitive.Title>
          }
        />
      )}
    </DialogPrimitive.Content>
  );
}
