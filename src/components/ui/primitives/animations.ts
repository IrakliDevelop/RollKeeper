/**
 * Animation Variants - Reusable Framer Motion animations
 * 
 * This file contains reusable animation variants for Framer Motion.
 * These ensure consistent, lightweight animations across components.
 */

import { type Variants, type Transition } from 'framer-motion';

/**
 * Standard transition timings
 */
export const transitions = {
  fast: { duration: 0.15, ease: 'easeOut' } as Transition,
  normal: { duration: 0.2, ease: 'easeOut' } as Transition,
  slow: { duration: 0.3, ease: 'easeOut' } as Transition,
  spring: { type: 'spring' as const, stiffness: 300, damping: 30 },
  bounce: { type: 'spring' as const, stiffness: 400, damping: 25 },
} as const;

/**
 * Fade animations
 */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Scale animations (for modals, popovers)
 */
export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

/**
 * Slide from top (for dropdowns, notifications)
 */
export const slideFromTopVariants: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

/**
 * Slide from bottom (for bottom sheets, mobile menus)
 */
export const slideFromBottomVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
};

/**
 * Slide from left (for side panels, drawers)
 */
export const slideFromLeftVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

/**
 * Slide from right (for side panels, drawers)
 */
export const slideFromRightVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

/**
 * Collapse/expand (for accordions, collapsible sections)
 */
export const collapseVariants: Variants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { height: 'auto', opacity: 1 },
};

/**
 * Stagger children (for lists, grids)
 */
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Press animation (for buttons)
 */
export const pressAnimation = {
  scale: 0.98,
};

/**
 * Tap animation with spring (for interactive elements)
 */
export const tapAnimation = {
  scale: 0.95,
  transition: transitions.spring,
};

/**
 * Hover lift (for cards)
 */
export const hoverLiftAnimation = {
  y: -2,
  transition: transitions.fast,
};

/**
 * Shake animation (for errors)
 */
export const shakeVariants: Variants = {
  shake: {
    x: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.4 },
  },
};

/**
 * Pulse animation (for loading states)
 */
export const pulseVariants: Variants = {
  pulse: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Spin animation (for loading spinners)
 */
export const spinVariants: Variants = {
  spin: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

/**
 * Bounce animation (for success indicators)
 */
export const bounceVariants: Variants = {
  bounce: {
    y: [0, -10, 0],
    transition: {
      duration: 0.5,
      repeat: 2,
      ease: 'easeOut',
    },
  },
};

/**
 * Glow effect (for focus/active states)
 */
export const glowVariants: Variants = {
  hidden: { opacity: 0, scale: 0 },
  visible: { opacity: 0.3, scale: 1 },
};

/**
 * Modal backdrop variants
 */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Toast notification variants
 */
export const toastVariants: Variants = {
  hidden: { opacity: 0, y: -50, scale: 0.3 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.5, transition: { duration: 0.2 } },
};

