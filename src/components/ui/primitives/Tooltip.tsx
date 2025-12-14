'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/utils/cn';

const TooltipProvider = TooltipPrimitive.Provider;

const TooltipRoot = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'z-50 overflow-hidden rounded-lg bg-gray-900 px-3 py-2 text-sm text-white shadow-lg',
      'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
      'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

const TooltipArrow = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Arrow>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Arrow>
>(({ className, ...props }, ref) => (
  <TooltipPrimitive.Arrow
    ref={ref}
    className={cn('fill-gray-900', className)}
    {...props}
  />
));
TooltipArrow.displayName = TooltipPrimitive.Arrow.displayName;

// Convenience wrapper component
interface TooltipProps {
  /**
   * The content that triggers the tooltip (usually includes an info icon)
   */
  children: React.ReactNode;
  /**
   * The tooltip content text
   */
  content: React.ReactNode;
  /**
   * Which side to display the tooltip on
   */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * Whether to show an arrow pointing to the trigger
   */
  showArrow?: boolean;
  /**
   * Additional className for the tooltip content
   */
  className?: string;
  /**
   * Delay before showing tooltip (in ms)
   */
  delayDuration?: number;
}

const Tooltip = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipProps
>(
  (
    {
      children,
      content,
      side = 'top',
      showArrow = true,
      className,
      delayDuration = 200,
    },
    ref
  ) => {
    return (
      <TooltipRoot delayDuration={delayDuration}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent ref={ref} side={side} className={className}>
          {content}
          {showArrow && <TooltipArrow />}
        </TooltipContent>
      </TooltipRoot>
    );
  }
);

Tooltip.displayName = 'Tooltip';

export {
  Tooltip,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
  TooltipArrow,
};
