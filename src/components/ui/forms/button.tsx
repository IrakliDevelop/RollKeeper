/**
 * Button Component
 * 
 * A versatile button component built with modern design principles.
 * Supports multiple variants, sizes, states, and icon integration.
 */

'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
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

    // Build content array
    const contentParts = [];
    
    if (loading) {
      contentParts.push(
        <Loader2 key="loader" className="h-4 w-4 animate-spin" aria-hidden="true" />
      );
    } else {
      if (leftIcon) {
        contentParts.push(
          <span key="left-icon" className="inline-flex shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        );
      }
    }
    
    contentParts.push(children);
    
    if (!loading && rightIcon) {
      contentParts.push(
        <span key="right-icon" className="inline-flex shrink-0" aria-hidden="true">
          {rightIcon}
        </span>
      );
    }

    // When using asChild with icons, wrap all content in a single element
    const shouldWrapContent = asChild && (loading || leftIcon || rightIcon);
    const content = shouldWrapContent ? (
      <span className="flex items-center gap-2">{contentParts}</span>
    ) : (
      contentParts
    );

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {content}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };

