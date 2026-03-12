'use client';

import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog-new';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import RichTextEditor from '@/components/ui/forms/RichTextEditor';
import type { CalendarConfig, CalendarEvent } from '@/types/calendar';
import type { SelectedDay } from './CalendarGrid';

interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    year: number;
    month: number;
    day: number;
  }) => void;
  onDelete?: () => void;
  event?: CalendarEvent;
  config: CalendarConfig;
  defaultDate?: SelectedDay;
}

export function EventDialog({
  open,
  onClose,
  onSave,
  onDelete,
  event,
  config,
  defaultDate,
}: EventDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0);
  const [day, setDay] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = !!event;

  useEffect(() => {
    if (open) {
      if (event) {
        setTitle(event.title);
        setDescription(event.description);
        setYear(event.year);
        setMonth(event.month);
        setDay(event.day);
      } else if (defaultDate) {
        setTitle('');
        setDescription('');
        setYear(defaultDate.year);
        setMonth(defaultDate.month);
        setDay(defaultDate.day);
      }
      setConfirmDelete(false);
    }
  }, [open, event, defaultDate]);

  // Clamp day when month changes
  const daysInSelectedMonth = config.months[month]?.days ?? 30;
  useEffect(() => {
    if (day >= daysInSelectedMonth) {
      setDay(daysInSelectedMonth - 1);
    }
  }, [month, daysInSelectedMonth, day]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), description, year, month, day });
    onClose();
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Event' : 'New Event'}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Input
            label="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Event title"
            required
          />

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
              {Array.from({ length: daysInSelectedMonth }, (_, i) => (
                <SelectItem key={i} value={String(i)}>
                  {i + 1}
                </SelectItem>
              ))}
            </SelectField>
          </div>

          <div>
            <label className="text-body mb-1 block text-sm font-medium">
              Description
            </label>
            <RichTextEditor
              content={description}
              onChange={setDescription}
              placeholder="Event details..."
              minHeight="120px"
            />
          </div>
        </DialogBody>

        <DialogFooter>
          {isEdit && onDelete && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 size={14} />}
              onClick={handleDelete}
              className="mr-auto"
            >
              {confirmDelete ? 'Confirm Delete' : 'Delete'}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!title.trim()}
          >
            {isEdit ? 'Save Changes' : 'Create Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
