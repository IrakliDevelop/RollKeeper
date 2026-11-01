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
    <section className="border-divider mb-6 border-b pb-6">
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
            className="border-divider flex flex-wrap items-center justify-between gap-2 border-b py-3"
          >
            <span
              id={`local-backup-${character.id}-name`}
              className="text-heading text-sm font-medium"
            >
              {character.name}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                aria-describedby={`local-backup-${character.id}-name`}
                onClick={() => actions.backup(character)}
                disabled={actions.busy !== null}
              >
                Back up now
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-describedby={`local-backup-${character.id}-name`}
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
            <div key={row.id} className="border-divider border-b py-3">
              <div className="mb-2 flex items-center gap-2">
                <span
                  id={`cloud-backup-${row.id}-name`}
                  className="text-heading font-medium"
                >
                  {row.name}
                </span>
                <Badge
                  variant={row.deleted_at ? 'warning' : 'success'}
                  size="sm"
                >
                  {row.deleted_at ? 'Archived' : `Cloud v${row.server_version}`}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  aria-describedby={`cloud-backup-${row.id}-name`}
                  onClick={() => actions.restore(row, false)}
                  disabled={actions.busy !== null}
                >
                  Restore
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-describedby={`cloud-backup-${row.id}-name`}
                  onClick={() => actions.restore(row, true)}
                  disabled={actions.busy !== null}
                >
                  Restore as copy
                </Button>
                {!row.deleted_at && (
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<Archive size={14} />}
                    aria-describedby={`cloud-backup-${row.id}-name`}
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
                  aria-describedby={`cloud-backup-${row.id}-name`}
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
          className="text-verdigris-text mt-3 flex items-center gap-2 text-sm"
          role="status"
        >
          <ShieldCheck size={16} /> {actions.status}
        </p>
      )}
      {actions.error && (
        <p className="text-blood-text mt-3 text-sm" role="alert">
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
