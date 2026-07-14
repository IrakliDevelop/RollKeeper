'use client';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';

import type { BattleMap } from '@/types/battlemap';

interface BattleMapPickerRowProps {
  battleMap: BattleMap;
  isCurrent: boolean;
  hasCurrent: boolean;
  onUnlink: () => void;
  onOpen: () => void;
}

/** Single battle map row in the picker: name, status badges, and its action. */
export function BattleMapPickerRow({
  battleMap,
  isCurrent,
  hasCurrent,
  onUnlink,
  onOpen,
}: BattleMapPickerRowProps) {
  const inUse = !isCurrent && battleMap.linkedEncounterIds.length > 0;

  return (
    <div className="border-divider bg-surface-secondary flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <div className="min-w-0">
        <span className="text-heading block truncate text-sm font-medium">
          {battleMap.name}
        </span>
        <span className="text-muted text-xs">
          Updated {new Date(battleMap.updatedAt).toLocaleDateString()}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isCurrent && <Badge variant="success">Current</Badge>}
        {inUse && <Badge variant="neutral">In use</Badge>}
        {isCurrent ? (
          <>
            <Button variant="ghost" size="sm" onClick={onUnlink}>
              Unlink
            </Button>
            <Button variant="primary" size="sm" onClick={onOpen}>
              Open
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={onOpen}>
            {hasCurrent ? 'Switch & open' : 'Link & open'}
          </Button>
        )}
      </div>
    </div>
  );
}
