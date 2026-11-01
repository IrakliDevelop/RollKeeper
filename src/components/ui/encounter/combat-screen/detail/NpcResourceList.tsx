'use client';

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { CLASS_RESOURCE_STYLE } from '@/components/ui/character/classResourceStyles';
import type { NpcResource } from '@/types/encounter';
import type { DetailSectionProps } from './DetailHeader';

export interface NpcResourceListProps {
  resources: NpcResource[];
  onSpend: (resourceId: string, amount: number) => void;
  onRestore: (resourceId: string, amount: number) => void;
  /** Read-only rendering: pips become static dots, pool loses its −/+ buttons. */
  readOnly?: boolean;
}

/** Compact NPC resource rows shared by encounter and NPC detail views. */
export function NpcResourceList({
  resources,
  onSpend,
  onRestore,
  readOnly = false,
}: NpcResourceListProps) {
  if (resources.length === 0) return null;

  return (
    <Section heading="Class resources" level={4}>
      <div className="divide-divider divide-y">
        {resources.map(res => {
          const remaining = Math.max(0, res.maxUses - res.usesExpended);
          return (
            <div
              key={res.id}
              data-resource-row
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1"
            >
              <span className="type-ui text-heading w-40 min-w-0 font-semibold">
                {res.name}
              </span>
              {res.displayStyle === 'pips' ? (
                <div className="flex flex-wrap">
                  {Array.from({ length: res.maxUses }, (_, index) => {
                    const available = index < remaining;
                    const dot = (
                      <span
                        aria-hidden="true"
                        className={`size-2.5 rounded-full border-[1.5px] ${available ? CLASS_RESOURCE_STYLE.pipOn : CLASS_RESOURCE_STYLE.pipOff}`}
                      />
                    );
                    const label = `${res.name} use ${index + 1}`;
                    return readOnly ? (
                      <span
                        key={index}
                        role="img"
                        aria-label={`${label}, ${available ? 'available' : 'spent'}`}
                        className="flex min-h-6 min-w-6 items-center justify-center"
                      >
                        {dot}
                      </span>
                    ) : (
                      <button
                        key={index}
                        type="button"
                        aria-label={`${available ? 'Spend' : 'Restore'} ${label}`}
                        title={
                          available
                            ? `Spend ${res.name} use`
                            : `Restore ${res.name} use`
                        }
                        onClick={() =>
                          available ? onSpend(res.id, 1) : onRestore(res.id, 1)
                        }
                        className="focus-visible:outline-brass-border flex min-h-6 min-w-6 items-center justify-center rounded-sm focus-visible:outline-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                      >
                        {dot}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  {!readOnly && (
                    <Button
                      type="button"
                      size="sm"
                      className="w-11 px-0 pointer-coarse:min-h-11"
                      onClick={() => onSpend(res.id, 1)}
                      disabled={remaining === 0}
                      aria-label={`Spend ${res.name}`}
                    >
                      <Minus size={14} aria-hidden="true" />
                    </Button>
                  )}
                  <span className="type-ui text-heading min-w-14 text-center tabular-nums">
                    {remaining}/{res.maxUses}
                  </span>
                  {!readOnly && (
                    <Button
                      type="button"
                      size="sm"
                      className="w-11 px-0 pointer-coarse:min-h-11"
                      onClick={() => onRestore(res.id, 1)}
                      disabled={res.usesExpended === 0}
                      aria-label={`Restore ${res.name}`}
                    >
                      <Plus size={14} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/** Encounter wrapper wired to EntityActions. */
export function DetailResources({ entity, actions }: DetailSectionProps) {
  const resources = entity.resources;
  if (!resources || resources.length === 0) return null;
  return (
    <NpcResourceList
      resources={resources}
      onSpend={(resourceId, amount) =>
        actions.onSpendResource(entity.id, resourceId, amount)
      }
      onRestore={(resourceId, amount) =>
        actions.onRestoreResource(entity.id, resourceId, amount)
      }
    />
  );
}
