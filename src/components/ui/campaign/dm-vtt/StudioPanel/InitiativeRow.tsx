'use client';

import { Badge } from '@/components/ui/layout/badge';
import { HPBar } from '@/components/shared/combat/HPBar';
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
 * (+ concentration/hidden glyphs), HP bar, and AC. Active row (the entity at
 * `sorted[encounter.currentTurn]`) gets an amber pulse; the DM-selected row
 * gets a blue border.
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
        onClick={() => onSelect(entity.id)}
        className={`flex min-h-[44px] w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
          isActive
            ? 'bg-accent-amber-bg animate-pulse'
            : 'hover:bg-surface-secondary'
        } ${
          isSelected
            ? 'border-accent-blue-border'
            : isActive
              ? 'border-accent-amber-border'
              : 'border-divider'
        }`}
      >
        <span
          className="h-8 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: stripeColor }}
          aria-hidden
        />
        <span className="text-heading w-6 shrink-0 text-center text-sm font-bold tabular-nums">
          {entity.initiative ?? '—'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="text-body truncate text-xs font-medium">
              {entity.name}
            </span>
            {entity.concentrationSpell && (
              <span title={`Concentrating: ${entity.concentrationSpell}`}>
                🧠
              </span>
            )}
            {entity.isHidden && (
              <Badge variant="neutral" size="sm">
                hidden
              </Badge>
            )}
          </span>
          <HPBar
            current={entity.currentHp}
            max={entity.maxHp}
            temp={entity.tempHp}
            size="sm"
          />
        </span>
        <span className="text-faint shrink-0 text-[10px] font-semibold">
          AC {effectiveAc(entity.armorClass, entity.tempAc)}
        </span>
      </button>
    </li>
  );
}
