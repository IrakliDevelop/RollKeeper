'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import type { RestSlots } from '@/utils/calculations';

type RestType = 'short' | 'long';

interface RestDialogProps {
  restType: RestType | null;
  /** Which slots this character has; the description only promises those. */
  slots: RestSlots;
  onConfirm: () => void;
  onClose: () => void;
}

const REST_CONFIG: Record<
  RestType,
  {
    title: string;
    icon: React.ReactNode;
    confirmLabel: string;
  }
> = {
  short: {
    title: 'Short Rest',
    icon: <Sun className="h-5 w-5 text-amber-500" />,
    confirmLabel: 'Take Short Rest',
  },
  long: {
    title: 'Long Rest',
    icon: <Moon className="h-5 w-5 text-indigo-500" />,
    confirmLabel: 'Take Long Rest',
  },
};

/** "a and b", or "a, b, and c". */
function listPhrase(items: string[]): string {
  if (items.length <= 2) return items.join(' and ');
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function restDescription(restType: RestType, slots: RestSlots): string {
  if (restType === 'short') {
    return `Take a short rest (about 1 hour). This will ${listPhrase([
      'reset abilities that recharge on a short rest',
      ...(slots.pactMagic ? ['restore Pact Magic slots'] : []),
      'reset your reaction',
    ])}.`;
  }
  return `Take a long rest (about 8 hours). This will ${listPhrase([
    'fully restore HP',
    'reset all abilities',
    ...(slots.spellSlots ? ['restore all spell slots'] : []),
    'restore hit dice',
    'clear temporary effects',
  ])}.`;
}

export default function RestDialog({
  restType,
  slots,
  onConfirm,
  onClose,
}: RestDialogProps) {
  if (!restType) return null;

  const config = REST_CONFIG[restType];

  return (
    <Dialog open={!!restType} onOpenChange={open => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            {config.title}
          </DialogTitle>
          <DialogDescription>
            {restDescription(restType, slots)}
          </DialogDescription>
        </DialogHeader>
        <DialogBody />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={restType === 'long' ? 'primary' : 'secondary'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {config.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
