'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const confirmVariant = type === 'danger' ? 'danger' : 'primary';

  const iconContainerClass =
    type === 'danger'
      ? 'bg-accent-red-bg'
      : type === 'warning'
        ? 'bg-accent-amber-bg'
        : 'bg-accent-blue-bg';
  const iconClass =
    type === 'danger'
      ? 'text-accent-red-text-muted'
      : type === 'warning'
        ? 'text-accent-amber-text-muted'
        : 'text-accent-blue-text-muted';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${iconContainerClass}`}>
              <AlertTriangle size={20} className={iconClass} />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
        </DialogHeader>
        <DialogBody>
          <p className="text-body leading-relaxed">{message}</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {cancelText}
          </Button>
          <Button variant={confirmVariant} onClick={handleConfirm}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
