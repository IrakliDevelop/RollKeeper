'use client';

import * as React from 'react';
import { cn } from '@/utils/cn';
import {
  useSelectOnFocus,
  useSupportsFieldSizing,
} from '../InPlaceField/InPlaceField.hooks';

export interface InPlaceTextFieldProps {
  value: string;
  onCommit: (value: string) => void;
  label: string;
  editing: boolean;
  placeholder?: string;
  className?: string;
}

const BOX = 'inline-block min-w-[2ch] max-w-full break-words';

/** A build value with a local draft; Enter/blur commits and Escape cancels. */
export function InPlaceTextField({
  value,
  onCommit,
  label,
  editing,
  placeholder,
  className,
}: InPlaceTextFieldProps) {
  const [state, setState] = React.useState({ value, editing, draft: value });
  const changed = React.useRef(false);
  const selectOnFocus = useSelectOnFocus();
  const fieldSizing = useSupportsFieldSizing();
  if (state.value !== value || state.editing !== editing) {
    const modeChanged = state.editing !== editing;
    const keepDraft =
      !modeChanged && changed.current && state.draft !== state.value;
    setState({ value, editing, draft: keepDraft ? state.draft : value });
    if (modeChanged) changed.current = false;
  }
  const draft = state.draft;
  const cancel = () => {
    changed.current = false;
    setState({ value, editing, draft: value });
  };
  const commit = () => {
    if (changed.current && draft !== value) onCommit(draft);
    changed.current = false;
  };
  if (!editing) return <span className={cn(BOX, className)}>{value}</span>;
  return (
    <label className="relative inline-block max-w-full after:absolute after:top-1/2 after:left-1/2 after:size-full after:min-h-6 after:min-w-6 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11">
      <input
        type="text"
        aria-label={label}
        placeholder={placeholder}
        value={draft}
        style={
          fieldSizing
            ? undefined
            : {
                width: `${Math.max(2, draft.length || placeholder?.length || 0)}ch`,
              }
        }
        className={cn(
          BOX,
          'relative z-[1] m-0 [field-sizing:content] rounded-none border-0 bg-transparent p-0 [text-align:inherit] text-inherit shadow-[inset_0_-1.5px_0_var(--input-border)] outline-hidden transition-shadow duration-120 ease-out [font:inherit] focus:shadow-[inset_0_-2px_0_var(--ring)] pointer-coarse:text-[length:max(16px,1em)]',
          className
        )}
        data-in-place-dirty={draft !== value ? '' : undefined}
        onFocus={selectOnFocus}
        onChange={event => {
          changed.current = true;
          setState({ value, editing, draft: event.target.value });
        }}
        onBlur={commit}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') cancel();
        }}
      />
    </label>
  );
}
