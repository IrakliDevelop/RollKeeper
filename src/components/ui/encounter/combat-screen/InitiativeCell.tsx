'use client';

import { NumberInput } from '@/components/ui/forms/NumberInput';
import type { EncounterEntity } from '@/types/encounter';

interface InitiativeCellProps {
  entity: EncounterEntity;
  isRail: boolean;
  isActive: boolean;
  onSetInitiative: (entityId: string, value: number) => void;
}

export function InitiativeCell({
  entity,
  isRail,
  isActive,
  onSetInitiative,
}: InitiativeCellProps) {
  return (
    <NumberInput
      value={entity.initiative ?? undefined}
      onChange={value => {
        if (value !== undefined) onSetInitiative(entity.id, value);
      }}
      integer={false}
      allowEmpty
      live={false}
      aria-label={`${entity.name} initiative`}
      placeholder="—"
      wrapperClassName={isRail ? 'w-16 shrink-0' : 'w-14 shrink-0'}
      className={`text-center tabular-nums ${isActive ? 'border-brass-border' : ''}`}
    />
  );
}
