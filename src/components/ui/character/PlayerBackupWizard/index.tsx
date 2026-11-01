'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, X } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { AppHeader } from '@/components/ui/layout/AppHeader';
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

import type { PlayerBackupWizardProps } from './PlayerBackupWizard.types';
import { AccountStep } from './steps/AccountStep';
import { CharacterSelectionStep } from './steps/CharacterSelectionStep';
import { PlayerBackupManager } from '../PlayerBackupManager';
import { RecoveryPanel } from './steps/RecoveryPanel';
import { ResultStep } from './steps/ResultStep';
import { SafetyFileStep } from './steps/SafetyFileStep';

function SetupRail({ view }: Pick<PlayerBackupWizardProps, 'view'>) {
  return (
    <aside className="border-divider hidden w-[232px] shrink-0 flex-col gap-0.5 border-r pr-4 lg:flex">
      <p className="text-muted mb-1.5 px-1.5 text-[11px] font-bold">Setup</p>
      {view.rail.map(item => (
        <div
          key={item.key}
          className={`flex items-center gap-2 rounded-md px-1.5 py-2 ${
            item.state === 'now' ? 'bg-surface' : ''
          }`}
        >
          <span
            className={`size-2 shrink-0 rounded-full ${
              item.state === 'done'
                ? 'bg-verdigris-fill'
                : item.state === 'now'
                  ? 'bg-brass-fill'
                  : 'bg-surface-elevated'
            }`}
            aria-hidden="true"
          />
          <span
            className={`min-w-0 flex-1 truncate text-[13px] ${
              item.state === 'todo' ? 'text-muted' : 'text-heading'
            } ${item.state === 'now' ? 'font-semibold' : ''}`}
          >
            {item.label}
          </span>
          <span
            className={`shrink-0 text-[11px] ${
              item.state === 'done' ? 'text-verdigris-text' : 'text-ember-text'
            }`}
          >
            {item.statusLabel}
          </span>
        </div>
      ))}
      <div className="border-divider mt-2.5 border-t pt-2.5">
        <p className="text-muted mb-1.5 px-1.5 text-[11px]">Your characters</p>
        <ul className="flex flex-col gap-1 px-1.5">
          {view.railCharacters.map(character => (
            <li key={character.id} className="flex items-center gap-2">
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  character.included
                    ? 'bg-verdigris-fill'
                    : 'bg-surface-elevated'
                }`}
                aria-hidden="true"
              />
              <span
                className={`min-w-0 flex-1 truncate text-xs ${
                  character.included ? 'text-body' : 'text-muted'
                }`}
              >
                {character.name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function ActionErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      tabIndex={-1}
      className="border-blood-border bg-blood-bg rounded-md border p-3.5"
    >
      <p className="text-blood-text text-[13px]">{message}</p>
    </div>
  );
}

export function PlayerBackupWizard({ view, actions }: PlayerBackupWizardProps) {
  useEffect(() => {
    const alert = document.querySelector('[role="alert"]');
    if (alert instanceof HTMLElement) {
      alert.focus();
      return;
    }
    const headingId =
      view.surface === 'manage'
        ? 'player-backup-manage-title'
        : view.surface === 'recovery'
          ? 'player-backup-recovery-title'
          : `player-backup-${view.step}-title`;
    document.getElementById(headingId)?.focus();
  }, [
    view.account.error,
    view.safety.receipt,
    view.selection.alert,
    view.actionError,
    view.step,
    view.surface,
  ]);

  return (
    <div className="bg-surface min-h-screen overflow-x-hidden">
      <AppHeader
        leading={
          <Button
            asChild
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft size={20} aria-hidden />}
          >
            <Link href="/player">{COPY.chrome.back}</Link>
          </Button>
        }
        title={<h1 className="type-heading text-heading">{view.pageTitle}</h1>}
        actions={
          <p className="type-small text-muted hidden min-w-0 break-all sm:block">
            {view.headerNote}
          </p>
        }
        wrapControls
      />

      {view.liveStatus ? (
        <div role="status" aria-live="polite" className="sr-only">
          {view.liveStatus}
        </div>
      ) : null}

      {view.surface === 'wizard' ? (
        <Dialog
          open
          modal={false}
          onOpenChange={open => !open && actions.onClose()}
        >
          <DialogContent
            size="lg"
            showCloseButton={false}
            className="max-h-[90vh] overflow-x-hidden"
            aria-busy={view.busy}
          >
            <button
              type="button"
              className="text-muted hover:bg-surface-secondary absolute top-4 right-4 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md"
              aria-label={COPY.chrome.close}
              onClick={actions.onClose}
            >
              <X size={16} aria-hidden="true" />
            </button>
            <DialogHeader className="pr-12">
              <DialogTitle>{view.dialogTitle}</DialogTitle>
              <DialogDescription>{view.dialogDescription}</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex min-w-0 gap-5 overflow-x-hidden">
              <SetupRail view={view} />
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <ActionErrorBanner message={view.actionError} />
                {view.step === 'account' ? (
                  <AccountStep
                    view={view}
                    onSignIn={actions.onSignIn}
                    onCheckAccount={actions.onCheckAccount}
                  />
                ) : null}
                {view.step === 'safety' ? (
                  <SafetyFileStep
                    view={view}
                    onSaveSafetyFile={actions.onSaveSafetyFile}
                    onChooseSafetyFile={actions.onChooseSafetyFile}
                    onSaveCurrentCharacterFile={
                      actions.onSaveCurrentCharacterFile
                    }
                    onChooseCurrentCharacterFile={
                      actions.onChooseCurrentCharacterFile
                    }
                  />
                ) : null}
                {view.step === 'selection' ? (
                  <CharacterSelectionStep
                    view={view}
                    onToggleCharacter={actions.onToggleCharacter}
                    onSelectAll={actions.onSelectAll}
                    onClearAll={actions.onClearAll}
                    onToggleOngoing={actions.onToggleOngoing}
                    onConfirm={actions.onConfirm}
                  />
                ) : null}
                {view.step === 'result' ? (
                  <ResultStep
                    view={view}
                    onCheckNow={actions.onCheckNow}
                    onContinueSetup={actions.onContinueSetup}
                    onResolveConflict={actions.onResolveConflict}
                    onApplyPending={actions.onApplyPending}
                    onDownloadRecoveryCopy={actions.onDownloadRecoveryCopy}
                  />
                ) : null}
              </div>
            </DialogBody>
            <DialogFooter className="items-center justify-between gap-4 sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <div className="bg-surface-elevated h-1.5 w-[132px] overflow-hidden rounded-full">
                    <div
                      className="bg-verdigris-fill h-1.5 rounded-full"
                      style={{ width: `${view.footer.progressPercent}%` }}
                    />
                  </div>
                  <span className="text-body text-[13px]">
                    {view.footer.progressText}
                  </span>
                </div>
                <p className="text-muted mt-1 text-xs">
                  {view.footer.progressNote}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" onClick={actions.onBack}>
                  {view.footer.backLabel}
                </Button>
                <Button
                  variant="primary"
                  rightIcon={<ChevronRight size={16} />}
                  disabled={view.footer.nextDisabled}
                  onClick={
                    view.step === 'result'
                      ? actions.onOpenManage
                      : actions.onNext
                  }
                >
                  {view.footer.nextLabel}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-4">
            <ActionErrorBanner message={view.actionError} />
            {view.surface === 'manage' ? (
              <PlayerBackupManager view={view} actions={actions} />
            ) : (
              <RecoveryPanel view={view} actions={actions} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
