'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/forms/button';
import { Switch } from '@/components/ui/forms/switch';
import { Badge } from '@/components/ui/layout/badge';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import {
  managementRemoveConfirm,
  PLAYER_BACKUP_COPY as COPY,
} from '@/lib/playerBackup/playerBackupCopy';

import type {
  PlayerBackupWizardActions,
  PlayerBackupWizardView,
} from './PlayerBackupWizard/PlayerBackupWizard.types';

const TONE_VARIANT = {
  ok: 'success',
  warn: 'warning',
  info: 'secondary',
  bad: 'danger',
  none: 'neutral',
} as const;

export interface PlayerBackupManagerProps {
  view: PlayerBackupWizardView;
  actions: PlayerBackupWizardActions;
}

export function PlayerBackupManager({
  view,
  actions,
}: PlayerBackupManagerProps) {
  const { management } = view;
  const [pendingRemove, setPendingRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="player-backup-manage-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2
            id="player-backup-manage-title"
            className="text-heading text-xl font-semibold"
            tabIndex={-1}
          >
            {management.title}
          </h2>
          <p className="text-body mt-1 text-sm">{management.summary}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={actions.onCheckNow}
            disabled={view.busy}
          >
            {COPY.chrome.checkNow}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={actions.onProtectMore}
            disabled={view.busy}
          >
            {COPY.chrome.protectMore}
          </Button>
        </div>
      </div>

      <div className="border-divider overflow-hidden rounded-lg border">
        {management.rows.map(row => (
          <div
            key={row.id}
            className="border-divider flex flex-col gap-2 border-b p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-heading text-sm font-medium">{row.name}</p>
                <Badge variant={TONE_VARIANT[row.tone]}>
                  {row.statusLabel}
                </Badge>
              </div>
              <p className="text-muted text-xs">{row.note}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {row.actions.map(action => (
                <Button
                  key={action.action}
                  variant="outline"
                  size="sm"
                  disabled={!action.enabled || view.busy}
                  onClick={() => {
                    if (action.action === 'choose') actions.onBack();
                    if (action.action === 'pause')
                      actions.onPauseCharacter(row.id);
                    if (action.action === 'resume')
                      actions.onResumeCharacter(row.id);
                    if (action.action === 'backup-now')
                      actions.onBackupNow(row.id);
                    if (action.action === 'restore-here')
                      actions.onRestoreHere(row.id);
                    if (action.action === 'restore-copy')
                      actions.onRestoreCopy(row.id);
                    if (action.action === 'download-recovery')
                      actions.onDownloadRecoveryCopy(row.id);
                    if (action.action === 'remove') {
                      setPendingRemove({ id: row.id, name: row.name });
                    }
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-divider rounded-lg border p-4">
        <Switch
          checked={management.futureDefaultOn}
          disabled={!management.futureDefaultEnabled || view.busy}
          label={COPY.management.futureDefault}
          description={COPY.management.futureDefaultDescription}
          onCheckedChange={checked => actions.onToggleFutureDefault(checked)}
        />
        {!management.futureDefaultEnabled ? (
          <p className="text-muted mt-2 text-xs">
            {COPY.management.unavailable}
          </p>
        ) : null}
      </div>

      {view.liveStatus ? (
        <p className="sr-only" aria-live="polite">
          {view.liveStatus}
        </p>
      ) : null}

      <Dialog
        open={pendingRemove !== null}
        onOpenChange={open => {
          if (!open) setPendingRemove(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{COPY.management.remove}</DialogTitle>
            <DialogDescription>
              {pendingRemove
                ? managementRemoveConfirm(pendingRemove.name)
                : COPY.management.remove}
            </DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRemove(null)}>
              {COPY.chrome.close}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!pendingRemove) return;
                actions.onRemoveOnlineCopy(pendingRemove.id);
                setPendingRemove(null);
              }}
            >
              {COPY.management.remove}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
