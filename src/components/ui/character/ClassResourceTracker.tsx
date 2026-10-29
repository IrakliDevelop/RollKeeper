'use client';

import React from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';

import {
  CLASS_RESOURCE_STYLE,
  CLASS_RESOURCE_ICONS,
} from './classResourceStyles';

import { ActiveClassResource } from '@/utils/classResources';

interface ClassResourceTrackerProps {
  resource: ActiveClassResource;
  onUse: (id: string, amount?: number) => void;
  onRestore: (id: string, amount?: number) => void;
  onReset: (id: string) => void;
  className?: string;
}

export default function ClassResourceTracker({
  resource,
  onUse,
  onRestore,
  onReset,
  className = '',
}: ClassResourceTrackerProps) {
  const { definition, maxUses, die, usesExpended, usesRemaining, description } =
    resource;
  const Icon = CLASS_RESOURCE_ICONS[definition.icon];
  const colors = CLASS_RESOURCE_STYLE;
  const isPool = definition.displayStyle === 'pool';
  const bigPool = isPool && maxUses >= 20;

  return (
    <div className={className}>
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-muted" aria-hidden="true" />
          <span className="text-heading text-sm font-bold">
            {definition.name}
          </span>
          {die && (
            <Badge variant="neutral" size="sm">
              {die}
            </Badge>
          )}
          {isPool && (
            <Badge variant="neutral" size="sm">
              pool
            </Badge>
          )}
        </div>
        <Button
          onClick={() => onReset(definition.id)}
          variant="ghost"
          size="xs"
          className="text-muted hover:text-heading"
          title={`Restore all ${definition.name}`}
          aria-label={`Restore all ${definition.name}`}
        >
          <RotateCcw size={14} />
        </Button>
      </div>

      {/* Count + controls */}
      <div className="mb-2 flex items-center gap-3">
        <div className="text-heading text-xl font-bold">
          {usesRemaining}
          <span className="text-muted ml-0.5 text-sm">/ {maxUses}</span>
        </div>

        {isPool ? (
          <div className="flex items-center gap-1.5">
            {bigPool && (
              <Button
                onClick={() => onUse(definition.id, 5)}
                variant="outline"
                size="xs"
                disabled={usesRemaining === 0}
                title="Spend 5"
                aria-label={`Spend 5 ${definition.name}`}
              >
                −5
              </Button>
            )}
            <Button
              onClick={() => onUse(definition.id, 1)}
              variant="outline"
              size="xs"
              disabled={usesRemaining === 0}
              title="Spend 1"
              aria-label={`Spend 1 ${definition.name}`}
            >
              <Minus size={12} />
            </Button>
            <Button
              onClick={() => onRestore(definition.id, 1)}
              variant="outline"
              size="xs"
              disabled={usesExpended === 0}
              title="Restore 1"
              aria-label={`Restore 1 ${definition.name}`}
            >
              <Plus size={12} />
            </Button>
            {bigPool && (
              <Button
                onClick={() => onRestore(definition.id, 5)}
                variant="outline"
                size="xs"
                disabled={usesExpended === 0}
                title="Restore 5"
                aria-label={`Restore 5 ${definition.name}`}
              >
                +5
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: maxUses }, (_, index) => {
              const isAvailable = index < usesRemaining;
              return (
                <button
                  key={index}
                  onClick={() =>
                    isAvailable
                      ? onUse(definition.id, 1)
                      : onRestore(definition.id, 1)
                  }
                  type="button"
                  aria-label={`${isAvailable ? 'Spend' : 'Restore'} 1 ${definition.name}`}
                  className="focus-visible:outline-ring flex min-h-6 min-w-6 items-center justify-center rounded-sm focus-visible:outline-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                >
                  <span
                    aria-hidden="true"
                    className={`size-2.5 rounded-full border-[1.5px] ${isAvailable ? colors.pipOn : colors.pipOff}`}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Helper text */}
      {description && <div className="text-muted text-xs">{description}</div>}
    </div>
  );
}
