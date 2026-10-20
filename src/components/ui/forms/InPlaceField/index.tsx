/**
 * InPlaceField
 *
 * A number edited where it is shown. The input takes the surrounding text's
 * font, size, colour and alignment, so nothing moves when it gains focus;
 * the only cue is an underline drawn inside the box (1.5px input-border at
 * rest, 2px brass when focused, 2px blood while the draft is empty or out of
 * range). Enter commits (clamped), blur commits what was typed or stepped,
 * Escape cancels, ↑/↓ step by 1 and Shift+↑/↓ by 10. In play mode it is plain
 * text with no tab stop.
 */

'use client';

import * as React from 'react';
import { cn } from '@/utils/cn';
import { useNumberField } from '@/hooks/useNumberField';
import { numberFieldMessage } from '@/utils/numberFieldMessage';
import { useSelectOnFocus, useSupportsFieldSizing } from './InPlaceField.hooks';

export interface InPlaceFieldProps {
  value: number;
  /** Called with the clamped value when an edit is committed. */
  onCommit: (value: number) => void;
  /** Accessible name, e.g. "Speed". */
  label: string;
  /** Edit mode shows the field; play mode shows plain text. */
  editing: boolean;
  min?: number;
  max?: number;
  /** Parse as an integer (default) or a decimal. */
  integer?: boolean;
  className?: string;
}

/** Shared by both modes so switching modes doesn't shift the line. */
const BOX = 'inline-block min-w-[2ch] tabular-nums';

const FIELD = cn(
  BOX,
  // relative z-[1] keeps the field above its label's ::after, so taps on
  // the digits still place the caret.
  'relative z-[1] m-0 rounded-none border-0 bg-transparent p-0 text-inherit [font:inherit] [text-align:inherit] [field-sizing:content]',
  'shadow-[inset_0_-1.5px_0_var(--input-border)] outline-hidden transition-shadow duration-120 ease-out',
  'focus:shadow-[inset_0_-2px_0_var(--ring)]',
  'aria-invalid:shadow-[inset_0_-2px_0_var(--blood-border)]',
  'pointer-coarse:text-[length:max(16px,1em)]'
);

/**
 * The label wraps the field without changing its box; its centred ::after
 * is the tap target, at least 24px (44px on touch). Tapping a label
 * focuses its field.
 */
const HIT_AREA = cn(
  // The field's [font:inherit] resets font-variant-numeric after BOX's
  // tabular-nums, so the label carries it for the field to inherit.
  'relative inline-block tabular-nums',
  "after:absolute after:top-1/2 after:left-1/2 after:size-full after:min-h-6 after:min-w-6 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
  'pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11'
);

export function InPlaceField({
  value,
  onCommit,
  label,
  editing,
  min,
  max,
  integer = true,
  className,
}: InPlaceFieldProps) {
  const messageId = React.useId();
  const fieldSizing = useSupportsFieldSizing();
  const selectOnFocus = useSelectOnFocus();
  const [wasEditing, setWasEditing] = React.useState(editing);
  const field = useNumberField({
    value,
    onChange: next => {
      if (next !== undefined) onCommit(next);
    },
    min,
    max,
    integer,
    live: false,
  });

  // Leaving edit mode without a blur drops the draft, so the next edit
  // starts from the value and sync updates reach the text again.
  if (editing !== wasEditing) {
    setWasEditing(editing);
    if (!editing) field.cancel();
  }

  if (!editing) {
    return <span className={cn(BOX, className)}>{value}</span>;
  }

  const settle = () => {
    if (field.validity === 'empty') field.cancel();
    else field.commit();
  };

  // Tabbing through a field the player didn't touch saves nothing, so a
  // stored value that is out of range isn't clamped by passing over it.
  const handleBlur = () => {
    if (field.value === String(value)) field.cancel();
    else settle();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      settle();
    } else if (event.key === 'Escape') {
      field.cancel();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const size = event.shiftKey ? 10 : 1;
      field.step(event.key === 'ArrowUp' ? size : -size);
    }
  };

  const message = numberFieldMessage(field.validity, min, max);

  return (
    <>
      <label className={HIT_AREA}>
        <input
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          aria-label={label}
          aria-invalid={message ? true : undefined}
          aria-describedby={messageId}
          className={cn(FIELD, className)}
          style={fieldSizing ? undefined : { width: `${field.value.length}ch` }}
          value={field.value}
          onChange={field.onChange}
          onFocus={selectOnFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      </label>
      <span id={messageId} role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}
