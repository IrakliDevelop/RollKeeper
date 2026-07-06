'use client';

import React from 'react';
import { X } from 'lucide-react';

interface ConditionBadgeProps {
  name: string;
  stackCount?: number;
  sourceSpell?: string;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export function ConditionBadge({
  name,
  stackCount,
  sourceSpell,
  onRemove,
  size = 'sm',
}: ConditionBadgeProps) {
  const sizeClasses =
    size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';

  return (
    <span
      className={`border-accent-red-border bg-accent-red-bg text-accent-red-text inline-flex min-w-0 items-center gap-1 rounded-full border font-medium ${sizeClasses}`}
      title={sourceSpell ? `From: ${sourceSpell}` : undefined}
    >
      <span className="min-w-0 truncate">{name}</span>
      {stackCount && stackCount > 1 && (
        <span className="shrink-0 font-bold">x{stackCount}</span>
      )}
      {onRemove && (
        <button
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:text-accent-red-text-muted -mr-0.5 shrink-0 rounded-full transition-colors"
          aria-label={`Remove ${name}`}
        >
          <X size={size === 'sm' ? 10 : 12} />
        </button>
      )}
    </span>
  );
}
