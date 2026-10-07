'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { getSortedEntities } from '@/store/encounterStore';

import { InitiativeRow } from './InitiativeRow';

import type { Encounter } from '@/types/encounter';

export interface InitiativeTabProps {
  encounter: Encounter | null;
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
  encounterHref: string;
  /** Replaces "No encounter linked yet." (Table scene runs). */
  emptyContent?: ReactNode;
  /** Replaces the "Start combat from the encounter page." block. */
  inactiveContent?: ReactNode;
  /** Rows whose live HP is unavailable: shown as "HP —", never 0/0. */
  hpUnknownEntityIds?: ReadonlySet<string>;
}

/**
 * Initiative order list for the studio panel. Sorts with the same
 * `getSortedEntities` util `buildSharedInitiative` uses for the player-facing
 * turn order, so the DM's row order matches what players see. The entity at
 * `sorted[encounter.currentTurn]` is highlighted as the active turn.
 */
export function InitiativeTab({
  encounter,
  selectedEntityId,
  onSelectEntity,
  encounterHref,
  emptyContent,
  inactiveContent,
  hpUnknownEntityIds,
}: InitiativeTabProps) {
  if (!encounter) {
    if (emptyContent !== undefined) return <>{emptyContent}</>;
    return (
      <p className="text-muted px-3 py-4 text-xs">No encounter linked yet.</p>
    );
  }

  if (!encounter.isActive) {
    if (inactiveContent !== undefined) return <>{inactiveContent}</>;
    return (
      <div className="space-y-2 px-3 py-4">
        <p className="text-muted text-xs">
          Start combat from the encounter page.
        </p>
        <Link
          href={encounterHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-blue-text text-xs font-semibold hover:underline"
        >
          Encounter page ↗
        </Link>
      </div>
    );
  }

  const sorted = getSortedEntities(encounter.entities);

  return (
    <ul className="space-y-1 px-2 py-2">
      {sorted.map((entity, index) => (
        <InitiativeRow
          key={entity.id}
          entity={entity}
          isActive={index === encounter.currentTurn}
          isSelected={entity.id === selectedEntityId}
          onSelect={onSelectEntity}
          hpUnknown={hpUnknownEntityIds?.has(entity.id)}
        />
      ))}
    </ul>
  );
}
