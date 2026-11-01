'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';

interface ConditionBadgeProps {
  name: string;
  stackCount?: number;
  sourceSpell?: string;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  variant?: 'condition' | 'buff';
}

export function ConditionBadge({
  name,
  stackCount,
  sourceSpell,
  onRemove,
  size = 'sm',
  variant = 'condition',
}: ConditionBadgeProps) {
  return (
    <Badge
      variant={variant === 'condition' ? 'warning' : 'success'}
      size={size}
      className="min-w-0 flex-wrap"
    >
      <span>{name}</span>
      {stackCount && stackCount > 1 && (
        <span className="shrink-0 font-bold">x{stackCount}</span>
      )}
      {sourceSpell && <span className="font-normal">From {sourceSpell}</span>}
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          className="shrink-0 px-1 text-current pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          aria-label={`Remove ${name}`}
        >
          <X size={12} aria-hidden="true" />
        </Button>
      )}
    </Badge>
  );
}
