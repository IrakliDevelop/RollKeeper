'use client';

import React, { useId, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import type { ConfirmDialogTone } from './confirmDialogStore';

export interface ConfirmDialogViewProps {
  open: boolean;
  kind: 'confirm' | 'alert' | 'prompt';
  title: string;
  message?: string;
  tone?: ConfirmDialogTone;
  confirmLabel: string;
  cancelLabel?: string;
  /** prompt only: visible label of the text field. */
  promptLabel?: string;
  /** prompt only: starting text, selected on open. */
  defaultValue?: string;
  /** Receives the trimmed text for a prompt. */
  onConfirm: (value?: string) => void;
  /** Cancel button, Escape. For an alert, Escape closes like the button. */
  onCancel: () => void;
  /**
   * Gets focus back on close. Defaults to whatever had focus when the
   * dialog opened (Radix would send it to a DialogTrigger, which this has
   * none of, so focus would fall to the page body).
   */
  returnFocusTo?: Element | null;
}

/**
 * The one dialog behind confirmDialog, alertDialog, promptDialog and
 * ConfirmationModal. Tapping outside never dismisses it; Escape cancels.
 * The confirm button (or the prompt's field) takes focus on open, so Enter
 * confirms, as it did with the native dialogs.
 */
export function ConfirmDialogView({
  open,
  kind,
  title,
  message,
  tone = 'default',
  confirmLabel,
  cancelLabel = 'Cancel',
  promptLabel,
  defaultValue = '',
  onConfirm,
  onCancel,
  returnFocusTo,
}: ConfirmDialogViewProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<Element | null>(null);
  const inputId = useId();
  const [value, setValue] = useState(defaultValue);

  const isAlert = kind === 'alert';
  const isPrompt = kind === 'prompt';
  const trimmed = value.trim();
  const confirmDisabled = isPrompt && trimmed === '';

  const handleConfirm = () => {
    if (confirmDisabled) return;
    onConfirm(isPrompt ? trimmed : undefined);
  };

  const handleOpenAutoFocus = (event: Event) => {
    event.preventDefault();
    openerRef.current = document.activeElement;
    if (isPrompt && inputRef.current) {
      const input = inputRef.current;
      input.focus();
      // iOS Safari ignores select() inside the focus handler. By the time
      // the frame runs the player may already be typing; selecting then
      // would make the next keystroke replace what they typed.
      requestAnimationFrame(() => {
        if (document.activeElement === input && input.value === defaultValue) {
          input.setSelectionRange(0, input.value.length);
        }
      });
      return;
    }
    confirmRef.current?.focus();
  };

  const handleCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    // The opener may have unmounted (a closed menu item), so fall back to
    // the element focused when this dialog opened.
    const target = [returnFocusTo, openerRef.current].find(
      (candidate): candidate is HTMLElement =>
        candidate instanceof HTMLElement && candidate.isConnected
    );
    target?.focus();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) onCancel();
      }}
    >
      <DialogContent
        size="sm"
        showCloseButton={false}
        data-confirm-dialog={kind}
        role={isAlert || tone === 'danger' ? 'alertdialog' : 'dialog'}
        // Radix warns about a missing description unless this is explicit.
        {...(message ? {} : { 'aria-describedby': undefined })}
        onOpenAutoFocus={handleOpenAutoFocus}
        onCloseAutoFocus={handleCloseAutoFocus}
        onInteractOutside={event => event.preventDefault()}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={event => {
            event.preventDefault();
            handleConfirm();
          }}
        >
          <DialogHeader>
            <DialogTitle className="leading-snug">{title}</DialogTitle>
            {message && (
              <DialogDescription className="leading-relaxed">
                {message}
              </DialogDescription>
            )}
          </DialogHeader>
          {isPrompt && (
            <Input
              ref={inputRef}
              id={inputId}
              label={promptLabel}
              value={value}
              onChange={event => setValue(event.target.value)}
              className="pointer-coarse:text-base"
              autoComplete="off"
            />
          )}
          <DialogFooter>
            {!isAlert && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {cancelLabel}
              </Button>
            )}
            <Button
              ref={confirmRef}
              type="submit"
              variant={tone === 'danger' ? 'danger-solid' : 'primary'}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
