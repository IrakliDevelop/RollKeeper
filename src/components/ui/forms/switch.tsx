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

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
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
   * @deprecated Every variant is brass when on. Kept so call sites compile.
   */
  variant?: 'default' | 'success' | 'danger';
  /**
   * Wrapper className for the switch container.
   */
  wrapperClassName?: string;
  /** Extra classes for the label text, e.g. to hide it visually on phones. */
  labelClassName?: string;
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

// Felt and Brass: a brass track when on and an input-border track when off,
// keyed on Radix's data-state so uncontrolled switches colour correctly too.
// The variants are deprecated aliases.
const BRASS_TRACK =
  'data-[state=unchecked]:bg-input-border data-[state=checked]:bg-brass-fill';

const variantClasses = {
  default: BRASS_TRACK,
  success: BRASS_TRACK,
  danger: BRASS_TRACK,
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
      labelClassName,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    // The wrapping <label> would fold the description into the name, so
    // name and describe the switch by id instead.
    const textId = React.useId();
    const labelId = label ? `${textId}-label` : undefined;
    const descriptionId = description ? `${textId}-description` : undefined;
    const sizeStyle = sizeClasses[size];
    const variantStyle = variantClasses[variant];

    const switchElement = (
      <SwitchPrimitives.Root
        className={cn(
          sizeStyle.root,
          'peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-120 ease-out',
          'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          // 44px hit area on touch, same visual size.
          'after:absolute after:top-1/2 after:left-1/2 after:-translate-1/2 pointer-coarse:after:h-11 pointer-coarse:after:w-[max(100%,2.75rem)]',
          variantStyle,
          className
        )}
        checked={checked}
        disabled={disabled}
        aria-labelledby={
          ariaLabelledBy ?? (props['aria-label'] ? undefined : labelId)
        }
        aria-describedby={
          [ariaDescribedBy, descriptionId].filter(Boolean).join(' ') ||
          undefined
        }
        {...props}
        ref={ref}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            sizeStyle.thumb,
            'bg-on-brass pointer-events-none block rounded-full transition-transform duration-120 ease-out data-[state=unchecked]:translate-x-0'
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
          // On touch a row is at least 44px and keeps the control's 44px hit
          // area inside it, so stacked rows don't overlap: a one-line row
          // centres the control, a described row pads its top instead so the
          // control stays beside the label.
          'pointer-coarse:min-h-11',
          description ? 'pointer-coarse:pt-3' : 'pointer-coarse:items-center',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          wrapperClassName
        )}
      >
        {switchElement}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {label && (
            <span
              id={labelId}
              className={cn(
                sizeStyle.text,
                'text-heading peer-hover:text-body font-medium transition-colors',
                labelClassName
              )}
            >
              {label}
            </span>
          )}
          {description && (
            <span id={descriptionId} className="text-body text-xs">
              {description}
            </span>
          )}
        </div>
      </label>
    );
  }
);

Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
