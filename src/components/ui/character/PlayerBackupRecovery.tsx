'use client';

import { useEffect, useId, useRef } from 'react';

import { Button } from '@/components/ui/forms/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';
import type { StorageNamespace } from '@/lib/indexeddb/shadowJournal';

import { usePlayerBackupRecovery } from './PlayerBackupRecovery.hooks';

interface PlayerBackupRecoveryProps {
  namespace?: StorageNamespace;
  onSaveSafetyFile?: () => void;
  headingId?: string;
}

export function PlayerBackupRecovery({
  namespace = 'guest',
  onSaveSafetyFile,
  headingId,
}: PlayerBackupRecoveryProps) {
  const recovery = usePlayerBackupRecovery(namespace);
  const fileId = useId();
  const alertRef = useRef<HTMLDivElement>(null);
  const resultCopy =
    recovery.resultKind === 'generic-success'
      ? COPY.recovery.restoreMissingResult
      : recovery.resultKind === 'character-success'
        ? COPY.recovery.restoreSuccess
        : recovery.resultKind === 'difference'
          ? COPY.recovery.restoreDifference
          : recovery.resultKind === 'verification-failure'
            ? COPY.recovery.restoreVerificationFailure
            : recovery.resultKind === 'invalid'
              ? COPY.recovery.invalidFile
              : recovery.resultKind === 'unusable'
                ? COPY.recovery.unusable
                : recovery.resultKind === 'rollback-refusal'
                  ? COPY.recovery.rollbackRefusal
                  : recovery.error;

  useEffect(() => {
    if (resultCopy && alertRef.current) alertRef.current.focus();
  }, [resultCopy]);

  return (
    <div className="flex flex-col gap-4 overflow-x-hidden">
      <div className="border-divider bg-surface rounded-lg border p-4">
        <h3 id={headingId} className="text-heading text-base font-semibold">
          {COPY.recovery.sectionTitle}
        </h3>
        <p className="text-body mt-1 text-sm">
          {COPY.recovery.sectionDescription}
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {onSaveSafetyFile ? (
            <Button
              variant="outline"
              onClick={onSaveSafetyFile}
              disabled={recovery.busy}
            >
              {COPY.recovery.saveNew}
            </Button>
          ) : null}
          <div className="min-w-0 flex-1">
            <label
              htmlFor={fileId}
              className="text-heading mb-1.5 block text-sm font-medium"
            >
              {COPY.recovery.restoreFrom}
            </label>
            <input
              ref={recovery.inputRef}
              id={fileId}
              aria-label={COPY.recovery.restoreFrom}
              type="file"
              accept="application/json,.json"
              disabled={recovery.busy}
              className="text-muted border-divider bg-surface-secondary block w-full rounded-lg border-2 border-dashed px-3 py-2 text-sm"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) void recovery.handleChooseFile(file);
              }}
            />
          </div>
          <Button
            variant="ghost"
            onClick={() => recovery.setOptionsOpen(open => !open)}
            disabled={recovery.busy}
          >
            {COPY.recovery.options}
          </Button>
        </div>
      </div>

      {recovery.optionsOpen ? (
        <div className="border-divider bg-surface-secondary flex flex-col gap-2 rounded-lg border p-4">
          <Button
            variant="outline"
            onClick={() => void recovery.handleSaveCurrent()}
            disabled={recovery.busy}
          >
            {COPY.recovery.saveCurrent}
          </Button>
          <div>
            <Button
              variant="outline"
              onClick={() => void recovery.handleDownloadDetails()}
              disabled={recovery.busy}
            >
              {COPY.recovery.downloadDetails}
            </Button>
            <p className="text-muted mt-1 text-xs">
              {COPY.recovery.diagnosticHint}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={recovery.handleDownloadOriginal}
            disabled={recovery.busy || !recovery.hasOriginal}
            title={
              recovery.hasOriginal ? undefined : COPY.recovery.chooseFileHint
            }
          >
            {COPY.recovery.downloadOriginal}
          </Button>
          <Button
            variant="outline"
            onClick={() => recovery.setConfirmKind('rollback')}
            disabled={recovery.busy}
          >
            {COPY.recovery.rollback}
          </Button>
          <p className="text-muted text-xs">
            {COPY.recovery.rollbackDescription}
          </p>
          <Button
            variant="ghost"
            onClick={() => void recovery.handleContinueActivation()}
            disabled={recovery.busy}
          >
            {COPY.recovery.continueActivation}
          </Button>
        </div>
      ) : null}

      {resultCopy ? (
        <div
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className="border-accent-amber-border bg-accent-amber-bg rounded-lg border p-4"
        >
          <p className="text-heading text-sm font-semibold">{resultCopy}</p>
        </div>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {recovery.liveStatus}
      </div>

      <Dialog
        open={
          recovery.reviewKind === 'generic' ||
          recovery.reviewKind === 'character'
        }
        onOpenChange={open => {
          if (!open) recovery.setReviewKind(null);
        }}
      >
        <DialogContent size="md" className="overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{COPY.recovery.reviewTitle}</DialogTitle>
            <DialogDescription>
              {recovery.reviewKind === 'character'
                ? COPY.recovery.restorePreview
                : COPY.recovery.reviewDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => recovery.setReviewKind(null)}
            >
              {COPY.recovery.cancel}
            </Button>
            {recovery.reviewKind === 'character' ? (
              <Button
                variant="primary"
                onClick={() => {
                  recovery.setReviewKind(null);
                  recovery.setConfirmKind('character');
                }}
                disabled={recovery.busy}
              >
                {COPY.recovery.restoreCurrent}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => {
                  recovery.setReviewKind(null);
                  recovery.setConfirmKind('generic');
                }}
                disabled={recovery.busy}
              >
                {COPY.recovery.restoreMissing}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={recovery.confirmKind !== null}
        onOpenChange={open => {
          if (!open) recovery.setConfirmKind(null);
        }}
      >
        <DialogContent size="sm" className="overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>
              {recovery.confirmKind === 'rollback'
                ? COPY.recovery.rollback
                : recovery.confirmKind === 'character' ||
                    recovery.confirmKind === 'character-activate'
                  ? COPY.recovery.restoreCurrent
                  : COPY.recovery.restoreMissing}
            </DialogTitle>
            <DialogDescription>
              {recovery.confirmKind === 'rollback'
                ? COPY.recovery.rollbackConfirm
                : recovery.confirmKind === 'character-activate'
                  ? COPY.recovery.restorePreview
                  : recovery.confirmKind === 'character'
                    ? COPY.recovery.restoreConfirm
                    : COPY.recovery.restoreMissingConfirm}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => recovery.setConfirmKind(null)}
            >
              {COPY.recovery.cancel}
            </Button>
            <Button
              variant="primary"
              disabled={recovery.busy}
              onClick={() => {
                if (recovery.confirmKind === 'rollback')
                  void recovery.handleConfirmRollback();
                else if (recovery.confirmKind === 'character-activate')
                  void recovery.handleConfirmCharacterActivate();
                else if (recovery.confirmKind === 'character')
                  void recovery.handleConfirmCharacter();
                else void recovery.handleConfirmGeneric();
              }}
            >
              {recovery.confirmKind === 'rollback'
                ? COPY.recovery.rollback
                : COPY.recovery.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
