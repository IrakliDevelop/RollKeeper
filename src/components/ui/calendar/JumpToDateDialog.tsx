'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import type { CalendarConfig, CalendarDate } from '@/types/calendar';

interface JumpToDateDialogProps {
  open: boolean;
  onClose: () => void;
  onJump: (year: number, month: number, day: number) => void;
  config: CalendarConfig;
  currentDate: CalendarDate;
}

export function JumpToDateDialog({
  open,
  onClose,
  onJump,
  config,
  currentDate,
}: JumpToDateDialogProps) {
  const [year, setYear] = useState(currentDate.year);
  const [month, setMonth] = useState(currentDate.month);
  const [day, setDay] = useState(currentDate.dayOfMonth);

  useEffect(() => {
    if (open) {
      setYear(currentDate.year);
      setMonth(currentDate.month);
      setDay(currentDate.dayOfMonth);
    }
  }, [open, currentDate]);

  const daysInMonth = config.months[month]?.days ?? 28;

  useEffect(() => {
    if (day >= daysInMonth) {
      setDay(daysInMonth - 1);
    }
  }, [month, daysInMonth, day]);

  const handleJump = () => {
    onJump(year, month, day);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Campaign Start Date</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <p className="text-muted text-sm">
            Set when the campaign begins. The day counter will be calculated
            from this date. Current time will also move to this date.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-body mb-1 block text-sm font-medium">
                Year
              </label>
              <Input
                type="number"
                value={year}
                onChange={e => setYear(Number(e.target.value))}
              />
            </div>
            <SelectField
              label="Month"
              value={String(month)}
              onValueChange={v => setMonth(Number(v))}
            >
              {config.months.map((m, i) => (
                <SelectItem key={i} value={String(i)}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectField>
            <SelectField
              label="Day"
              value={String(day)}
              onValueChange={v => setDay(Number(v))}
            >
              {Array.from({ length: daysInMonth }, (_, i) => (
                <SelectItem key={i} value={String(i)}>
                  {i + 1}
                </SelectItem>
              ))}
            </SelectField>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleJump}>
            Set Start Date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
