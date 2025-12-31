/**
 * Design Tokens - Centralized design system constants
 * 
 * This file contains all the design tokens used throughout the application.
 * These tokens ensure consistency across all components.
 */

export const colors = {
  // Primary colors - Emerald/Blue for main actions
  primary: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981', // Main primary
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
  },
  
  // Secondary colors - Blue accent
  secondary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6', // Main secondary
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  
  // Success colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e', // Main success
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  
  // Danger colors
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444', // Main danger
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  
  // Warning colors
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b', // Main warning
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  
  // Neutral colors - Gray/Slate
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
} as const;

export const spacing = {
  0: '0px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
  '4xl': '64px',
} as const;

export const typography = {
  fontSize: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
} as const;

export const borderRadius = {
  none: '0px',
  sm: '0.375rem',   // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  full: '9999px',
} as const;

export const transitions = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
} as const;

export const zIndex = {
  dropdown: 50,
  modal: 100,
  toast: 150,
  tooltip: 200,
} as const;

// Semantic color mappings for easier usage
export const semanticColors = {
  text: {
    primary: colors.neutral[900],
    secondary: colors.neutral[600],
    tertiary: colors.neutral[500],
    disabled: colors.neutral[400],
    inverse: '#ffffff',
  },
  background: {
    primary: '#ffffff',
    secondary: colors.neutral[50],
    tertiary: colors.neutral[100],
    disabled: colors.neutral[100],
    inverse: colors.neutral[900],
  },
  border: {
    default: colors.neutral[300],
    hover: colors.neutral[400],
    focus: colors.primary[500],
    error: colors.danger[500],
    success: colors.success[500],
  },
} as const;

// Component-specific tokens
export const componentTokens = {
  button: {
    height: {
      xs: '28px',
      sm: '36px',
      md: '40px',
      lg: '44px',
      xl: '52px',
    },
    padding: {
      xs: '6px 12px',
      sm: '8px 16px',
      md: '10px 20px',
      lg: '12px 24px',
      xl: '14px 32px',
    },
  },
  input: {
    height: {
      sm: '36px',
      md: '40px',
      lg: '44px',
    },
    padding: {
      sm: '8px 12px',
      md: '10px 14px',
      lg: '12px 16px',
    },
  },
  card: {
    padding: {
      sm: '12px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    },
  },
} as const;

// Export type helpers
export type ColorScale = keyof typeof colors;
export type SpacingKey = keyof typeof spacing;
export type FontSize = keyof typeof typography.fontSize;
export type Shadow = keyof typeof shadows;
export type BorderRadius = keyof typeof borderRadius;

