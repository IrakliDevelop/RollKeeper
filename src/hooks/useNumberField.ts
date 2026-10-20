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
  /**
   * When true (default), every valid keystroke calls `onChange`. When false
   * the typed text is a draft: `onChange` runs only from `commit()` (and
   * blur), and `cancel()` throws the draft away. While a draft differs from
   * the value, a new `value` prop doesn't overwrite it.
   */
  live?: boolean;
}

/** Where the typed text stands against the field's rules. */
export type NumberFieldValidity = 'valid' | 'empty' | 'below' | 'above';

export interface NumberFieldBindings {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  /** Resolves the text (empty fallback, clamp), sends it and returns it. */
  commit: () => number | undefined;
  /** Puts the text back to the current value without sending anything. */
  cancel: () => void;
  /** Adds `delta` to the typed (or current) value, clamped to min/max. */
  step: (delta: number) => void;
  /** The typed text as a number, or undefined while it is empty or "-". */
  draft: number | undefined;
  validity: NumberFieldValidity;
}

const clampNumber = (n: number, min?: number, max?: number): number => {
  let out = n;
  if (min !== undefined && out < min) out = min;
  if (max !== undefined && out > max) out = max;
  return out;
};

const toText = (value: number | undefined): string =>
  value == null ? '' : String(value);

/**
 * Manages the string buffer for a controlled numeric input so the field can be
 * emptied mid-edit without snapping back to 0 (the classic `parseInt(v) || 0`
 * bug). Spread the returned bindings onto any `<input>` (raw or design-system).
 *
 * - While typing, the raw string is preserved (empty allowed).
 * - A parsed number is emitted on every valid keystroke (unless `live` is
 *   false, see above).
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
  live = true,
}: UseNumberFieldOptions): NumberFieldBindings {
  const [text, setTextState] = useState<string>(toText(value));
  // The text as of the latest change, readable before React re-renders
  // (a step followed by a commit in the same handler).
  const textRef = useRef(text);
  // The last value we emitted, so we can detect external (prop-driven) changes.
  const lastEmitted = useRef<number | undefined>(value);
  // Draft mode: the player has typed or stepped since the last commit/cancel.
  const dirty = useRef(false);

  const setText = useCallback((next: string) => {
    textRef.current = next;
    setTextState(next);
  }, []);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    // Keep a draft the player is still typing; commit compares against the
    // new value, so the draft is still sent.
    if (!live && dirty.current) return;
    setText(toText(value));
  }, [value, live, setText]);

  const parse = useCallback(
    (raw: string): number | undefined => {
      if (raw === '' || raw === '-') return undefined;
      const n = integer ? parseInt(raw, 10) : parseFloat(raw);
      return Number.isNaN(n) ? undefined : n;
    },
    [integer]
  );

  const emit = useCallback(
    (next: number | undefined) => {
      if (next === lastEmitted.current) return;
      lastEmitted.current = next;
      onChange(next);
    },
    [onChange]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Only accept a valid (possibly partial) numeric string.
      const pattern = integer ? /^-?\d*$/ : /^-?\d*\.?\d*$/;
      if (raw !== '' && !pattern.test(raw)) return;
      setText(raw);
      if (!live) {
        dirty.current = true;
        return;
      }

      const parsed = parse(raw);
      if (parsed === undefined) {
        // Empty/partial — only propagate for optional fields; otherwise wait for blur.
        if (allowEmpty) emit(undefined);
        return;
      }
      // Emit the typed value as-is; clamping happens on blur so typing isn't fought.
      lastEmitted.current = parsed;
      onChange(parsed);
    },
    [parse, integer, allowEmpty, live, emit, onChange, setText]
  );

  const commit = useCallback((): number | undefined => {
    dirty.current = false;
    const parsed = parse(textRef.current);
    if (parsed === undefined) {
      if (allowEmpty) {
        setText('');
        emit(undefined);
        return undefined;
      }
      const fallback = clampNumber(min ?? 0, min, max);
      setText(String(fallback));
      // Always send the fallback, even if it equals the last value: the
      // parent may hold a stale number while the field showed nothing.
      lastEmitted.current = fallback;
      onChange(fallback);
      return fallback;
    }
    const clamped = clampNumber(parsed, min, max);
    setText(String(clamped));
    emit(clamped);
    return clamped;
  }, [parse, allowEmpty, min, max, emit, onChange, setText]);

  const cancel = useCallback(() => {
    dirty.current = false;
    setText(toText(value));
    lastEmitted.current = value;
  }, [value, setText]);

  const step = useCallback(
    (delta: number) => {
      const base = parse(textRef.current) ?? value ?? min ?? 0;
      const next = clampNumber(base + delta, min, max);
      setText(String(next));
      if (live) emit(next);
      else dirty.current = true;
    },
    [parse, value, min, max, live, emit, setText]
  );

  const parsedText = parse(text);
  const validity: NumberFieldValidity =
    parsedText === undefined
      ? 'empty'
      : min !== undefined && parsedText < min
        ? 'below'
        : max !== undefined && parsedText > max
          ? 'above'
          : 'valid';

  const handleBlur = useCallback(() => {
    commit();
  }, [commit]);

  return {
    value: text,
    onChange: handleChange,
    onBlur: handleBlur,
    commit,
    cancel,
    step,
    draft: parsedText,
    validity,
  };
}
