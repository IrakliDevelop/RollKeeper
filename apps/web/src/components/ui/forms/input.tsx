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
      ...props
    },
    ref
  ) => {
    const hasValue = value !== undefined && value !== '' && value !== null;
    const showClearButton = clearable && hasValue && !disabled;
    const inputVariant = error ? 'error' : variant;

    return (
      <div className={cn('w-full', wrapperClassName)}>
        {label && (
          <label
            className="mb-1.5 block text-sm font-medium text-gray-800"
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
        
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-gray-500">
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
            disabled={disabled}
            value={value}
            {...props}
          />
          
          {showClearButton && (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-gray-400 transition-colors hover:text-gray-600"
              aria-label="Clear input"
              tabIndex={-1}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          
          {rightIcon && !showClearButton && (
            <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-gray-500">
              {rightIcon}
            </div>
          )}
        </div>
        
        {(error || helperText) && (
          <p
            className={cn(
              'mt-1.5 text-sm',
              error ? 'text-red-600' : 'text-gray-600'
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
