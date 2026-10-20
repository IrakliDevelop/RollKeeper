'use client';

import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { inputVariants } from '@/components/ui/primitives/variants';
import { cn } from '@/utils/cn';
import { numberFieldMessage } from '@/utils/numberFieldMessage';
import { useSelectOnFocus } from '../InPlaceField/InPlaceField.hooks';
import { useKeepInView } from './AnchoredEditor.hooks';
import type { EditorShellProps } from './AnchoredEditor.types';

type EditorPanelProps = Omit<
  EditorShellProps,
  'open' | 'onOpenChange' | 'trigger'
> & {
  /** The visible label; the sheet wraps it in its dialog title. */
  heading: React.ReactNode;
  keyboardInset: number;
};

/**
 * A stepper at its bound is aria-disabled, not disabled: a disabled button
 * drops keyboard focus to the page. Stepping past a bound is a no-op anyway.
 */
const STEPPER =
  'w-9 shrink-0 p-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

/** The field, steppers, context and Save/Cancel shared by both shells. */
export function EditorPanel({
  heading,
  label,
  ids,
  field,
  fieldRef,
  min,
  max,
  integer,
  context,
  keyboardInset,
  onSave,
  onCancel,
}: EditorPanelProps) {
  const selectOnFocus = useSelectOnFocus();
  useKeepInView(fieldRef, keyboardInset);

  const draft = field.draft;
  const message = numberFieldMessage(field.validity, min, max);
  const atMin = min !== undefined && draft !== undefined && draft <= min;
  const atMax = max !== undefined && draft !== undefined && draft >= max;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSave();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const size = event.shiftKey ? 10 : 1;
      field.step(event.key === 'ArrowUp' ? size : -size);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {heading}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={STEPPER}
            aria-label={`Decrease ${label}`}
            aria-disabled={atMin || undefined}
            onClick={() => field.step(-1)}
          >
            <Minus className="h-4 w-4" aria-hidden />
          </Button>
          <input
            ref={fieldRef}
            id={ids.field}
            type="text"
            inputMode={integer ? 'numeric' : 'decimal'}
            aria-invalid={message ? true : undefined}
            aria-describedby={ids.message}
            className={cn(
              inputVariants({ variant: message ? 'error' : 'default' }),
              'type-num-md min-w-0 flex-1 text-center'
            )}
            value={field.value}
            onChange={field.onChange}
            onFocus={selectOnFocus}
            onKeyDown={handleKeyDown}
          />
          <Button
            variant="outline"
            size="sm"
            className={STEPPER}
            aria-label={`Increase ${label}`}
            aria-disabled={atMax || undefined}
            onClick={() => field.step(1)}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <p
          id={ids.message}
          role="status"
          className="type-small text-blood-text"
        >
          {message}
        </p>
      </div>
      {typeof context === 'function' ? context(draft) : context}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={onSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
