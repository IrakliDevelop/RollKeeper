'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

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

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: 'text-red-600',
          iconBg: 'bg-red-100',
          confirmBtn:
            'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800',
          border: 'border-red-200',
        };
      case 'warning':
        return {
          icon: 'text-amber-600',
          iconBg: 'bg-amber-100',
          confirmBtn:
            'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800',
          border: 'border-amber-200',
        };
      case 'info':
        return {
          icon: 'text-blue-600',
          iconBg: 'bg-blue-100',
          confirmBtn:
            'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
          border: 'border-blue-200',
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <ModalPortal isOpen={isOpen}>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        onClick={e => e.target === e.currentTarget && onClose()}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          margin: 0,
        }}
      >
        <div
          className={`bg-surface-raised w-full max-w-md rounded-xl border-2 shadow-2xl ${styles.border} animate-in zoom-in-95 transform duration-200`}
        >
          {/* Header */}
          <div className="border-divider flex items-center justify-between border-b p-6">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${styles.iconBg}`}>
                <AlertTriangle size={20} className={styles.icon} />
              </div>
              <h3 className="text-heading text-lg font-bold">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="text-faint hover:text-body p-1 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-body leading-relaxed">{message}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 pt-0">
            <button
              onClick={onClose}
              className="border-divider bg-surface-secondary text-heading hover:bg-surface-hover flex-1 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-200 hover:shadow-md"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`flex-1 px-4 py-2 text-sm font-medium ${styles.confirmBtn} rounded-lg text-white shadow-md transition-all duration-200 hover:shadow-lg`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
