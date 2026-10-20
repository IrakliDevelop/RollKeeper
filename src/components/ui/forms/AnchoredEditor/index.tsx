/**
 * AnchoredEditor
 *
 * Edits a number that sits inside an ornament (medallion, AC shield) or in
 * too little room for an InPlaceField. From 640px it is a popover next to
 * its trigger; narrower, a bottom sheet. Both hold a labelled field, −/+
 * steppers (44px on touch), optional context, and Save/Cancel. Enter saves
 * (clamped), Escape, Cancel or a tap outside discards the draft, and focus
 * goes back to the trigger. In edit mode the trigger shows a dashed cue.
 */

'use client';

import * as React from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useNumberField } from '@/hooks/useNumberField';
import type { AnchoredEditorProps } from './AnchoredEditor.types';
import { PopoverShell } from './PopoverShell';
import { SheetShell } from './SheetShell';

export type { AnchoredEditorProps } from './AnchoredEditor.types';

export function AnchoredEditor({
  label,
  value,
  onSave,
  editing,
  min,
  max,
  integer = true,
  context,
  children,
}: AnchoredEditorProps) {
  const wide = useMediaQuery('(min-width: 640px)');
  const [open, setOpen] = React.useState(false);
  // Leaving edit mode closes the editor, so it doesn't reopen by itself
  // the next time edit mode starts.
  const [wasEditing, setWasEditing] = React.useState(editing);
  if (editing !== wasEditing) {
    setWasEditing(editing);
    if (!editing) setOpen(false);
  }
  const fieldRef = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const ids = {
    field: `${id}-field`,
    label: `${id}-label`,
    message: `${id}-message`,
  };
  const field = useNumberField({
    value,
    onChange: next => {
      if (next !== undefined) onSave(next);
    },
    min,
    max,
    integer,
    live: false,
  });

  if (!editing) return children;

  // Opening starts from the saved value; any other close throws the draft away.
  const handleOpenChange = (next: boolean) => {
    field.cancel();
    setOpen(next);
  };

  const handleSave = () => {
    if (field.validity === 'empty') field.cancel();
    else field.commit();
    setOpen(false);
  };

  const Shell = wide ? PopoverShell : SheetShell;
  return (
    <Shell
      open={open}
      onOpenChange={handleOpenChange}
      trigger={children}
      label={label}
      ids={ids}
      field={field}
      fieldRef={fieldRef}
      min={min}
      max={max}
      integer={integer}
      context={context}
      onSave={handleSave}
      onCancel={() => handleOpenChange(false)}
    />
  );
}
