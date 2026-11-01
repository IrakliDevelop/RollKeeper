'use client';

import { Button } from '@/components/ui/forms/button';
import { getConditionIcon } from '@/utils/conditionIcons';
import { effectSummary } from './effectSummary';

import type { CreatureCondition } from '@/utils/customConditions';

interface CreatureConditionsRowProps {
  items: CreatureCondition[];
  activeNames: ReadonlySet<string>;
  onApply: (item: CreatureCondition) => void;
}

/** One-click conditions offered by the creatures in this encounter. */
export function CreatureConditionsRow({
  items,
  activeNames,
  onApply,
}: CreatureConditionsRowProps) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <h4 className="type-label-heading text-heading">From creatures</h4>
      <div className="grid gap-2">
        {items.map(item => {
          const { condition, sourceName } = item;
          const Icon = getConditionIcon(
            condition.name,
            condition.kind,
            condition.icon
          );
          return (
            <div
              key={condition.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1"
            >
              <Button
                variant="secondary"
                size="xs"
                type="button"
                disabled={activeNames.has(condition.name)}
                aria-label={`Apply ${condition.name} (from ${sourceName})`}
                onClick={() => onApply(item)}
              >
                <Icon size={12} aria-hidden="true" />
                {condition.name}
              </Button>
              <span className="text-muted text-xs">From {sourceName}</span>
              {condition.description && (
                <span className="text-muted line-clamp-1 min-w-0 flex-1 text-xs">
                  {effectSummary(condition.description)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
