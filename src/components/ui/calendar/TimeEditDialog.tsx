'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import type { CalendarConfig, CalendarDate } from '@/types/calendar';

interface TimeEditDialogProps {
  open: boolean;
  onClose: () => void;
  date: CalendarDate;
  config: CalendarConfig;
  /** Called with the new (hour, minute), already clamped to the clock. */
  onSave: (hour: number, minute: number) => void;
}

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

type TimeEditFormProps = Omit<TimeEditDialogProps, 'open'>;

/** Mounts on each open, so the draft starts from the current time. */
function TimeEditForm({ onClose, date, config, onSave }: TimeEditFormProps) {
  const [hour, setHour] = useState(date.hour);
  const [minute, setMinute] = useState(date.minute);
  const maxHour = config.clock.hoursPerDay - 1;
  const maxMinute = config.clock.minutesPerHour - 1;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(clamp(hour, maxHour), clamp(minute, maxMinute));
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit time</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Hour"
            min={0}
            max={maxHour}
            autoFocus
            value={hour}
            onChange={v => setHour(v ?? 0)}
          />
          <NumberInput
            label="Minute"
            min={0}
            max={maxMinute}
            value={minute}
            onChange={v => setMinute(v ?? 0)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Set time
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

export function TimeEditDialog({
  open,
  onClose,
  date,
  config,
  onSave,
}: TimeEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent size="sm" aria-describedby={undefined}>
        <TimeEditForm
          onClose={onClose}
          date={date}
          config={config}
          onSave={onSave}
        />
      </DialogContent>
    </Dialog>
  );
}
