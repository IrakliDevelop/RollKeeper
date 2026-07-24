/**
 * NumberInput Component
 *
 * A numeric wrapper around the design-system `Input`. Unlike a raw controlled
 * `<Input type="number" onChange={e => set(parseInt(e.target.value) || 0)} />`,
 * this keeps a string buffer while editing so the field can be cleared without
 * snapping back to 0, and it clamps to min/max on blur.
 *
 * Props mirror `Input`, except `value`/`onChange` are numeric:
 *   value:    number | undefined
 *   onChange: (value: number | undefined) => void
 */

'use client';

import * as React from 'react';
import { Input, type InputProps } from './input';
import { useNumberField } from '@/hooks/useNumberField';

export interface NumberInputProps
  extends Omit<InputProps, 'value' | 'onChange' | 'defaultValue' | 'type'> {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** When true, an emptied field resolves to `undefined` instead of `min ?? 0`. */
  allowEmpty?: boolean;
  /** Parse as an integer (default) or a float. */
  integer?: boolean;
}

const toNumber = (v: string | number | undefined): number | undefined =>
  v === undefined || v === '' ? undefined : Number(v);

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      value,
      onChange,
      min,
      max,
      allowEmpty = false,
      integer = true,
      inputMode,
      onBlur,
      ...props
    },
    ref
  ) => {
    const field = useNumberField({
      value,
      onChange,
      min: toNumber(min),
      max: toNumber(max),
      allowEmpty,
      integer,
    });

    return (
      <Input
        ref={ref}
        type="text"
        inputMode={inputMode ?? (integer ? 'numeric' : 'decimal')}
        {...props}
        value={field.value}
        onChange={field.onChange}
        onBlur={e => {
          field.onBlur();
          onBlur?.(e);
        }}
      />
    );
  }
);

NumberInput.displayName = 'NumberInput';

/**
 * Bare numeric input — a plain `<input>` (no design-system chrome) with the same
 * clear-safe numeric behavior. Use this to migrate raw `<input type="number">`
 * elements that carry bespoke styling: pass their existing `className` and props
 * through unchanged. Safe to render inside loops (it's a component, not a hook).
 */
export interface NumberFieldProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'defaultValue' | 'type'
  > {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  allowEmpty?: boolean;
  integer?: boolean;
}

export const NumberField = React.forwardRef<HTMLInputElement, NumberFieldProps>(
  (
    {
      value,
      onChange,
      min,
      max,
      allowEmpty = false,
      integer = true,
      inputMode,
      onBlur,
      ...props
    },
    ref
  ) => {
    const field = useNumberField({
      value,
      onChange,
      min: toNumber(min),
      max: toNumber(max),
      allowEmpty,
      integer,
    });

    return (
      <input
        ref={ref}
        type="text"
        inputMode={inputMode ?? (integer ? 'numeric' : 'decimal')}
        {...props}
        value={field.value}
        onChange={field.onChange}
        onBlur={e => {
          field.onBlur();
          onBlur?.(e);
        }}
      />
    );
  }
);

NumberField.displayName = 'NumberField';
