/**
 * Badge Component
 * 
 * A small label component for displaying status, categories, or tags.
 * Supports multiple variants and sizes.
 */

import * as React from 'react';
import { cn } from '@/utils/cn';
import { badgeVariants, type BadgeVariants } from '../primitives/variants';

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    BadgeVariants {
  /**
   * Icon to display before the badge text.
   */
  leftIcon?: React.ReactNode;
  /**
   * Icon to display after the badge text.
   */
  rightIcon?: React.ReactNode;
}

function Badge({
  className,
  variant,
  size,
  leftIcon,
  rightIcon,
  children,
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {leftIcon && (
        <span className="inline-flex shrink-0" aria-hidden="true">
          {leftIcon}
        </span>
      )}
      {children}
      {rightIcon && (
        <span className="inline-flex shrink-0" aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </div>
  );
}

export { Badge, badgeVariants };
