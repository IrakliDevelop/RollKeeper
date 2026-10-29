'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { PopoverShell } from '@/components/ui/forms/AnchoredEditor/PopoverShell';
import { SheetShell } from '@/components/ui/forms/AnchoredEditor/SheetShell';
import { useKeyboardInset } from '@/components/ui/forms/AnchoredEditor/AnchoredEditor.hooks';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { CharacterState } from '@/types/character';

const SPEEDS = [
  ['speed', 'Walk'],
  ['flySpeed', 'Fly'],
  ['climbSpeed', 'Climb'],
  ['swimSpeed', 'Swim'],
] as const;
type Speeds = Pick<
  CharacterState,
  'speed' | 'flySpeed' | 'climbSpeed' | 'swimSpeed'
>;

export function SpeedEditor({
  character,
  trigger,
  onSave,
}: {
  character: CharacterState;
  trigger: React.ReactElement;
  onSave: (value: Partial<Speeds>) => void;
}) {
  const wide = useMediaQuery('(min-width: 640px)');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Speeds>>({
    speed: character.speed,
    flySpeed: character.flySpeed || 0,
    climbSpeed: character.climbSpeed || 0,
    swimSpeed: character.swimSpeed || 0,
  });
  const initial = useRef(draft);
  const fieldRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const handleOpenChange = (next: boolean) => {
    setDraft({
      speed: character.speed,
      flySpeed: character.flySpeed || 0,
      climbSpeed: character.climbSpeed || 0,
      swimSpeed: character.swimSpeed || 0,
    });
    if (next)
      initial.current = {
        speed: character.speed,
        flySpeed: character.flySpeed || 0,
        climbSpeed: character.climbSpeed || 0,
        swimSpeed: character.swimSpeed || 0,
      };
    setOpen(next);
  };
  const save = () => {
    const changes: Partial<Speeds> = {};
    for (const [key] of SPEEDS) {
      const next = Math.max(0, Math.trunc(draft[key] ?? 0));
      if (
        next !== (initial.current[key] || 0) &&
        next !== (character[key] || 0)
      )
        changes[key] = next;
    }
    if (Object.keys(changes).length) onSave(changes);
    setOpen(false);
  };
  const Shell = wide ? PopoverShell : SheetShell;
  return (
    <Shell
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger}
      label="Edit speeds"
      ids={{
        field: `${id}-speed`,
        label: `${id}-label`,
        message: `${id}-message`,
      }}
      fieldRef={fieldRef}
    >
      <div
        className="space-y-3"
        onKeyDown={event => {
          if (
            event.key === 'Enter' &&
            event.target instanceof HTMLInputElement
          ) {
            event.preventDefault();
            save();
          }
        }}
      >
        {SPEEDS.map(([key, label], index) => (
          <SpeedRow
            key={key}
            id={`${id}-${key}`}
            label={label}
            value={draft[key]}
            firstRef={index === 0 ? fieldRef : undefined}
            onChange={value =>
              setDraft(previous => ({ ...previous, [key]: value }))
            }
          />
        ))}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" variant="primary" onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </Shell>
  );
}
function SpeedRow({
  id,
  label,
  value,
  onChange,
  firstRef,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  firstRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = firstRef ?? ownRef;
  const inset = useKeyboardInset();
  useEffect(() => {
    if (inset > 0 && document.activeElement === ref.current)
      ref.current?.scrollIntoView({ block: 'nearest' });
  }, [inset, ref]);
  return (
    <div>
      <label htmlFor={id} className="type-small text-body">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(0, (value ?? 0) - 5))}
        >
          <Minus size={16} aria-hidden />
        </Button>
        <NumberInput
          ref={ref}
          id={id}
          value={value}
          min={0}
          allowEmpty
          onChange={onChange}
          className="type-num-md min-w-0 text-center"
        />
        <Button
          type="button"
          size="sm"
          aria-label={`Increase ${label}`}
          onClick={() => onChange((value ?? 0) + 5)}
        >
          <Plus size={16} aria-hidden />
        </Button>
        <span className="type-small text-muted">ft</span>
      </div>
    </div>
  );
}
