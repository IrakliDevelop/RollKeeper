'use client';

import { useState } from 'react';
import { CloudCog, RefreshCw, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import type { AutomaticSyncLocalCharacter } from '@/lib/supabase/automaticCharacterSyncService';
import { isAutomaticCharacterSyncEnabled } from '@/lib/supabase/automaticCharacterSyncService';

import {
  type AutomaticCharacterSyncController,
  type CharacterAutomaticSyncStatus,
  useCharacterAutomaticSync,
} from './useCharacterAutomaticSync';

interface CharacterAutomaticSyncControlsProps {
  characters: readonly AutomaticSyncLocalCharacter[];
  controller?: AutomaticCharacterSyncController;
}

const STATUS_LABEL: Record<CharacterAutomaticSyncStatus, string> = {
  'local-only': 'Cloud: local only',
  queued: 'Cloud: queued',
  syncing: 'Cloud: syncing',
  synced: 'Cloud: synced',
  offline: 'Cloud: offline',
  'auth-required': 'Cloud: sign-in required',
  conflict: 'Cloud: conflict',
  failed: 'Cloud: failed',
  quarantined: 'Cloud: quarantined',
};

function badgeVariant(status: CharacterAutomaticSyncStatus) {
  if (status === 'synced') return 'success' as const;
  if (
    status === 'conflict' ||
    status === 'failed' ||
    status === 'quarantined'
  ) {
    return 'danger' as const;
  }
  if (status === 'offline' || status === 'auth-required') {
    return 'warning' as const;
  }
  return 'neutral' as const;
}

export function CharacterAutomaticSyncControls(
  props: CharacterAutomaticSyncControlsProps
) {
  const created = useCharacterAutomaticSync();
  const actions = props.controller ?? created;
  const [preview, setPreview] = useState(actions.preview);
  if (!isAutomaticCharacterSyncEnabled()) return null;

  const handlePreview = async () => {
    setPreview(await actions.previewAccountEnable());
  };
  const handleConfirm = async () => {
    await actions.confirmAccountEnable();
    setPreview(null);
  };

  return (
    <section className="border-divider bg-surface-secondary mb-6 rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-heading flex items-center gap-2 text-sm font-semibold">
            <CloudCog size={18} /> Automatic character sync
          </h2>
          <p className="text-muted mt-1 text-sm">
            Separate from manual backup and local IndexedDB migration. Existing
            characters stay local-only until you select them.
          </p>
          {actions.accountLabel && (
            <p className="text-muted mt-1 text-xs">
              Signed-in target: {actions.accountLabel}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw size={14} />}
            onClick={() => actions.refresh()}
          >
            Refresh cloud status
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Preview enable all eligible characters"
            onClick={handlePreview}
            disabled={!actions.indexedDbPrimary}
          >
            Preview enable all
          </Button>
        </div>
      </div>

      {!actions.indexedDbPrimary && (
        <p
          className="text-accent-amber-text mb-3 flex items-center gap-2 text-sm"
          role="status"
        >
          <ShieldAlert size={16} /> Complete the explicit character IndexedDB
          cutover before selecting automatic sync.
        </p>
      )}

      {preview && (
        <div className="border-divider bg-surface-raised mb-3 rounded-md border p-3">
          <p className="text-heading text-sm font-medium">
            {preview.eligible.length} eligible character
            {preview.eligible.length === 1 ? '' : 's'}
          </p>
          <ul className="text-muted mt-1 list-inside list-disc text-sm">
            {preview.eligible.map(character => (
              <li key={character.id}>{character.name}</li>
            ))}
          </ul>
          <p className="text-muted mt-2 text-xs">
            Confirmation enables these current characters and makes automatic
            sync the default for future eligible characters. Individual off
            overrides still win.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="success"
              size="sm"
              aria-label="Confirm current and future automatic sync"
              onClick={handleConfirm}
            >
              Confirm
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                actions.cancelPreview();
                setPreview(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {props.characters.map(character => {
          const status = actions.statuses[character.id] ?? 'local-only';
          return (
            <div
              key={character.id}
              className="border-divider bg-surface-raised flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
            >
              <div>
                <p className="text-heading text-sm font-medium">
                  {character.name}
                </p>
                <Badge variant={badgeVariant(status)} size="sm">
                  {STATUS_LABEL[status]}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {status === 'local-only' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Enable automatic sync for ${character.name}`}
                    onClick={() => actions.enable(character)}
                    disabled={!actions.indexedDbPrimary}
                  >
                    Enable
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Disable automatic sync for ${character.name}`}
                    onClick={() => actions.disable(character.id)}
                  >
                    Turn off
                  </Button>
                )}
                {['offline', 'auth-required', 'failed'].includes(status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => actions.retry(character.id)}
                  >
                    Retry
                  </Button>
                )}
                {status === 'conflict' && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Keep my ${character.name}`}
                      onClick={() =>
                        actions.resolveConflict(character.id, 'keep-mine')
                      }
                    >
                      Keep mine
                    </Button>
                    <Button
                      variant="warning"
                      size="sm"
                      aria-label={`Use cloud ${character.name}`}
                      onClick={() =>
                        actions.resolveConflict(character.id, 'use-cloud')
                      }
                    >
                      Use cloud
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Keep both ${character.name} versions`}
                      onClick={() =>
                        actions.resolveConflict(character.id, 'keep-both')
                      }
                    >
                      Keep both
                    </Button>
                  </>
                )}
                {status === 'quarantined' && (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Download quarantined ${character.name} candidate`}
                    onClick={() => actions.downloadQuarantine(character.id)}
                  >
                    Download quarantined data
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {actions.error && (
        <p className="text-accent-red-text mt-3 text-sm" role="alert">
          {actions.error}
        </p>
      )}
    </section>
  );
}
