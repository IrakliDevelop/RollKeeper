import { useState } from 'react';
import { Button } from '@/components/ui/forms/button';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import {
  useBattleMapMovement,
  type BattleMapMovementProps,
} from './useBattleMapMovement';

export function BattleMapMovement(props: BattleMapMovementProps) {
  const [range, setRange] = useState<number | undefined>(30);
  const { tracker, token, movement, epoch, placing, setPlacing } =
    useBattleMapMovement(props);
  if (!epoch || !token) return null;
  return (
    <div
      className={`${OVERLAY_SURFACE} type-small pointer-events-auto flex flex-wrap items-center gap-2 p-2`}
      aria-label="Turn movement"
    >
      <span className="text-body">
        {movement?.feet ?? 0} ft moved · {movement?.remaining ?? 0} ft remaining
      </span>
      <Button variant="ghost" onClick={() => tracker.reset(token.id)}>
        Reset movement
      </Button>
      <NumberInput
        aria-label="Teleport range in feet"
        min="0"
        value={range}
        onChange={setRange}
        allowEmpty
        className="w-20"
      />
      <Button
        variant="outline"
        disabled={range === undefined || !Number.isFinite(range) || range < 0}
        onClick={() =>
          setPlacing(
            tracker.startPlacement(
              token.id,
              {
                id: 'teleport',
                label: 'Teleport',
                counts: false,
                maxFeet: Number(range),
              },
              { hint: 'Choose teleport destination · Escape cancels' }
            )
          )
        }
      >
        Teleport
      </Button>
      {placing && (
        <Button variant="ghost" onClick={() => tracker.cancelPlacement()}>
          Cancel teleport
        </Button>
      )}
      <span className="text-muted">Drag to move · F adds a waypoint</span>
    </div>
  );
}
