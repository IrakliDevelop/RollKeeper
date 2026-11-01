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
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    // The wrapping <label> would fold the description into the name, so
    // name and describe the radio by id instead.
    const textId = React.useId();
    const labelId = label ? `${textId}-label` : undefined;
    const descriptionId = description ? `${textId}-description` : undefined;
    const sizeStyle = sizeClasses[size];

    const radioElement = (
      <RadioGroupPrimitive.Item
        ref={ref}
        className={cn(
          sizeStyle.radio,
          'border-input-border relative aspect-square shrink-0 rounded-full border transition-colors duration-120 ease-out',
          'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=checked]:border-brass-fill data-[state=checked]:bg-brass-fill',
          // 44px hit area on touch, same visual size.
          'after:absolute after:top-1/2 after:left-1/2 after:-translate-1/2 pointer-coarse:after:size-11',
          className
        )}
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
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          <Circle
            className={cn(sizeStyle.indicator, 'text-on-brass fill-current')}
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
                <span className="text-muted flex-shrink-0" aria-hidden="true">
                  {icon}
                </span>
              )}
              {label && (
                <span
                  id={labelId}
                  className={cn(
                    sizeStyle.text,
                    'text-heading group-hover:text-body font-medium transition-colors'
                  )}
                >
                  {label}
                </span>
              )}
            </div>
          )}
          {description && (
            <span id={descriptionId} className="text-body mt-1 text-xs">
              {description}
            </span>
          )}
        </div>
      </>
    );

    if (variant === 'card') {
      return (
        <label
          className={cn(
            'group border-divider bg-surface-raised flex items-start rounded-md border p-4 transition-colors duration-120 ease-out',
            'hover:border-input-border',
            // Radix renders no native input outside a form, so key on data-state.
            'has-data-[state=checked]:border-brass-border',
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
          // On touch a row is at least 44px and keeps the radio's 44px hit
          // area inside it, so stacked rows don't overlap: a one-line row
          // centres the radio, a described row pads its top instead so the
          // radio stays beside the label.
          'pointer-coarse:min-h-11',
          description ? 'pointer-coarse:pt-3' : 'pointer-coarse:items-center',
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
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const fieldId = React.useId();
    const labelId = label ? `${fieldId}-label` : undefined;
    const messageId = `${fieldId}-message`;
    const message = error || helperText;
    const describedBy =
      [ariaDescribedBy, message ? messageId : undefined]
        .filter(Boolean)
        .join(' ') || undefined;

    return (
      <div className={cn('w-full', wrapperClassName)}>
        {label && (
          <div
            id={labelId}
            className="text-heading mb-2 block text-sm font-medium"
          >
            {label}
            {required && (
              <span className="text-blood-text ml-1" aria-label="required">
                *
              </span>
            )}
          </div>
        )}

        <RadioGroup
          aria-invalid={error ? true : undefined}
          aria-labelledby={props['aria-label'] ? undefined : labelId}
          aria-describedby={describedBy}
          {...props}
          ref={ref}
        >
          {children}
        </RadioGroup>

        {message && (
          <p
            id={messageId}
            className={cn(
              'mt-2 text-sm',
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

RadioGroupField.displayName = 'RadioGroupField';

export { RadioGroup, RadioGroupItem, RadioGroupField };
