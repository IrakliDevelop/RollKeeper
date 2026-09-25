'use client';

import { Swords } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';

interface CreatureSheetPillProps {
  name: string;
  onOpen: () => void;
}

/** Top-center pill offering to open the creature sheet drawer for the
 * currently-selected non-player combatant — sibling extraction from
 * `DmVttScreen.tsx` to stay under the 150-line file cap, mirrors
 * `PlacementBanner`'s positioning. */
export function CreatureSheetPill({ name, onOpen }: CreatureSheetPillProps) {
  return (
    <div className="pointer-events-auto absolute top-[var(--dm-vtt-panel-top,8rem)] left-1/2 -translate-x-1/2">
      <Button
        variant="secondary"
        leftIcon={<Swords size={16} />}
        aria-label={`Open ${name} sheet`}
        onClick={onOpen}
      >
        Sheet · {name}
      </Button>
    </div>
  );
}
