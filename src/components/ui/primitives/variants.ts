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
 * Common button variants - used by Button and button-like components.
 *
 * Felt and Brass: primary is the one brass action per view, danger-solid is
 * only for the confirm button of a destructive dialog, and everything else
 * is an outline or plain text. success and warning are deprecated aliases
 * of secondary. `selected` marks the on state of an outline or text toggle.
 */
const OUTLINE_BUTTON =
  'border border-input-border bg-transparent text-heading hover:bg-surface-hover';

export const buttonVariants = cva(
  // Base styles
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm font-medium transition-colors duration-120 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:min-w-11',
  {
    variants: {
      variant: {
        primary: 'bg-brass-fill text-on-brass hover:bg-brass-fill/90',
        secondary: OUTLINE_BUTTON,
        /** @deprecated Use `secondary`, or `selected` for an on state. */
        success: OUTLINE_BUTTON,
        /** @deprecated Use `secondary`, or `selected` for an on state. */
        warning: OUTLINE_BUTTON,
        outline: OUTLINE_BUTTON,
        ghost: 'text-heading hover:bg-surface-hover',
        danger:
          'border border-blood-border bg-transparent text-blood-text hover:bg-surface-hover',
        'danger-solid': 'bg-blood-fill text-on-blood hover:bg-blood-fill/90',
        link: 'text-brass-text underline-offset-4 hover:underline',
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
      selected: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: ['secondary', 'success', 'warning', 'outline', 'ghost'],
        selected: true,
        className: 'border border-brass-border text-brass-text',
      },
    ],
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
      fullWidth: false,
      selected: false,
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
 * Badge variants - used by Badge and badge-like labels.
 *
 * Felt and Brass: a 1px outline in the role colour with no fill. info,
 * secondary and outline render as neutral.
 */
const NEUTRAL_BADGE = 'border-input-border text-heading';

export const badgeVariants = cva(
  // Base styles
  'inline-flex items-center gap-1 rounded-[3px] border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        primary: 'border-brass-border text-brass-text',
        success: 'border-verdigris-border text-verdigris-text',
        warning: 'border-ember-border text-ember-text',
        danger: 'border-blood-border text-blood-text',
        neutral: NEUTRAL_BADGE,
        secondary: NEUTRAL_BADGE,
        info: NEUTRAL_BADGE,
        outline: NEUTRAL_BADGE,
      },
      size: {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-xs px-2.5 py-0.5',
        lg: 'text-sm px-3 py-1',
      },
    },
    defaultVariants: {
      variant: 'neutral',
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
