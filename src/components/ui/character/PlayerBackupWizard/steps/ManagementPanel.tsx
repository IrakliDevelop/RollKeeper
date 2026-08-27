'use client';

import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import { Switch } from '@/components/ui/forms/switch';
import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';

import type {
  PlayerBackupWizardActions,
  PlayerBackupWizardView,
} from '../PlayerBackupWizard.types';

const TONE_VARIANT = {
  ok: 'success',
  warn: 'warning',
  info: 'secondary',
  bad: 'danger',
  none: 'neutral',
} as const;

interface ManagementPanelProps {
  view: PlayerBackupWizardView;
  actions: PlayerBackupWizardActions;
}

export function ManagementPanel({ view, actions }: ManagementPanelProps) {
  const { management } = view;

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="player-backup-manage-title"
    >
      <div className="flex items-start justify-between gap-3">
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
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={actions.onCheckNow}>
            {COPY.chrome.checkNow}
          </Button>
          <Button variant="primary" size="sm" onClick={actions.onProtectMore}>
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
                    if (action.action === 'choose') {
                      actions.onBack();
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
          disabled={!management.futureDefaultEnabled}
          label={COPY.management.futureDefault}
          description={COPY.management.futureDefaultDescription}
        />
        {!management.futureDefaultEnabled ? (
          <p className="text-muted mt-2 text-xs">
            {COPY.management.unavailable}
          </p>
        ) : null}
      </div>
    </section>
  );
}
