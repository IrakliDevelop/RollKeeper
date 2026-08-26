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

type RestType = 'short' | 'long';

interface RestDialogProps {
  restType: RestType | null;
  onConfirm: () => void;
  onClose: () => void;
}

const REST_CONFIG: Record<
  RestType,
  {
    title: string;
    description: string;
    icon: React.ReactNode;
    confirmLabel: string;
  }
> = {
  short: {
    title: 'Short Rest',
    description:
      'Take a short rest (about 1 hour). This will reset abilities that recharge on a short rest, restore Pact Magic slots, and reset your reaction.',
    icon: <Sun className="h-5 w-5 text-amber-500" />,
    confirmLabel: 'Take Short Rest',
  },
  long: {
    title: 'Long Rest',
    description:
      'Take a long rest (about 8 hours). This will fully restore HP, reset all abilities, restore all spell slots, restore hit dice, and clear temporary effects.',
    icon: <Moon className="h-5 w-5 text-indigo-500" />,
    confirmLabel: 'Take Long Rest',
  },
};

export default function RestDialog({
  restType,
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
          <DialogDescription>{config.description}</DialogDescription>
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
