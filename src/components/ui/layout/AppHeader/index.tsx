'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { HeaderTrailing } from '@/components/auth/HeaderTrailing';
import { cn } from '@/utils/cn';
import { Brand } from './Brand';

export interface AppHeaderProps {
  /** Back crumb, following the home mark. */
  leading?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  subbar?: ReactNode;
  nav?: ReactNode;
  sticky?: boolean;
}

/**
 * Shared shell. Title and controls share one row when they fit and wrap to two
 * otherwise. The measured height includes wrapped controls and subbar.
 */
export function AppHeader({
  leading,
  title,
  actions,
  subbar,
  nav,
  sticky = false,
}: AppHeaderProps) {
  const barRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const root = document.documentElement;
    const publish = () =>
      root.style.setProperty(
        '--app-header-height',
        `${bar.getBoundingClientRect().height}px`
      );
    publish();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(publish);
    observer?.observe(bar);
    return () => {
      observer?.disconnect();
      root.style.removeProperty('--app-header-height');
    };
  }, []);

  return (
    <header
      ref={barRef}
      className={cn(
        'border-divider bg-surface-raised z-50 border-b',
        sticky && 'sticky top-0'
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-[1_1_24rem] items-center gap-2">
          <Brand />
          {leading}
          <div className="min-w-0 flex-1">{title}</div>
        </div>
        {nav && <div className="hidden md:block">{nav}</div>}
        <div className="ml-auto flex shrink-0 items-center justify-end gap-2 sm:gap-3">
          {actions && (
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {actions}
            </div>
          )}
          <HeaderTrailing />
        </div>
      </div>
      {subbar != null && (
        <div className="border-divider bg-surface-secondary border-t">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{subbar}</div>
        </div>
      )}
    </header>
  );
}
