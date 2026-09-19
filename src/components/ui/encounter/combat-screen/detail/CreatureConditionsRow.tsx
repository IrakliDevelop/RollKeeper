'use client';

import { Button } from '@/components/ui/forms/button';
import { getConditionIcon } from '@/utils/conditionIcons';

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
      <h4 className="text-muted text-[11px] font-semibold tracking-wider uppercase">
        From creatures
      </h4>
      <div className="flex flex-wrap gap-1">
        {items.map(item => {
          const { condition, sourceName } = item;
          const Icon = getConditionIcon(
            condition.name,
            condition.kind,
            condition.icon
          );
          return (
            <Button
              key={condition.id}
              variant="outline"
              size="xs"
              type="button"
              disabled={activeNames.has(condition.name)}
              aria-label={`${condition.name} (from ${sourceName})`}
              title={condition.description || `From ${sourceName}`}
              onClick={() => onApply(item)}
            >
              <Icon size={11} aria-hidden />
              {condition.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
