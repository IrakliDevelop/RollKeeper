/**
 * Variant Utilities - CVA-based variant definitions
 *
 * This file contains reusable variant patterns using class-variance-authority.
 * These patterns ensure consistent styling across similar components.
 *
 * Uses semantic color tokens (bg-surface, text-heading, border-divider, etc.)
 * that auto-switch between light and dark modes via CSS variables.
 */

import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Common button variants - used by Button and button-like components
 */
export const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md hover:from-emerald-700 hover:to-emerald-800 focus-visible:ring-emerald-500 active:scale-[0.98]',
        secondary:
          'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md hover:from-blue-700 hover:to-blue-800 focus-visible:ring-blue-500 active:scale-[0.98]',
        success:
          'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md hover:from-green-700 hover:to-green-800 focus-visible:ring-green-500 active:scale-[0.98]',
        danger:
          'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md hover:from-red-700 hover:to-red-800 focus-visible:ring-red-500 active:scale-[0.98]',
        warning:
          'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md hover:from-amber-700 hover:to-amber-800 focus-visible:ring-amber-500 active:scale-[0.98]',
        outline:
          'border-2 border-divider bg-surface-raised text-heading hover:bg-surface-hover hover:border-divider-strong focus-visible:ring-ring',
        ghost: 'text-heading hover:bg-surface-hover focus-visible:ring-ring',
        link: 'text-emerald-600 underline-offset-4 hover:underline focus-visible:ring-emerald-500 dark:text-emerald-400',
      },
      size: {
        xs: 'h-7 px-3 text-xs',
        sm: 'h-9 px-4 text-sm',
        md: 'h-10 px-5 text-sm',
        lg: 'h-11 px-6 text-base',
        xl: 'h-13 px-8 text-base',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  }
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

/**
 * Input field variants - used by Input, Textarea, and Select
 */
export const inputVariants = cva(
  // Base styles
  'flex w-full rounded-lg border-2 bg-input-bg px-3 py-2 text-input-text placeholder:text-input-placeholder transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border-input-border focus-visible:border-input-border-focus focus-visible:ring-emerald-500 dark:focus-visible:ring-emerald-400',
        error:
          'border-red-300 focus-visible:border-red-500 focus-visible:ring-red-500 dark:border-red-700 dark:focus-visible:border-red-500',
        success:
          'border-green-300 focus-visible:border-green-500 focus-visible:ring-green-500 dark:border-green-700 dark:focus-visible:border-green-500',
      },
      size: {
        sm: 'h-9 text-sm',
        md: 'h-10 text-sm',
        lg: 'h-11 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export type InputVariants = VariantProps<typeof inputVariants>;

/**
 * Card variants - used by Card and card-like containers
 */
export const cardVariants = cva(
  // Base styles
  'rounded-lg bg-surface-raised transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'border border-divider',
        bordered: 'border-2 border-divider-strong',
        elevated: 'border border-divider shadow-md',
        interactive:
          'border-2 border-divider hover:border-divider-strong hover:shadow-md cursor-pointer',
        ghost: 'border-0',
      },
      padding: {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  }
);

export type CardVariants = VariantProps<typeof cardVariants>;

/**
 * Badge variants - used by Badge and badge-like labels
 */
export const badgeVariants = cva(
  // Base styles
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        primary:
          'bg-accent-emerald-bg text-accent-emerald-text border border-accent-emerald-border',
        secondary:
          'bg-accent-blue-bg text-accent-blue-text border border-accent-blue-border',
        success:
          'bg-accent-green-bg text-accent-green-text border border-accent-green-border',
        danger:
          'bg-accent-red-bg text-accent-red-text border border-accent-red-border',
        warning:
          'bg-accent-amber-bg text-accent-amber-text border border-accent-amber-border',
        info: 'bg-[--accent-blue-bg] text-[--accent-blue-text] border border-[--accent-blue-border]',
        neutral: 'bg-surface-secondary text-heading border border-divider',
        outline: 'bg-transparent text-heading border border-divider-strong',
      },
      size: {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-xs px-2.5 py-0.5',
        lg: 'text-sm px-3 py-1',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;

/**
 * Label variants - used by form labels
 */
export const labelVariants = cva(
  'block text-sm font-medium text-heading transition-colors',
  {
    variants: {
      variant: {
        default: '',
        required: "after:content-['*'] after:text-red-500 after:ml-1",
        optional:
          "after:content-['(optional)'] after:text-muted after:ml-1 after:font-normal",
      },
      size: {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export type LabelVariants = VariantProps<typeof labelVariants>;

/**
 * Helper text variants - used for descriptions and error messages
 */
export const helperTextVariants = cva('text-sm transition-colors', {
  variants: {
    variant: {
      default: 'text-body',
      error: 'text-red-600 dark:text-red-400',
      success: 'text-green-600 dark:text-green-400',
      warning: 'text-amber-600 dark:text-amber-400',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export type HelperTextVariants = VariantProps<typeof helperTextVariants>;
