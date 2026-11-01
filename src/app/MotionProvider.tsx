'use client';

import { MotionConfig } from 'framer-motion';

// framer-motion ignores the CSS prefers-reduced-motion guard in globals.css,
// so JS animations opt in to the OS setting here, once, for the whole app.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
