/**
 * Textarea Component
 *
 * A flexible textarea component with support for labels, helper text, error states,
 * auto-resize, and character count.
 */

'use client';

import * as React from 'react';
import { cn } from '@/utils/cn';
import { inputVariants, type InputVariants } from '../primitives/variants';

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>,
    Omit<InputVariants, 'size'> {
  /**
   * Label text for the textarea.
   */
  label?: string;
  /**
   * Helper text displayed below the textarea.
   */
  helperText?: string;
  /**
   * Error message displayed below the textarea.
   */
  error?: string;
  /**
   * If true, textarea height adjusts automatically based on content.
   */
  autoResize?: boolean;
  /**
   * Maximum height when auto-resize is enabled (in pixels).
   */
  maxHeight?: number;
  /**
   * If true, shows character count below the textarea.
   */
  showCharacterCount?: boolean;
  /**
   * Wrapper className for the textarea container.
   */
  wrapperClassName?: string;
  /**
   * Size variant for the textarea padding.
   */
  size?: 'sm' | 'md' | 'lg';
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      variant,
      size = 'md',
      label,
      helperText,
      error,
      autoResize = false,
      maxHeight = 300,
      showCharacterCount = false,
      wrapperClassName,
      disabled,
      value,
      maxLength,
      rows = 3,
      onChange,
      ...props
    },
    ref
  ) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const textareaVariant = error ? 'error' : variant;
    const characterCount = typeof value === 'string' ? value.length : 0;

    // Handle auto-resize
    React.useEffect(() => {
      if (autoResize && textareaRef.current) {
        const textarea = textareaRef.current;
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = `${newHeight}px`;
      }
    }, [value, autoResize, maxHeight]);

    // Combined ref handler
    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref]
    );

    return (
      <div className={cn('w-full', wrapperClassName)}>
        {label && (
          <label
            className="text-heading mb-1.5 block text-sm font-medium"
            htmlFor={props.id}
          >
            {label}
            {props.required && (
              <span className="ml-1 text-red-500" aria-label="required">
                *
              </span>
            )}
          </label>
        )}

        <textarea
          className={cn(
            inputVariants({ variant: textareaVariant }),
            'min-h-[80px] resize-none',
            !autoResize && 'resize-y',
            autoResize && 'overflow-hidden',
            // Size-specific padding
            size === 'sm' && 'px-3 py-2 text-sm',
            size === 'md' && 'px-3 py-2.5 text-sm',
            size === 'lg' && 'px-4 py-3 text-base',
            className
          )}
          ref={setRefs}
          disabled={disabled}
          value={value}
          maxLength={maxLength}
          rows={rows}
          onChange={onChange}
          {...props}
        />

        <div className="mt-1.5 flex items-center justify-between gap-2">
          {(error || helperText) && (
            <p
              className={cn(
                'text-sm',
                error ? 'text-red-600 dark:text-red-400' : 'text-body'
              )}
            >
              {error || helperText}
            </p>
          )}

          {showCharacterCount && (
            <p
              className={cn(
                'text-body ml-auto text-sm',
                maxLength &&
                  characterCount > maxLength * 0.9 &&
                  'text-amber-600',
                maxLength && characterCount >= maxLength && 'text-red-600'
              )}
              aria-live="polite"
            >
              {characterCount}
              {maxLength && ` / ${maxLength}`}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
