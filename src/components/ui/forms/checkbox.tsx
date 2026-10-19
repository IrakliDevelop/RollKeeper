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
   * @deprecated Every variant is brass when checked. Kept so call sites
   * compile.
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

// Felt and Brass: brass fill with an on-brass mark when checked, an
// input-border outline when not. The variants are deprecated aliases.
const BRASS_BOX =
  'border-input-border data-[state=checked]:border-brass-fill data-[state=checked]:bg-brass-fill data-[state=indeterminate]:border-brass-fill data-[state=indeterminate]:bg-brass-fill';

const variantClasses = {
  default: BRASS_BOX,
  primary: BRASS_BOX,
  success: BRASS_BOX,
  danger: BRASS_BOX,
  warning: BRASS_BOX,
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
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    // The label and description are spans beside the Radix button, not a
    // <label>, so name and describe the button by id.
    const textId = React.useId();
    const labelId = label ? `${textId}-label` : undefined;
    const descriptionId = description ? `${textId}-description` : undefined;
    const sizeStyle = sizeClasses[size];
    const variantStyle = variantClasses[variant];
    const isCheckedOrIndeterminate =
      checked === true || checked === 'indeterminate';

    return (
      <div
        className={cn(
          'group flex items-start',
          // On touch a labelled row is at least 44px and keeps the box's 44px
          // hit area inside it, so stacked rows don't overlap: a one-line row
          // centres the box, a described row pads its top instead so the box
          // stays beside the label.
          (label || description || icon) && 'pointer-coarse:min-h-11',
          (label || icon) && !description && 'pointer-coarse:items-center',
          description && 'pointer-coarse:pt-3',
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
            'relative flex shrink-0 items-center justify-center rounded-sm border bg-transparent transition-colors duration-120 ease-out',
            'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
            // 44px hit area on touch, same visual size.
            'after:absolute after:top-1/2 after:left-1/2 after:-translate-1/2 pointer-coarse:after:size-11',
            variantStyle,
            className
          )}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-labelledby={
            ariaLabelledBy ?? (props['aria-label'] ? undefined : labelId)
          }
          aria-describedby={
            [ariaDescribedBy, descriptionId].filter(Boolean).join(' ') ||
            undefined
          }
          {...props}
        >
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
                  className={cn(sizeStyle.icon, 'text-on-brass')}
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
                      !disabled && checked && 'text-brass-text'
                    )}
                  >
                    {icon}
                  </span>
                )}
                {label && (
                  <span
                    id={labelId}
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
                id={descriptionId}
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
