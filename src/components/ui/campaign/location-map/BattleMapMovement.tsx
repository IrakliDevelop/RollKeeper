import { useState } from 'react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import {
  useBattleMapMovement,
  type BattleMapMovementProps,
} from './useBattleMapMovement';

export function BattleMapMovement(props: BattleMapMovementProps) {
  const [range, setRange] = useState('30');
  const { tracker, token, movement, epoch, placing, setPlacing } =
    useBattleMapMovement(props);
  if (!epoch || !token) return null;
  return (
    <div
      className="bg-surface-raised border-divider pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border p-2 text-xs shadow-lg"
      aria-label="Turn movement"
    >
      <span className="text-body">
        {movement?.feet ?? 0} ft moved · {movement?.remaining ?? 0} ft remaining
      </span>
      <Button variant="ghost" onClick={() => tracker.reset(token.id)}>
        Reset movement
      </Button>
      <Input
        aria-label="Teleport range in feet"
        type="number"
        min="0"
        value={range}
        onChange={event => setRange(event.target.value)}
        className="w-20"
      />
      <Button
        variant="outline"
        disabled={
          range.trim() === '' ||
          !Number.isFinite(Number(range)) ||
          Number(range) < 0
        }
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
