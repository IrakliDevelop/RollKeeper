'use client';

import React from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';

import {
  CLASS_RESOURCE_COLORS,
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
  const colors = CLASS_RESOURCE_COLORS[definition.color];
  const isPool = definition.displayStyle === 'pool';
  const bigPool = isPool && maxUses >= 20;

  return (
    <div className={className}>
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`rounded-md p-1.5 ${colors.iconBg}`}>
            <Icon size={14} />
          </div>
          <span className="text-heading text-sm font-bold">
            {definition.name}
          </span>
          {die && (
            <Badge className={`px-2 py-0.5 text-xs font-bold ${colors.badge}`}>
              {die}
            </Badge>
          )}
          {isPool && (
            <Badge className={`px-2 py-0.5 text-xs font-bold ${colors.badge}`}>
              pool
            </Badge>
          )}
        </div>
        <Button
          onClick={() => onReset(definition.id)}
          variant="ghost"
          size="xs"
          className="text-muted hover:text-heading"
          title="Reset (Long Rest)"
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
            >
              <Minus size={12} />
            </Button>
            <Button
              onClick={() => onRestore(definition.id, 1)}
              variant="outline"
              size="xs"
              disabled={usesExpended === 0}
              title="Restore 1"
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
                  className={`flex h-7 w-7 items-center justify-center rounded-md border-2 transition-all ${
                    isAvailable ? colors.pipOn : colors.pipOff
                  }`}
                  title={isAvailable ? 'Click to expend' : 'Click to restore'}
                >
                  <Icon size={12} />
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
