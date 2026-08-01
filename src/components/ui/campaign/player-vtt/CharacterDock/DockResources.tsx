import { Button } from '@/components/ui/forms/button';

import type { ActiveClassResource } from '@/utils/classResources';

export interface DockResourcesProps {
  resources: ActiveClassResource[];
  onSpend: (id: string) => void;
  onRestore: (id: string) => void;
}

/**
 * Compact class-resource rows (Rage, Ki, Bardic Inspiration…) for the VTT
 * dock — all active resources, no cap (unlike the sheet HUD's four-chip
 * limit). Renders nothing when the class has none.
 */
export function DockResources({
  resources,
  onSpend,
  onRestore,
}: DockResourcesProps) {
  if (resources.length === 0) return null;

  return (
    <div>
      <div className="text-faint mb-1.5 text-xs font-bold tracking-wider uppercase">
        Resources
      </div>
      <div className="space-y-1.5">
        {resources.map(resource => {
          const { definition, maxUses, usesRemaining, die } = resource;
          return (
            <div
              key={definition.id}
              className="border-divider flex min-h-[44px] items-center justify-between gap-2 rounded-lg border px-2.5 py-1"
            >
              <div className="min-w-0">
                <span className="text-heading block truncate text-sm font-semibold">
                  {definition.name}
                  {die && (
                    <span className="text-muted ml-1 text-xs">{die}</span>
                  )}
                </span>
                <span className="text-faint text-[10px]">
                  {usesRemaining}/{maxUses}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => onSpend(definition.id)}
                  disabled={usesRemaining === 0}
                  aria-label={`Spend ${definition.name}`}
                >
                  −
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => onRestore(definition.id)}
                  disabled={usesRemaining === maxUses}
                  aria-label={`Restore ${definition.name}`}
                >
                  +
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
