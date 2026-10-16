'use client';

import { useId, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';

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
  const [maxHp, setMaxHp] = useState('10');
  const [armorClass, setArmorClass] = useState('10');
  const hp = Number.parseInt(maxHp, 10);
  const ac = Number.parseInt(armorClass, 10);
  const valid =
    name.trim().length > 0 &&
    Number.isFinite(hp) &&
    hp > 0 &&
    Number.isFinite(ac) &&
    ac >= 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
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
        <Input
          id={`${id}-hp`}
          label="Max HP"
          type="number"
          inputMode="numeric"
          min={1}
          value={maxHp}
          onChange={event => setMaxHp(event.target.value)}
        />
        <Input
          id={`${id}-ac`}
          label="Armor class"
          type="number"
          inputMode="numeric"
          min={0}
          value={armorClass}
          onChange={event => setArmorClass(event.target.value)}
        />
      </div>
      <Button type="submit" variant="primary" disabled={!valid || disabled}>
        Add PC
      </Button>
    </form>
  );
}
