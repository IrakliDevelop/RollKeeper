/**
 * Variant Utilities - CVA-based variant definitions
 * 
 * This file contains reusable variant patterns using class-variance-authority.
 * These patterns ensure consistent styling across similar components.
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
          'border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus-visible:ring-gray-500',
        ghost:
          'text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-500',
        link: 'text-emerald-600 underline-offset-4 hover:underline focus-visible:ring-emerald-500',
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
  'flex w-full rounded-lg border-2 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border-gray-300 focus-visible:border-emerald-500 focus-visible:ring-emerald-500',
        error:
          'border-red-300 focus-visible:border-red-500 focus-visible:ring-red-500',
        success:
          'border-green-300 focus-visible:border-green-500 focus-visible:ring-green-500',
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
  'rounded-lg bg-white transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'border border-gray-200',
        bordered: 'border-2 border-gray-300',
        elevated: 'border border-gray-200 shadow-md',
        interactive:
          'border-2 border-gray-200 hover:border-gray-300 hover:shadow-md cursor-pointer',
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
          'bg-emerald-100 text-emerald-800 border border-emerald-200',
        secondary:
          'bg-blue-100 text-blue-800 border border-blue-200',
        success:
          'bg-green-100 text-green-800 border border-green-200',
        danger:
          'bg-red-100 text-red-800 border border-red-200',
        warning:
          'bg-amber-100 text-amber-800 border border-amber-200',
        info: 'bg-sky-100 text-sky-800 border border-sky-200',
        neutral:
          'bg-gray-100 text-gray-800 border border-gray-200',
        outline:
          'bg-transparent text-gray-700 border border-gray-300',
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
  'block text-sm font-medium text-gray-800 transition-colors',
  {
    variants: {
      variant: {
        default: '',
        required:
          "after:content-['*'] after:text-red-500 after:ml-1",
        optional:
          "after:content-['(optional)'] after:text-gray-500 after:ml-1 after:font-normal",
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
      default: 'text-gray-600',
      error: 'text-red-600',
      success: 'text-green-600',
      warning: 'text-amber-600',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export type HelperTextVariants = VariantProps<typeof helperTextVariants>;

