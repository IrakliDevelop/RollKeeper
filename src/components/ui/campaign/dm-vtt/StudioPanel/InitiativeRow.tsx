'use client';

import { Badge } from '@/components/ui/layout/badge';
import { HPBar } from '@/components/shared/combat/HPBar';
import { AppIcon } from '@/components/ui/icons';
import { Tooltip } from '@/components/ui/primitives/Tooltip';

import { cn } from '@/utils/cn';
import { effectiveAc } from '@/utils/calculations';

import { dispositionColor } from '../combatantToken';

import type { EncounterEntity } from '@/types/encounter';

export interface InitiativeRowProps {
  entity: EncounterEntity;
  isActive: boolean;
  isSelected: boolean;
  onSelect: (entityId: string) => void;
}

/**
 * Single initiative-tab row: initiative value, disposition stripe, name
 * (+ concentration/hidden glyphs), HP bar, and AC. The active row (the
 * entity at `sorted[encounter.currentTurn]`) gets a static brass fill, left
 * rule and a visible "Current turn" line; the DM-selected row gets an inset
 * brass ring (inset so the panel's overflow cannot clip it).
 */
export function InitiativeRow({
  entity,
  isActive,
  isSelected,
  onSelect,
}: InitiativeRowProps) {
  const stripeColor = dispositionColor(entity);

  return (
    <li>
      <button
        type="button"
        aria-current={isActive ? 'true' : undefined}
        aria-pressed={isSelected}
        onClick={() => onSelect(entity.id)}
        className={cn(
          'focus-visible:outline-ring flex min-h-9 w-full items-center gap-2 border-l-2 px-2 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 pointer-coarse:min-h-11',
          isActive
            ? 'bg-brass-bg border-brass-border'
            : 'hover:bg-surface-hover border-transparent',
          isSelected && 'ring-brass-border ring-2 ring-inset'
        )}
      >
        <span
          className="h-8 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: stripeColor }}
          aria-hidden
        />
        <span className="type-ui text-heading w-6 shrink-0 text-center tabular-nums">
          {entity.initiative ?? '—'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="type-ui text-heading truncate">{entity.name}</span>
            {entity.concentrationSpell && (
              <Tooltip
                content={`Concentrating on ${entity.concentrationSpell}`}
              >
                <AppIcon
                  name="concentration"
                  label={`Concentrating on ${entity.concentrationSpell}`}
                  className="text-lapis-text size-3.5 shrink-0"
                />
              </Tooltip>
            )}
            {entity.isHidden && (
              <Badge variant="neutral" size="sm">
                Hidden
              </Badge>
            )}
          </span>
          {isActive && (
            <span className="type-small text-brass-text block">
              Current turn
            </span>
          )}
          <HPBar
            current={entity.currentHp}
            max={entity.maxHp}
            temp={entity.tempHp}
            size="sm"
          />
        </span>
        <span className="type-small text-muted shrink-0 tabular-nums">
          AC {effectiveAc(entity.armorClass, entity.tempAc)}
        </span>
      </button>
    </li>
  );
}
