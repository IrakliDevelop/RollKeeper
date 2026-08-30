'use client';

import {
  ThemeToggle,
  type ThemeToggleProps,
} from '@/components/ui/ThemeToggle';

import { AccountHeaderEntry } from './AccountHeaderEntry';

export function HeaderTrailing(props: ThemeToggleProps) {
  return (
    <div className="relative z-40 flex items-center gap-2.5">
      <AccountHeaderEntry />
      <ThemeToggle {...props} />
    </div>
  );
}
