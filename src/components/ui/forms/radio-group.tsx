/**
 * RadioGroup Component
 * 
 * A radio button group component built on Radix UI RadioGroup primitive.
 * Supports labels, descriptions, icons, and card-style layout.
 */

'use client';

import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Circle } from 'lucide-react';
import { cn } from '@/utils/cn';

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn('grid gap-2', className)}
      {...props}
      ref={ref}
    />
  );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

export interface RadioGroupItemProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  /**
   * Label text for the radio button.
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
   * Variant style - card shows a bordered box around the entire option.
   */
  variant?: 'default' | 'card';
  /**
   * Wrapper className for the radio item container.
   */
  wrapperClassName?: string;
}

const sizeClasses = {
  sm: {
    radio: 'h-4 w-4',
    indicator: 'h-2 w-2',
    text: 'text-sm',
    gap: 'gap-2',
  },
  md: {
    radio: 'h-5 w-5',
    indicator: 'h-2.5 w-2.5',
    text: 'text-sm',
    gap: 'gap-3',
  },
  lg: {
    radio: 'h-6 w-6',
    indicator: 'h-3 w-3',
    text: 'text-base',
    gap: 'gap-3',
  },
};

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(
  (
    {
      className,
      label,
      description,
      icon,
      disabled = false,
      size = 'md',
      variant = 'default',
      wrapperClassName,
      ...props
    },
    ref
  ) => {
    const sizeStyle = sizeClasses[size];

    const radioElement = (
      <RadioGroupPrimitive.Item
        ref={ref}
        className={cn(
          sizeStyle.radio,
          'aspect-square shrink-0 rounded-full border-2 border-gray-400 text-white ring-offset-white transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600',
          'hover:border-emerald-500',
          className
        )}
        disabled={disabled}
        {...props}
      >
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          <Circle
            className={cn(sizeStyle.indicator, 'fill-current text-white')}
          />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>
    );

    if (!label && !description && !icon) {
      return radioElement;
    }

    const content = (
      <>
        {radioElement}
        <div className="flex min-w-0 flex-1 flex-col">
          {(label || icon) && (
            <div className="flex items-center gap-2">
              {icon && (
                <span
                  className="flex-shrink-0 text-gray-500"
                  aria-hidden="true"
                >
                  {icon}
                </span>
              )}
              {label && (
                <span
                  className={cn(
                    sizeStyle.text,
                    'font-medium text-gray-900 transition-colors group-hover:text-gray-700'
                  )}
                >
                  {label}
                </span>
              )}
            </div>
          )}
          {description && (
            <span className="mt-1 text-xs text-gray-600">{description}</span>
          )}
        </div>
      </>
    );

    if (variant === 'card') {
      return (
        <label
          className={cn(
            'group flex items-start rounded-lg border-2 border-gray-200 bg-white p-4 transition-all',
            'hover:border-gray-300 hover:shadow-sm',
            'has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            sizeStyle.gap,
            wrapperClassName
          )}
        >
          {content}
        </label>
      );
    }

    return (
      <label
        className={cn(
          'group flex items-start',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          sizeStyle.gap,
          wrapperClassName
        )}
      >
        {content}
      </label>
    );
  }
);
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

// Wrapper component with label
export interface RadioGroupFieldProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
  /**
   * Label text for the radio group.
   */
  label?: string;
  /**
   * Helper text displayed below the radio group.
   */
  helperText?: string;
  /**
   * Error message displayed below the radio group.
   */
  error?: string;
  /**
   * Wrapper className for the radio group container.
   */
  wrapperClassName?: string;
  /**
   * Required field indicator.
   */
  required?: boolean;
}

const RadioGroupField = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  RadioGroupFieldProps
>(
  (
    {
      label,
      helperText,
      error,
      wrapperClassName,
      required,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn('w-full', wrapperClassName)}>
        {label && (
          <div className="mb-2 block text-sm font-medium text-gray-800">
            {label}
            {required && (
              <span className="ml-1 text-red-500" aria-label="required">
                *
              </span>
            )}
          </div>
        )}

        <RadioGroup {...props} ref={ref}>
          {children}
        </RadioGroup>

        {(error || helperText) && (
          <p
            className={cn(
              'mt-2 text-sm',
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

RadioGroupField.displayName = 'RadioGroupField';

export { RadioGroup, RadioGroupItem, RadioGroupField };

