'use client';

import { Archive, Cloud, Download, RefreshCw, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import {
  type ManualCharacterCloudContext,
  isManualCharacterCloudEnabled,
} from '@/lib/supabase/characterCloud';

import {
  type CharacterCloudLocalSummary,
  useCharacterCloudBackup,
} from './useCharacterCloudBackup';

interface CharacterCloudBackupControlsProps {
  characters: readonly CharacterCloudLocalSummary[];
  onAddCharacter(character: unknown): boolean;
  cloud?: ManualCharacterCloudContext;
}

function EnabledCharacterCloudBackupControls(
  props: CharacterCloudBackupControlsProps
) {
  const actions = useCharacterCloudBackup({
    characters: props.characters,
    onAddCharacter: props.onAddCharacter,
    injectedCloud: props.cloud,
  });

  return (
    <section className="border-divider bg-surface-secondary mb-6 rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-heading flex items-center gap-2 text-sm font-semibold">
            <Cloud size={18} /> Manual character cloud backup
          </h2>
          <p className="text-muted mt-1 text-sm">
            Local characters stay authoritative. No automatic synchronization is
            enabled.
          </p>
        </div>
        <Button
          variant="outline"
          leftIcon={<RefreshCw size={16} />}
          onClick={actions.load}
          loading={actions.busy === 'load'}
        >
          Load cloud backups
        </Button>
      </div>

      <div className="space-y-2">
        {props.characters.map(character => (
          <div
            key={character.id}
            className="border-divider bg-surface-raised flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
          >
            <span className="text-heading text-sm font-medium">
              {character.name}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                aria-label={`Back up ${character.name} now`}
                onClick={() => actions.backup(character)}
                disabled={actions.busy !== null}
              >
                Back up now
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Verify ${character.name} cloud copy`}
                onClick={() => actions.verify(character)}
                disabled={actions.busy !== null}
              >
                Verify cloud copy
              </Button>
            </div>
          </div>
        ))}
      </div>

      {actions.rows.length > 0 && (
        <div className="border-divider mt-4 space-y-2 border-t pt-4">
          {actions.rows.map(row => (
            <div
              key={row.id}
              className="border-divider bg-surface-raised rounded-md border p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-heading font-medium">{row.name}</span>
                <Badge
                  variant={row.deleted_at ? 'warning' : 'success'}
                  size="sm"
                >
                  {row.deleted_at ? 'Archived' : `Cloud v${row.server_version}`}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="success"
                  size="sm"
                  aria-label={`Restore ${row.name}`}
                  onClick={() => actions.restore(row, false)}
                  disabled={actions.busy !== null}
                >
                  Restore
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Restore ${row.name} as copy`}
                  onClick={() => actions.restore(row, true)}
                  disabled={actions.busy !== null}
                >
                  Restore as copy
                </Button>
                {!row.deleted_at && (
                  <Button
                    variant="warning"
                    size="sm"
                    leftIcon={<Archive size={14} />}
                    aria-label={`Archive ${row.name} cloud copy`}
                    onClick={() => actions.archive(row)}
                    disabled={actions.busy !== null}
                  >
                    Archive cloud copy
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download size={14} />}
                  aria-label={`Download ${row.name} recovery`}
                  onClick={() => actions.download(row)}
                  disabled={actions.busy !== null}
                >
                  Download recovery
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {actions.status && (
        <p
          className="text-accent-emerald-text mt-3 flex items-center gap-2 text-sm"
          role="status"
        >
          <ShieldCheck size={16} /> {actions.status}
        </p>
      )}
      {actions.error && (
        <p className="text-accent-red-text mt-3 text-sm" role="alert">
          {actions.error}
        </p>
      )}
    </section>
  );
}

export function CharacterCloudBackupControls(
  props: CharacterCloudBackupControlsProps
) {
  if (!isManualCharacterCloudEnabled()) return null;
  return <EnabledCharacterCloudBackupControls {...props} />;
}
