'use client';

import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseNumberFieldOptions {
  /** Current numeric value (or undefined when empty). */
  value: number | undefined;
  /** Called with the resolved numeric value, or undefined when cleared (only if allowEmpty). */
  onChange: (value: number | undefined) => void;
  /** Minimum allowed value; enforced on blur. Also the fallback when a required field is left empty. */
  min?: number;
  /** Maximum allowed value; enforced on blur. */
  max?: number;
  /**
   * When true, clearing the field resolves to `undefined`.
   * When false (default), an emptied field falls back to `min ?? 0` on blur.
   */
  allowEmpty?: boolean;
  /** Parse as an integer (default) or a float. */
  integer?: boolean;
}

export interface NumberFieldBindings {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}

const clampNumber = (n: number, min?: number, max?: number): number => {
  let out = n;
  if (min !== undefined && out < min) out = min;
  if (max !== undefined && out > max) out = max;
  return out;
};

/**
 * Manages the string buffer for a controlled numeric input so the field can be
 * emptied mid-edit without snapping back to 0 (the classic `parseInt(v) || 0`
 * bug). Spread the returned bindings onto any `<input>` (raw or design-system).
 *
 * - While typing, the raw string is preserved (empty allowed).
 * - A parsed number is emitted on every valid keystroke.
 * - An emptied required field falls back to `min ?? 0` on blur; an emptied
 *   optional field (`allowEmpty`) resolves to `undefined`.
 * - Min/max are enforced on blur, not per keystroke, so intermediate values
 *   while typing aren't fought.
 */
export function useNumberField({
  value,
  onChange,
  min,
  max,
  allowEmpty = false,
  integer = true,
}: UseNumberFieldOptions): NumberFieldBindings {
  const [text, setText] = useState<string>(value == null ? '' : String(value));
  // The last value we emitted, so we can detect external (prop-driven) changes.
  const lastEmitted = useRef<number | undefined>(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      setText(value == null ? '' : String(value));
      lastEmitted.current = value;
    }
  }, [value]);

  const parse = useCallback(
    (raw: string): number | undefined => {
      if (raw === '' || raw === '-') return undefined;
      const n = integer ? parseInt(raw, 10) : parseFloat(raw);
      return Number.isNaN(n) ? undefined : n;
    },
    [integer]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Only accept a valid (possibly partial) numeric string.
      const pattern = integer ? /^-?\d*$/ : /^-?\d*\.?\d*$/;
      if (raw !== '' && !pattern.test(raw)) return;
      setText(raw);

      const parsed = parse(raw);
      if (parsed === undefined) {
        // Empty/partial — only propagate for optional fields; otherwise wait for blur.
        if (allowEmpty && lastEmitted.current !== undefined) {
          lastEmitted.current = undefined;
          onChange(undefined);
        }
        return;
      }
      // Emit the typed value as-is; clamping happens on blur so typing isn't fought.
      lastEmitted.current = parsed;
      onChange(parsed);
    },
    [parse, integer, allowEmpty, onChange]
  );

  const handleBlur = useCallback(() => {
    const parsed = parse(text);
    if (parsed === undefined) {
      if (allowEmpty) {
        setText('');
        if (lastEmitted.current !== undefined) {
          lastEmitted.current = undefined;
          onChange(undefined);
        }
      } else {
        const fallback = clampNumber(min ?? 0, min, max);
        setText(String(fallback));
        lastEmitted.current = fallback;
        onChange(fallback);
      }
      return;
    }
    const clamped = clampNumber(parsed, min, max);
    setText(String(clamped));
    if (clamped !== lastEmitted.current) {
      lastEmitted.current = clamped;
      onChange(clamped);
    }
  }, [text, parse, allowEmpty, min, max, onChange]);

  return { value: text, onChange: handleChange, onBlur: handleBlur };
}
