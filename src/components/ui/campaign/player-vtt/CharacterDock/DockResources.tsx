import { Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { Tooltip } from '@/components/ui/primitives/Tooltip';

import type { ActiveClassResource } from '@/utils/classResources';

export interface DockResourcesProps {
  resources: ActiveClassResource[];
  onSpend: (id: string) => void;
  onRestore: (id: string) => void;
}

/**
 * Compact class-resource rows (Rage, Ki, Bardic Inspiration…) for the VTT
 * dock — all active resources, no cap (unlike the sheet HUD's four-chip
 * limit). Renders nothing when the class has none. Its two Tooltips per row
 * need the `TooltipProvider` that `PlayerVttScreen` wraps around the floating
 * panels.
 */
export function DockResources({
  resources,
  onSpend,
  onRestore,
}: DockResourcesProps) {
  if (resources.length === 0) return null;

  return (
    <Section level={4} heading="Resources">
      <ul className="divide-divider divide-y">
        {resources.map(resource => {
          const { definition, maxUses, usesRemaining, die } = resource;
          return (
            <li
              key={definition.id}
              className="flex items-center justify-between gap-2 py-1 pointer-coarse:min-h-11"
            >
              <div className="min-w-0">
                <p className="type-ui text-heading truncate">
                  {definition.name}
                  {die && (
                    <span className="type-small text-muted ml-1">{die}</span>
                  )}
                </p>
                <p className="type-small text-heading tabular-nums">
                  {usesRemaining}/{maxUses}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Tooltip content={`Spend ${definition.name}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-9 shrink-0 px-0"
                    aria-label={`Spend ${definition.name}`}
                    disabled={usesRemaining === 0}
                    onClick={() => onSpend(definition.id)}
                  >
                    <Minus size={16} aria-hidden />
                  </Button>
                </Tooltip>
                <Tooltip content={`Restore ${definition.name}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-9 shrink-0 px-0"
                    aria-label={`Restore ${definition.name}`}
                    disabled={usesRemaining === maxUses}
                    onClick={() => onRestore(definition.id)}
                  >
                    <Plus size={16} aria-hidden />
                  </Button>
                </Tooltip>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
