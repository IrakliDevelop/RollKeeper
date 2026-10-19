/**
 * Input Component
 *
 * A flexible input component with support for labels, helper text, error states,
 * and prefix/suffix icons.
 */

'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { inputVariants, type InputVariants } from '../primitives/variants';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    InputVariants {
  /**
   * Label text for the input.
   */
  label?: string;
  /**
   * Helper text displayed below the input.
   */
  helperText?: string;
  /**
   * Error message displayed below the input.
   */
  error?: string;
  /**
   * Icon or element to display before the input text.
   */
  leftIcon?: React.ReactNode;
  /**
   * Icon or element to display after the input text.
   */
  rightIcon?: React.ReactNode;
  /**
   * If true, shows a clear button when input has value.
   */
  clearable?: boolean;
  /**
   * Callback when clear button is clicked.
   */
  onClear?: () => void;
  /**
   * Wrapper className for the input container.
   */
  wrapperClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      variant,
      size,
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      clearable = false,
      onClear,
      wrapperClassName,
      disabled,
      value,
      id,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const messageId = `${inputId}-message`;
    const message = error || helperText;
    const hasValue = value !== undefined && value !== '' && value !== null;
    const showClearButton = clearable && hasValue && !disabled;
    const inputVariant = error ? 'error' : variant;
    const isInvalid = ariaInvalid ?? (inputVariant === 'error' || undefined);
    const describedBy =
      [ariaDescribedBy, message ? messageId : undefined]
        .filter(Boolean)
        .join(' ') || undefined;

    return (
      <div className={cn('w-full', wrapperClassName)}>
        {label && (
          <label
            className="text-heading mb-1.5 block text-sm font-medium"
            htmlFor={inputId}
          >
            {label}
            {props.required && (
              <span className="text-blood-text ml-1" aria-label="required">
                *
              </span>
            )}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="text-muted pointer-events-none absolute top-1/2 left-3 flex -translate-y-1/2 items-center">
              {leftIcon}
            </div>
          )}

          <input
            type={type}
            className={cn(
              inputVariants({ variant: inputVariant, size }),
              leftIcon && 'pl-10',
              (rightIcon || showClearButton) && 'pr-10',
              className
            )}
            ref={ref}
            id={inputId}
            disabled={disabled}
            value={value}
            aria-invalid={isInvalid}
            aria-describedby={describedBy}
            {...props}
          />

          {showClearButton && (
            <button
              type="button"
              onClick={onClear}
              className="text-faint hover:text-body absolute top-1/2 right-3 flex -translate-y-1/2 items-center transition-colors"
              aria-label="Clear input"
              tabIndex={-1}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {rightIcon && !showClearButton && (
            <div className="text-muted pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center">
              {rightIcon}
            </div>
          )}
        </div>

        {message && (
          <p
            id={messageId}
            className={cn(
              'mt-1.5 text-sm',
              error ? 'text-blood-text' : 'text-body'
            )}
          >
            {message}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
