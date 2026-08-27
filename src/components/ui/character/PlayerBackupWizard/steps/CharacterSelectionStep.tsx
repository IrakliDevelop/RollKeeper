'use client';

import { Shield } from 'lucide-react';

import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import { Checkbox } from '@/components/ui/forms/checkbox';
import { Switch } from '@/components/ui/forms/switch';
import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';

import type { PlayerBackupWizardView } from '../PlayerBackupWizard.types';

interface CharacterSelectionStepProps {
  view: PlayerBackupWizardView;
  onToggleCharacter: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onToggleOngoing: (checked: boolean) => void;
  onConfirm: () => void;
}

const TONE_VARIANT = {
  ok: 'success',
  warn: 'warning',
  info: 'secondary',
  bad: 'danger',
  none: 'neutral',
} as const;

export function CharacterSelectionStep({
  view,
  onToggleCharacter,
  onSelectAll,
  onClearAll,
  onToggleOngoing,
  onConfirm,
}: CharacterSelectionStepProps) {
  const { selection } = view;

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="player-backup-selection-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted mb-0.5 text-[11px] font-bold tracking-wide uppercase">
            <span className="lg:hidden">{view.compactStepLabel}</span>
            <span className="hidden lg:inline">{COPY.selection.eyebrow}</span>
          </p>
          <h3
            id="player-backup-selection-title"
            className="text-heading text-lg font-semibold"
            tabIndex={-1}
          >
            {COPY.selection.title}
          </h3>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            {COPY.selection.selectAll}
          </Button>
          <Button variant="outline" size="sm" onClick={onClearAll}>
            {COPY.selection.clearAll}
          </Button>
        </div>
      </div>

      <p className="text-body text-sm">{COPY.selection.description}</p>

      {selection.alert ? (
        <div
          role="alert"
          tabIndex={-1}
          className="border-accent-amber-border bg-accent-amber-bg rounded-lg border p-3.5"
        >
          <p className="text-accent-amber-text text-[13px] font-semibold">
            {selection.alert}
          </p>
        </div>
      ) : null}

      <div className="border-divider overflow-hidden rounded-lg border">
        {view.characters.map(character => (
          <div
            key={character.id}
            className="border-divider flex items-center gap-3 border-b p-3 last:border-b-0"
          >
            <Checkbox
              checked={character.selected}
              disabled={!character.eligible}
              onCheckedChange={() => onToggleCharacter(character.id)}
              label={character.name}
              description={character.note}
            />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {character.archived ? (
                <Badge variant="neutral">{COPY.selection.archived}</Badge>
              ) : null}
              <Badge variant={TONE_VARIANT[character.tone]}>
                {character.statusLabel}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="border-divider bg-surface rounded-lg border p-4">
        <Switch
          checked={selection.ongoingChecked}
          disabled={!selection.ongoingAvailable}
          onCheckedChange={onToggleOngoing}
          variant="success"
          label={
            selection.ongoingChecked
              ? COPY.selection.switchOnTitle
              : COPY.selection.switchOffTitle
          }
          description={
            selection.ongoingChecked
              ? COPY.selection.switchOnDescription
              : COPY.selection.switchOffDescription
          }
        />
      </div>

      <div className="border-accent-amber-border bg-accent-amber-bg rounded-lg border-2 p-4">
        <p className="text-accent-amber-text text-sm font-semibold">
          {COPY.selection.confirmHeading}
        </p>
        <p className="text-accent-amber-text mt-1.5 text-[13px]">
          {selection.confirmBody}
        </p>
        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            leftIcon={<Shield size={16} />}
            onClick={onConfirm}
            disabled={!selection.confirmEnabled || view.busy}
            aria-busy={view.busy}
          >
            {selection.confirmLabel}
          </Button>
          <p className="text-accent-amber-text text-xs">
            {selection.confirmHint}
          </p>
        </div>
      </div>
    </section>
  );
}
