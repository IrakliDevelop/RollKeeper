/**
 * Switch Component
 *
 * A toggle switch component built on Radix UI Switch primitive.
 * Supports labels, descriptions, sizes, and variants.
 */

'use client';

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@/utils/cn';

export interface SwitchProps extends React.ComponentPropsWithoutRef<
  typeof SwitchPrimitives.Root
> {
  /**
   * Label text for the switch.
   */
  label?: string;
  /**
   * Description text below the label.
   */
  description?: string;
  /**
   * Size variant.
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Color variant.
   */
  variant?: 'default' | 'success' | 'danger';
  /**
   * Wrapper className for the switch container.
   */
  wrapperClassName?: string;
}

const sizeClasses = {
  sm: {
    root: 'h-5 w-9',
    thumb: 'h-4 w-4 data-[state=checked]:translate-x-4',
    text: 'text-sm',
  },
  md: {
    root: 'h-6 w-11',
    thumb: 'h-5 w-5 data-[state=checked]:translate-x-5',
    text: 'text-sm',
  },
  lg: {
    root: 'h-7 w-14',
    thumb: 'h-6 w-6 data-[state=checked]:translate-x-7',
    text: 'text-base',
  },
};

const variantClasses = {
  default: {
    unchecked: 'bg-divider-strong',
    checked: 'bg-emerald-600',
  },
  success: {
    unchecked: 'bg-divider-strong',
    checked: 'bg-green-600',
  },
  danger: {
    unchecked: 'bg-divider-strong',
    checked: 'bg-red-600',
  },
};

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(
  (
    {
      className,
      label,
      description,
      disabled = false,
      checked,
      size = 'md',
      variant = 'default',
      wrapperClassName,
      ...props
    },
    ref
  ) => {
    const sizeStyle = sizeClasses[size];
    const variantStyle = variantClasses[variant];

    const switchElement = (
      <SwitchPrimitives.Root
        className={cn(
          sizeStyle.root,
          'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200',
          'focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? variantStyle.checked : variantStyle.unchecked,
          className
        )}
        checked={checked}
        disabled={disabled}
        {...props}
        ref={ref}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            sizeStyle.thumb,
            'pointer-events-none block rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 data-[state=unchecked]:translate-x-0'
          )}
        />
      </SwitchPrimitives.Root>
    );

    if (!label && !description) {
      return switchElement;
    }

    return (
      <label
        className={cn(
          'flex items-start gap-3',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          wrapperClassName
        )}
      >
        {switchElement}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {label && (
            <span
              className={cn(
                sizeStyle.text,
                'text-heading peer-hover:text-body font-medium transition-colors'
              )}
            >
              {label}
            </span>
          )}
          {description && (
            <span className="text-body text-xs">{description}</span>
          )}
        </div>
      </label>
    );
  }
);

Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
