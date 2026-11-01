'use client';

import * as Popover from '@radix-ui/react-popover';
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

/** 640px and wider: a popover next to the trigger. */
export function PopoverShell({
  open,
  onOpenChange,
  trigger,
  ...panel
}: EditorShellProps | StructuredEditorShellProps) {
  return (
    // Modal: Tab stays inside, focus always goes back to the trigger, and a
    // tap outside only closes the editor instead of also pressing whatever
    // is under it.
    <Popover.Root open={open} onOpenChange={onOpenChange} modal>
      <Popover.Trigger asChild className={EDITABLE_ORNAMENT}>
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          data-anchored-editor="popover"
          aria-labelledby={panel.ids.label}
          side="bottom"
          sideOffset={8}
          collisionPadding={8}
          className={cn(
            OVERLAY_SURFACE,
            'z-50 w-72 max-w-[calc(100vw-1rem)] p-4',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-180 ease-out',
            'children' in panel &&
              'max-h-[var(--radix-popover-content-available-height)] overflow-y-auto'
          )}
          onOpenAutoFocus={event => {
            event.preventDefault();
            panel.fieldRef.current?.focus();
          }}
        >
          <PopoverPanel {...panel} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Mounted only while open, so the keyboard listener is too. */
function PopoverPanel(
  panel:
    | Omit<EditorShellProps, 'open' | 'onOpenChange' | 'trigger'>
    | Omit<StructuredEditorShellProps, 'open' | 'onOpenChange' | 'trigger'>
) {
  const keyboardInset = useKeyboardInset();
  if ('children' in panel)
    return (
      <div className="flex flex-col gap-3">
        <h2 id={panel.ids.label} className="type-label-heading text-heading">
          {panel.label}
        </h2>
        {panel.children}
      </div>
    );
  return (
    <EditorPanel
      {...panel}
      keyboardInset={keyboardInset}
      heading={
        <label
          id={panel.ids.label}
          htmlFor={panel.ids.field}
          className="type-label-heading text-heading"
        >
          {panel.label}
        </label>
      }
    />
  );
}
