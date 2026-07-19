import React from 'react';

export function formatMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h3 className="text-heading mb-2 flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
      {icon}
      {children}
    </h3>
  );
}
