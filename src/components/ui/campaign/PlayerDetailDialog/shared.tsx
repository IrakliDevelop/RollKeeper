import React from 'react';
import { cn } from '@/utils/cn';

export function formatMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function SectionTitle({
  icon,
  children,
  trailing,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  /** Controls at the end of the heading row, such as a switch. */
  trailing?: React.ReactNode;
}) {
  const title = (
    <h3
      className={cn(
        'text-heading flex items-center gap-2 text-sm font-semibold tracking-wide uppercase',
        trailing == null && 'mb-2'
      )}
    >
      {icon}
      {children}
    </h3>
  );
  if (trailing == null) return title;
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      {title}
      {trailing}
    </div>
  );
}
