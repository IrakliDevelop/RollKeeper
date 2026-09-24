'use client';

import { useMemo } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import {
  CLASS_RESOURCE_COLORS,
  CLASS_RESOURCE_ICONS,
} from '@/components/ui/character/classResourceStyles';
import { useCharacterStore } from '@/store/characterStore';
import {
  getActiveClassResources,
  type ActiveClassResource,
} from '@/utils/classResources';
import { cn } from '@/utils/cn';

/**
 * Class resources (Rage, Lay on Hands, Second Wind, …) for the map sheet's
 * Overview tab. Not DockResources — that component is the dock's compact
 * row layout; this renders a fuller card with pips or a pool bar, class
 * context, description, and a per-resource reset button.
 */
export function SheetResources() {
  const character = useCharacterStore(s => s.character);
  const expendClassResource = useCharacterStore(s => s.useClassResource);
  const restoreClassResource = useCharacterStore(s => s.restoreClassResource);
  const resetClassResource = useCharacterStore(s => s.resetClassResource);
  const resources = useMemo(
    () => getActiveClassResources(character),
    [character]
  );

  if (resources.length === 0) return null;

  return (
    <div className="border-divider bg-surface rounded-xl border p-3">
      <div className="text-faint mb-2 text-xs font-bold uppercase">
        Class Resources
      </div>
      <div className="space-y-2.5">
        {resources.map(resource => (
          <ResourceRow
            key={resource.definition.id}
            resource={resource}
            onSpend={amount =>
              expendClassResource(resource.definition.id, amount)
            }
            onRestore={amount =>
              restoreClassResource(resource.definition.id, amount)
            }
            onReset={() => resetClassResource(resource.definition.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ResourceRow({
  resource,
  onSpend,
  onRestore,
  onReset,
}: {
  resource: ActiveClassResource;
  onSpend: (amount: number) => void;
  onRestore: (amount: number) => void;
  onReset: () => void;
}) {
  const { definition, classLevel, maxUses, die, usesRemaining, description } =
    resource;
  const { name } = definition;
  const Icon = CLASS_RESOURCE_ICONS[definition.icon];
  const colors = CLASS_RESOURCE_COLORS[definition.color];
  const isPool = definition.displayStyle === 'pool';
  const bigPool = isPool && maxUses >= 20;

  return (
    <div className="border-divider rounded-lg border p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-heading text-sm font-semibold">{name}</span>
            {die && <span className="text-muted text-xs">{die}</span>}
          </div>
          <div className="text-muted text-xs">
            {definition.className} {classLevel}
          </div>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={onReset}
          aria-label={`Reset ${name}`}
          title="Reset (long rest)"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <span className="text-heading text-sm font-bold">
          {usesRemaining}
          <span className="text-muted ml-0.5 font-normal">/{maxUses}</span>
        </span>

        {isPool ? (
          <PoolControls
            name={name}
            bigPool={bigPool}
            canSpend={usesRemaining > 0}
            canRestore={usesRemaining < maxUses}
            onSpend={onSpend}
            onRestore={onRestore}
          />
        ) : (
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: maxUses }, (_, index) => {
              const filled = index < usesRemaining;
              return (
                <button
                  key={index}
                  type="button"
                  aria-label={filled ? `Spend ${name}` : `Restore ${name}`}
                  onClick={() => (filled ? onSpend(1) : onRestore(1))}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-md border-2',
                    filled ? colors.pipOn : colors.pipOff
                  )}
                >
                  <Icon className="h-3 w-3" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isPool && (
        <div className="bg-surface-secondary mt-2 h-1 w-full overflow-hidden rounded-full">
          <div
            className={cn('h-full rounded-full', colors.iconBg)}
            style={{
              width: `${maxUses > 0 ? (usesRemaining / maxUses) * 100 : 0}%`,
            }}
          />
        </div>
      )}

      {description && (
        <div className="text-muted mt-1.5 text-xs">{description}</div>
      )}
    </div>
  );
}

function PoolControls({
  name,
  bigPool,
  canSpend,
  canRestore,
  onSpend,
  onRestore,
}: {
  name: string;
  bigPool: boolean;
  canSpend: boolean;
  canRestore: boolean;
  onSpend: (amount: number) => void;
  onRestore: (amount: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {bigPool && (
        <Button
          variant="outline"
          size="xs"
          onClick={() => onSpend(5)}
          disabled={!canSpend}
          aria-label={`Spend 5 ${name}`}
        >
          −5
        </Button>
      )}
      <Button
        variant="outline"
        size="xs"
        onClick={() => onSpend(1)}
        disabled={!canSpend}
        aria-label={`Spend 1 ${name}`}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <Button
        variant="outline"
        size="xs"
        onClick={() => onRestore(1)}
        disabled={!canRestore}
        aria-label={`Restore 1 ${name}`}
      >
        <Plus className="h-3 w-3" />
      </Button>
      {bigPool && (
        <Button
          variant="outline"
          size="xs"
          onClick={() => onRestore(5)}
          disabled={!canRestore}
          aria-label={`Restore 5 ${name}`}
        >
          +5
        </Button>
      )}
    </div>
  );
}
