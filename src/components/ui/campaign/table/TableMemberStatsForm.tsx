'use client';

import { useId, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import type { TableActorLiveStatsV1 } from '@/lib/table/schema';

const FIELDS: { key: keyof TableActorLiveStatsV1; label: string }[] = [
  { key: 'currentHp', label: 'Current HP' },
  { key: 'maxHp', label: 'Max HP' },
  { key: 'tempHp', label: 'Temp HP' },
  { key: 'armorClass', label: 'Armor class' },
];

/** DM-managed non-PC stats; saved only through a committed roster command. */
export function TableMemberStatsForm({
  stats,
  busy,
  onSave,
}: {
  stats: TableActorLiveStatsV1;
  busy: boolean;
  onSave: (next: TableActorLiveStatsV1) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map(({ key }) => [key, String(stats[key])]))
  );
  const parsed = FIELDS.map(({ key }) => Number(draft[key]));
  const valid = parsed.every(value => Number.isFinite(value));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const next = { ...stats, conditions: [...stats.conditions] };
    FIELDS.forEach(({ key }, index) => {
      (next as Record<string, unknown>)[key] = parsed[index];
    });
    onSave(next);
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(({ key, label }) => (
          <Input
            key={key}
            id={`${id}-${key}`}
            label={label}
            type="number"
            inputMode="numeric"
            value={draft[key]}
            onChange={event =>
              setDraft(current => ({ ...current, [key]: event.target.value }))
            }
          />
        ))}
      </div>
      <Button
        type="submit"
        variant="primary"
        size="sm"
        disabled={!valid || busy}
      >
        Save stats
      </Button>
    </form>
  );
}
