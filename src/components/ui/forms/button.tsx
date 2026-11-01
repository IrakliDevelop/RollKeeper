/**
 * Button Component
 *
 * A versatile button component built with modern design principles.
 * Supports multiple variants, sizes, states, and icon integration.
 */

'use client';

import * as React from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { buttonVariants, type ButtonVariants } from '../primitives/variants';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariants {
  /**
   * If true, the button will render as a Slot component.
   * Useful for composition with other components.
   */
  asChild?: boolean;
  /**
   * If true, shows a loading spinner and disables the button.
   */
  loading?: boolean;
  /**
   * Icon to display before the button text.
   */
  leftIcon?: React.ReactNode;
  /**
   * Icon to display after the button text.
   */
  rightIcon?: React.ReactNode;
  /**
   * Marks the on state of an outline or ghost toggle (brass border and
   * text). Filled variants ignore it. Pair it with `aria-pressed` only when
   * the label stays the same in both states.
   */
  selected?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      selected = false,
      asChild = false,
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, fullWidth, selected }),
          className
        )}
        data-variant={variant ?? 'secondary'}
        data-selected={selected ? 'true' : undefined}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          leftIcon && (
            <span className="inline-flex shrink-0" aria-hidden="true">
              {leftIcon}
            </span>
          )
        )}
        <Slottable>{children}</Slottable>
        {!loading && rightIcon && (
          <span className="inline-flex shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
