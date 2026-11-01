/**
 * Select Component
 *
 * A flexible select component built on Radix UI Select primitive.
 * Supports labels, helper text, error states, icons, and descriptions.
 */

'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  inputVariants,
  OVERLAY_SURFACE,
  type InputVariants,
} from '../primitives/variants';

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

export interface SelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
    Omit<InputVariants, 'size'> {
  size?: 'sm' | 'md' | 'lg';
}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, variant, size = 'md', ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    aria-invalid={variant === 'error' || undefined}
    className={cn(
      inputVariants({ variant, size }),
      'flex items-center justify-between [&>span]:line-clamp-1',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        OVERLAY_SURFACE,
        'text-heading relative z-50 min-w-[8rem] overflow-hidden',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-180 ease-out',
        position === 'popper' &&
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          'p-1',
          position === 'popper' &&
            'max-h-[min(var(--radix-select-content-available-height),20rem)] w-full min-w-(--radix-select-trigger-width)'
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('text-heading px-2 py-1.5 text-sm font-semibold', className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

export interface SelectItemProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  /**
   * Icon to display before the item text.
   */
  icon?: React.ReactNode;
  /**
   * Description text to display below the item label.
   */
  description?: string;
}

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, icon, description, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default items-center rounded-sm py-2 pr-2 pl-8 text-sm outline-hidden select-none',
      // The highlighted row (arrow keys or pointer) gets the hover surface and
      // a brass inset outline: on felt, surface-hover alone barely shows on
      // the elevated menu. outline-hidden turns the outline style off, so the
      // highlighted state turns it back on with outline-solid.
      'data-[highlighted]:bg-surface-hover data-[highlighted]:text-heading data-[highlighted]:outline-ring data-[highlighted]:outline-2 data-[highlighted]:-outline-offset-2 data-[highlighted]:outline-solid',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="text-brass-text h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <div className="flex min-w-0 flex-1 items-center gap-2">
      {icon && (
        <span className="text-muted flex-shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <SelectPrimitive.ItemText>
          <span className="block truncate">{children}</span>
        </SelectPrimitive.ItemText>
        {description && (
          <span className="text-muted block truncate text-xs">
            {description}
          </span>
        )}
      </div>
    </div>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('bg-divider -mx-1 my-1 h-px', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

// Wrapper component with label and helper text
export interface SelectFieldProps {
  /**
   * Label text for the select.
   */
  label?: string;
  /**
   * Helper text displayed below the select.
   */
  helperText?: string;
  /**
   * Error message displayed below the select.
   */
  error?: string;
  /**
   * Wrapper className for the select container.
   */
  wrapperClassName?: string;
  /**
   * The select trigger props.
   */
  triggerProps?: SelectTriggerProps;
  /**
   * The select content props.
   */
  contentProps?: React.ComponentPropsWithoutRef<typeof SelectContent>;
  /**
   * Children (SelectItem components).
   */
  children: React.ReactNode;
  /**
   * Required field indicator.
   */
  required?: boolean;
}

const SelectField = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  SelectFieldProps &
    Omit<
      React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>,
      'children'
    >
>(
  (
    {
      label,
      helperText,
      error,
      wrapperClassName,
      triggerProps,
      contentProps,
      children,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const triggerId = triggerProps?.id ?? `${generatedId}-trigger`;
    const messageId = `${generatedId}-message`;
    const message = error || helperText;
    const triggerVariant = error ? 'error' : triggerProps?.variant;
    const describedBy =
      [triggerProps?.['aria-describedby'], message ? messageId : undefined]
        .filter(Boolean)
        .join(' ') || undefined;

    return (
      <div className={cn('w-full', wrapperClassName)}>
        {label && (
          <label
            className="text-heading mb-1.5 block text-sm font-medium"
            htmlFor={triggerId}
          >
            {label}
            {required && (
              <span className="text-blood-text ml-1" aria-label="required">
                *
              </span>
            )}
          </label>
        )}

        <Select {...props}>
          <SelectTrigger
            {...triggerProps}
            id={triggerId}
            variant={triggerVariant}
            aria-describedby={describedBy}
            ref={ref}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent {...contentProps}>{children}</SelectContent>
        </Select>

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

SelectField.displayName = 'SelectField';

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectField,
};
