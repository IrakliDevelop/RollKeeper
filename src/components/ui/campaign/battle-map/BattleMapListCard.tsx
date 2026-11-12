'use client';

import React from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import type { BattleMap } from '@/types/battlemap';

interface BattleMapListCardProps {
  battleMap: BattleMap;
  campaignCode: string;
  onDelete: (id: string) => void;
}

export function BattleMapListCard({
  battleMap,
  campaignCode,
  onDelete,
}: BattleMapListCardProps) {
  const encounterCount = battleMap.linkedEncounterIds.length;

  async function handleDelete() {
    const confirmed = await confirmDialog({
      title: `Delete ${battleMap.name}?`,
      message:
        'The map and everything on it are removed from this campaign and from your players.',
      confirmLabel: 'Delete battle map',
      tone: 'danger',
    });
    if (confirmed) onDelete(battleMap.id);
  }

  return (
    <div className="bg-surface-raised border-divider has-[a:focus-visible]:ring-brass-fill relative overflow-hidden rounded-md border has-[a:focus-visible]:ring-2">
      <Link
        href={`/dm/campaign/${campaignCode}/battlemaps/${battleMap.id}`}
        className="block focus-visible:outline-none"
      >
        <div className="bg-surface-secondary h-40 w-full">
          {battleMap.mapImageUrl ? (
            <img
              src={battleMap.mapImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="type-small text-muted flex h-full w-full items-center justify-center">
              No image
            </div>
          )}
        </div>
        <div className="flex min-h-12 items-center gap-2 px-3 py-2 pr-14 pointer-coarse:min-h-14">
          <p className="type-ui text-heading truncate">{battleMap.name}</p>
          {encounterCount > 0 && (
            <Badge variant="neutral" className="shrink-0">
              {`${encounterCount} encounter${encounterCount !== 1 ? 's' : ''}`}
            </Badge>
          )}
        </div>
      </Link>
      <Button
        variant="danger"
        size="sm"
        aria-label={`Delete ${battleMap.name}`}
        onClick={handleDelete}
        className="absolute right-2 bottom-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
      >
        <Trash2 size={14} aria-hidden="true" />
      </Button>
    </div>
  );
}

export default BattleMapListCard;
