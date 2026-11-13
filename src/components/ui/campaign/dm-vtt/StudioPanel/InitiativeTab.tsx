'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';

import { getSortedEntities } from '@/store/encounterStore';

import { InitiativeRow } from './InitiativeRow';

import type { Encounter } from '@/types/encounter';

export interface InitiativeTabProps {
  encounter: Encounter | null;
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
  encounterHref: string;
}

/**
 * Initiative order list for the studio panel. Sorts with the same
 * `getSortedEntities` util `buildSharedInitiative` uses for the player-facing
 * turn order, so the DM's row order matches what players see. The entity at
 * `sorted[encounter.currentTurn]` is marked as the current turn.
 */
export function InitiativeTab({
  encounter,
  selectedEntityId,
  onSelectEntity,
  encounterHref,
}: InitiativeTabProps) {
  if (!encounter) {
    return (
      <p className="type-small text-muted px-3 py-4">
        Link an encounter in Setup mode
      </p>
    );
  }

  if (!encounter.isActive) {
    return (
      <div className="space-y-2 px-3 py-4">
        <p className="type-small text-muted">
          Start combat from the encounter page.
        </p>
        <Button
          asChild
          variant="link"
          size="sm"
          className="px-1"
          rightIcon={<ExternalLink size={14} />}
        >
          <Link href={encounterHref} target="_blank" rel="noopener noreferrer">
            Encounter page
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
        </Button>
      </div>
    );
  }

  const sorted = getSortedEntities(encounter.entities);

  return (
    <ul className="divide-divider divide-y">
      {sorted.map((entity, index) => (
        <InitiativeRow
          key={entity.id}
          entity={entity}
          isActive={index === encounter.currentTurn}
          isSelected={entity.id === selectedEntityId}
          onSelect={onSelectEntity}
        />
      ))}
    </ul>
  );
}
