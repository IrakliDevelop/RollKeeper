'use client';

import React from 'react';
import { ConfirmDialogView } from '@/components/ui/feedback/confirm-dialog';

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

/**
 * State-driven form of the shared confirm dialog, for screens that keep
 * the pending action in state. New code can await confirmDialog instead.
 */
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
}) => (
  <ConfirmDialogView
    open={isOpen}
    kind="confirm"
    title={title}
    message={message}
    tone={type === 'danger' ? 'danger' : 'default'}
    confirmLabel={confirmText}
    cancelLabel={cancelText}
    onConfirm={() => {
      onConfirm();
      onClose();
    }}
    onCancel={onClose}
  />
);
