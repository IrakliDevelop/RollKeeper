'use client';

import { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Download } from 'lucide-react';

import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';

import type { PlayerBackupWizardView } from '../PlayerBackupWizard.types';

interface SafetyFileStepProps {
  view: PlayerBackupWizardView;
  onSaveSafetyFile: () => void;
  onChooseSafetyFile: (file: File) => void;
  onSaveCurrentCharacterFile: () => void;
  onChooseCurrentCharacterFile: (file: File) => void;
}

const BADGE_VARIANT = {
  needed: 'warning',
  'download-started': 'warning',
  checked: 'success',
  'still-matches': 'success',
  mismatch: 'danger',
} as const;

export function SafetyFileStep({
  view,
  onSaveSafetyFile,
  onChooseSafetyFile,
  onSaveCurrentCharacterFile,
  onChooseCurrentCharacterFile,
}: SafetyFileStepProps) {
  const inputId = useId();
  const extraInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const { safety } = view;
  const pending =
    safety.receipt === 'needed' ||
    safety.receipt === 'download-started' ||
    safety.receipt === 'mismatch';

  useEffect(() => {
    if (safety.receipt === 'mismatch') {
      alertRef.current?.focus();
    }
  }, [safety.receipt]);

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="player-backup-safety-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted mb-0.5 text-[11px] font-bold tracking-wide uppercase">
            <span className="lg:hidden">{view.compactStepLabel}</span>
            <span className="hidden lg:inline">{COPY.safety.eyebrow}</span>
          </p>
          <h3
            id="player-backup-safety-title"
            className="text-heading text-lg font-semibold"
            tabIndex={-1}
          >
            {safety.extraFileRequired
              ? COPY.safety.extraFileTitle
              : COPY.safety.title}
          </h3>
        </div>
        <Badge variant={BADGE_VARIANT[safety.receipt]}>
          {safety.badgeLabel}
        </Badge>
      </div>

      <p className="text-body text-sm">{safety.description}</p>

      {safety.preparing || safety.checking ? (
        <p role="status" className="text-muted text-sm">
          {safety.preparing
            ? COPY.safety.preparing
            : COPY.safety.checkingCharacters}
        </p>
      ) : null}

      {safety.receipt === 'still-matches' ? (
        <div
          role="status"
          className="border-accent-emerald-border bg-accent-emerald-bg rounded-lg border p-4"
        >
          <p className="text-accent-emerald-text text-sm font-semibold">
            {COPY.safety.verifiedTitle}
          </p>
          <p className="text-accent-emerald-text mt-1 text-[13px]">
            {COPY.safety.stillMatches}
          </p>
        </div>
      ) : null}

      {safety.receipt === 'checked' ? (
        <div
          role="status"
          className="border-accent-emerald-border bg-accent-emerald-bg rounded-lg border p-4"
        >
          <p className="text-accent-emerald-text text-sm font-semibold">
            {COPY.safety.verifiedTitle}
          </p>
          <p className="text-accent-emerald-text mt-1 text-[13px]">
            {COPY.safety.verifiedDescription}
          </p>
        </div>
      ) : null}

      {safety.receipt === 'mismatch' ? (
        <div
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className="border-accent-red-border bg-accent-red-bg flex items-start gap-3 rounded-lg border p-4"
        >
          <AlertTriangle
            size={18}
            className="text-accent-red-text mt-px shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="text-accent-red-text text-sm font-semibold">
              {COPY.safety.mismatchTitle}
            </p>
            <p className="text-accent-red-text mt-1 text-[13px]">
              {COPY.safety.mismatchDescription}
            </p>
            <Button
              variant="danger"
              className="mt-3"
              onClick={onSaveSafetyFile}
            >
              {COPY.safety.saveNew}
            </Button>
          </div>
        </div>
      ) : null}

      {pending ? (
        <div className="border-divider bg-surface flex flex-col gap-3.5 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-heading text-sm font-medium">
                {COPY.safety.saveInstruction}
              </p>
              <p className="text-muted mt-0.5 text-[13px]">
                {safety.receipt === 'download-started'
                  ? COPY.safety.downloadStarted
                  : safety.description}
              </p>
            </div>
            <Button
              variant="warning"
              leftIcon={<Download size={16} />}
              onClick={onSaveSafetyFile}
              disabled={view.busy}
            >
              {COPY.safety.download}
            </Button>
          </div>
          <div className="border-divider flex items-end justify-between gap-3 border-t pt-3.5">
            <div className="min-w-0 flex-1">
              <label
                htmlFor={inputId}
                className="text-heading mb-1.5 block text-sm font-medium"
              >
                {COPY.safety.chooseInstruction}
              </label>
              <input
                ref={inputRef}
                id={inputId}
                aria-label={COPY.safety.fileInput}
                type="file"
                accept="application/json,.json"
                className="text-muted border-divider bg-surface-secondary block w-full rounded-lg border-2 border-dashed px-3 py-2 text-sm"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) onChooseSafetyFile(file);
                  if (inputRef.current) inputRef.current.value = '';
                }}
              />
              {safety.pickedFileName ? (
                <p className="text-muted mt-1 text-xs">
                  {safety.pickedFileName}
                </p>
              ) : null}
            </div>
          </div>
          {safety.extraFileRequired ? (
            <div className="border-divider flex flex-col gap-3 border-t pt-3.5">
              <Button
                variant="outline"
                onClick={onSaveCurrentCharacterFile}
                disabled={view.busy}
              >
                {COPY.safety.extraDownload}
              </Button>
              <label
                htmlFor={extraInputId}
                className="text-heading block text-sm font-medium"
              >
                {COPY.safety.extraFileInput}
              </label>
              <input
                ref={extraInputRef}
                id={extraInputId}
                aria-label={COPY.safety.extraFileInput}
                type="file"
                accept="application/json,.json"
                className="text-muted border-divider bg-surface-secondary block w-full rounded-lg border-2 border-dashed px-3 py-2 text-sm"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) onChooseCurrentCharacterFile(file);
                  if (extraInputRef.current) extraInputRef.current.value = '';
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
