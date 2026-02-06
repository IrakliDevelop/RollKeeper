/**
 * Checkbox Component
 *
 * A flexible checkbox component built on Radix UI Checkbox primitive.
 * Supports labels, descriptions, sizes, variants, and indeterminate state.
 */

'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/utils/cn';

export interface CheckboxProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
    'checked'
  > {
  /**
   * Checkbox checked state.
   */
  checked?: boolean | 'indeterminate';
  /**
   * Callback when checked state changes.
   */
  onCheckedChange?: (checked: boolean) => void;
  /**
   * Label text for the checkbox.
   */
  label?: string;
  /**
   * Description text below the label.
   */
  description?: string;
  /**
   * Icon to display next to the label.
   */
  icon?: React.ReactNode;
  /**
   * Size variant.
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Color variant.
   */
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning';
  /**
   * Wrapper className for the checkbox container.
   */
  wrapperClassName?: string;
}

const sizeClasses = {
  sm: {
    checkbox: 'h-4 w-4',
    icon: 'h-3 w-3',
    text: 'text-sm',
    gap: 'gap-2',
  },
  md: {
    checkbox: 'h-5 w-5',
    icon: 'h-3.5 w-3.5',
    text: 'text-sm',
    gap: 'gap-3',
  },
  lg: {
    checkbox: 'h-6 w-6',
    icon: 'h-4 w-4',
    text: 'text-base',
    gap: 'gap-3',
  },
};

const variantClasses = {
  default: {
    unchecked: 'border-divider-strong bg-surface-raised',
    checked: 'border-gray-500 bg-gray-500',
    hover: 'hover:border-gray-500',
    checkIcon: 'text-white',
  },
  primary: {
    unchecked: 'border-divider-strong bg-surface-raised',
    checked: 'border-emerald-600 bg-emerald-600',
    hover: 'hover:border-emerald-500',
    checkIcon: 'text-white',
  },
  success: {
    unchecked: 'border-divider-strong bg-surface-raised',
    checked: 'border-green-600 bg-green-600',
    hover: 'hover:border-green-500',
    checkIcon: 'text-white',
  },
  danger: {
    unchecked: 'border-divider-strong bg-surface-raised',
    checked: 'border-red-600 bg-red-600',
    hover: 'hover:border-red-500',
    checkIcon: 'text-white',
  },
  warning: {
    unchecked: 'border-divider-strong bg-surface-raised',
    checked: 'border-amber-600 bg-amber-600',
    hover: 'hover:border-amber-500',
    checkIcon: 'text-white',
  },
};

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(
  (
    {
      className,
      checked = false,
      onCheckedChange,
      label,
      description,
      icon,
      disabled = false,
      size = 'md',
      variant = 'primary',
      wrapperClassName,
      ...props
    },
    ref
  ) => {
    const sizeStyle = sizeClasses[size];
    const variantStyle = variantClasses[variant];
    const isCheckedOrIndeterminate =
      checked === true || checked === 'indeterminate';

    return (
      <div
        className={cn(
          'group flex items-start',
          sizeStyle.gap,
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          wrapperClassName
        )}
        onClick={e => {
          // Only trigger when clicking label text, not the checkbox itself
          if (e.target !== e.currentTarget || disabled) {
            return;
          }
          // Toggle the checkbox when clicking the label text
          const newValue = checked === true ? false : true;
          onCheckedChange?.(newValue);
        }}
      >
        <CheckboxPrimitive.Root
          ref={ref}
          className={cn(
            sizeStyle.checkbox,
            'relative flex shrink-0 items-center justify-center overflow-hidden rounded border-2 transition-all duration-200',
            'focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:outline-none',
            isCheckedOrIndeterminate
              ? variantStyle.checked
              : variantStyle.unchecked,
            !disabled && variantStyle.hover,
            !disabled && 'group-hover:shadow-md',
            className
          )}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          {...props}
        >
          {/* Background glow effect */}
          {isCheckedOrIndeterminate && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.3 }}
              className="absolute inset-0 rounded bg-white"
            />
          )}

          {/* Check/Indeterminate Icon */}
          <AnimatePresence mode="wait">
            {isCheckedOrIndeterminate && (
              <CheckboxPrimitive.Indicator asChild>
                <motion.div
                  key={checked === 'indeterminate' ? 'minus' : 'check'}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className={cn(
                    sizeStyle.icon,
                    variantStyle.checkIcon,
                    'relative z-10'
                  )}
                >
                  {checked === 'indeterminate' ? (
                    <Minus className={sizeStyle.icon} strokeWidth={3} />
                  ) : (
                    <Check className={sizeStyle.icon} strokeWidth={3} />
                  )}
                </motion.div>
              </CheckboxPrimitive.Indicator>
            )}
          </AnimatePresence>
        </CheckboxPrimitive.Root>

        {/* Label and Description */}
        {(label || description || icon) && (
          <div className="min-w-0 flex-1">
            {(label || icon) && (
              <div className="flex items-center gap-2">
                {icon && (
                  <span
                    className={cn(
                      'text-muted flex-shrink-0 transition-colors',
                      !disabled && checked && 'text-emerald-500'
                    )}
                  >
                    {icon}
                  </span>
                )}
                {label && (
                  <span
                    className={cn(
                      sizeStyle.text,
                      'text-heading font-medium transition-colors',
                      !disabled && 'group-hover:text-body'
                    )}
                  >
                    {label}
                  </span>
                )}
              </div>
            )}
            {description && (
              <p
                className={cn(
                  'text-body mt-1 text-xs transition-colors',
                  !disabled && 'group-hover:text-muted'
                )}
              >
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
