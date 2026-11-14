'use client';

import { useMemo } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
import { CLASS_RESOURCE_STYLE } from '@/components/ui/character/classResourceStyles';
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
    <Section heading="Class resources" level={4} className="@container">
      <ul className="divide-divider divide-y">
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
      </ul>
    </Section>
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
  const isPool = definition.displayStyle === 'pool';
  const bigPool = isPool && maxUses >= 20;

  return (
    <li className="py-2.5">
      <div className="flex flex-col gap-2 @min-[28rem]:flex-row @min-[28rem]:items-start @min-[28rem]:justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="type-ui text-heading">{name}</span>
              {die && <span className="type-small text-muted">{die}</span>}
            </div>
            <div className="type-small text-muted">
              {definition.className} {classLevel}
            </div>
          </div>
          <Tooltip content={`Reset ${name}`}>
            <Button
              variant="ghost"
              size="xs"
              onClick={onReset}
              aria-label={`Reset ${name}`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="type-ui text-heading tabular-nums">
            {usesRemaining}
            <span className="type-small text-muted ml-0.5">/{maxUses}</span>
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
            <div className="flex flex-wrap">
              {Array.from({ length: maxUses }, (_, index) => {
                const filled = index < usesRemaining;
                return (
                  <button
                    key={index}
                    type="button"
                    aria-label={filled ? `Spend ${name}` : `Restore ${name}`}
                    onClick={() => (filled ? onSpend(1) : onRestore(1))}
                    className="focus-visible:outline-ring flex min-h-6 min-w-6 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-2.5 rounded-full border-[1.5px]',
                        filled
                          ? CLASS_RESOURCE_STYLE.pipOn
                          : CLASS_RESOURCE_STYLE.pipOff
                      )}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isPool && (
        <div className="bg-divider mt-2 h-1 w-full">
          <div
            data-resource-bar-fill
            className={cn('h-full', CLASS_RESOURCE_STYLE.barFill)}
            style={{
              width: `${maxUses > 0 ? (usesRemaining / maxUses) * 100 : 0}%`,
            }}
          />
        </div>
      )}

      {description && (
        <div className="type-small text-muted mt-1.5">{description}</div>
      )}
    </li>
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
