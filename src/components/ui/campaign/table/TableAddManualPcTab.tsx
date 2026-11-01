'use client';

import { useId, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';

import { manualPcStats } from './tableRosterModel';

/**
 * Manual PC for a player without an account or campaign identity: a
 * DM-managed participant with no player principal (never player-movable).
 */
export function TableAddManualPcTab({
  onAdd,
  disabled,
}: {
  onAdd: (stats: ReturnType<typeof manualPcStats>) => void;
  disabled: boolean;
}) {
  const id = useId();
  const [name, setName] = useState('');
  const [hp, setHp] = useState<number | undefined>(10);
  const [ac, setAc] = useState<number | undefined>(10);
  const valid =
    name.trim().length > 0 &&
    hp !== undefined &&
    hp > 0 &&
    ac !== undefined &&
    ac >= 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid || hp === undefined || ac === undefined) return;
    onAdd(manualPcStats({ name, maxHp: hp, armorClass: ac }));
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <p className="text-muted text-sm">
        A character only you control. It isn&apos;t linked to any player.
      </p>
      <Input
        id={`${id}-name`}
        label="Name"
        value={name}
        onChange={event => setName(event.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          id={`${id}-hp`}
          label="Max HP"
          min={1}
          allowEmpty
          value={hp}
          onChange={setHp}
        />
        <NumberInput
          id={`${id}-ac`}
          label="Armor class"
          min={0}
          allowEmpty
          value={ac}
          onChange={setAc}
        />
      </div>
      <Button type="submit" variant="primary" disabled={!valid || disabled}>
        Add PC
      </Button>
    </form>
  );
}
