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
    <li className="flex items-center justify-between gap-3 py-2 pointer-coarse:min-h-11">
      <div className="min-w-0">
        <span className="type-ui text-heading block truncate">
          {battleMap.name}
        </span>
        <span className="type-small text-muted">
          Updated {new Date(battleMap.updatedAt).toLocaleDateString()}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isCurrent && <Badge variant="primary">Current</Badge>}
        {inUse && <Badge variant="neutral">In use</Badge>}
        {isCurrent ? (
          <>
            <Button variant="ghost" size="sm" onClick={onUnlink}>
              Unlink
            </Button>
            <Button variant="secondary" size="sm" onClick={onOpen}>
              Open
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={onOpen}>
            {hasCurrent ? 'Switch & open' : 'Link & open'}
          </Button>
        )}
      </div>
    </li>
  );
}
