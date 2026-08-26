'use client';

import {
  Cloud,
  Database,
  Download,
  History,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/layout/card';
import { blockerKindReferenceLabel } from '@/lib/durableDm/blockerReferenceLabel';
import { isNpcClientVisible } from '@/lib/durableDm/slice11dFlags';
import { areStandaloneMigrationControlsVisible } from '@/lib/durableDm/slice11gFlags';

import { useNpcSyncContext } from './NpcSyncProvider';

export {
  planNpcMutations,
  runNpcMutationPlan,
  useNpcSyncController,
  type NpcCommitOutcome,
  type NpcMutationPlan,
  type NpcSyncController,
} from './NpcSyncControls.hooks';
export { NpcSyncProvider, useNpcSyncContext } from './NpcSyncProvider';

/**
 * The visible card. Hydration and autosave are owned by the route-level
 * `NpcSyncProvider` (mounted in `app/dm/campaign/[code]/layout.tsx`), so this
 * component only reads that controller and renders nothing when the owner is
 * absent or the client flag is off.
 */
export function NpcSyncControls() {
  const sync = useNpcSyncContext();
  if (!sync || !isNpcClientVisible()) return null;
  if (!areStandaloneMigrationControlsVisible()) return null;

  return (
    <Card padding="lg" className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud size={20} /> NPC cloud sync
        </CardTitle>
        <CardDescription>
          Default-off owner workflow. Login, navigation, discovery, and first
          use never enroll or change authority. NPCs are DM-private; players
          never receive a projection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!sync.context && (
          <Button variant="outline" onClick={sync.discover} loading={sync.busy}>
            Find owner workspaces
          </Button>
        )}
        {sync.context && !sync.workspace && (
          <div className="space-y-2">
            <p className="text-body text-sm">
              Explicitly choose the owner-verified workspace for this local
              campaign.
            </p>
            {sync.workspaces.map(item => (
              <Button
                key={item.localId}
                variant="outline"
                size="sm"
                onClick={() => sync.choose(item)}
              >
                Select {item.name} ({item.displayCode})
              </Button>
            ))}
          </div>
        )}
        {sync.workspace && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              leftIcon={<Database size={16} />}
              onClick={sync.preview}
              loading={sync.busy}
            >
              Preview exact manifest
            </Button>
            <Button
              variant="outline"
              onClick={sync.previewEnrollment}
              loading={sync.busy}
            >
              Preview cloud enrollment
            </Button>
            {sync.enrollmentPreview?.authority === 'postgres' &&
              sync.authority?.authority === 'localStorage' && (
                <Button variant="warning" onClick={sync.enrollDevice}>
                  Enroll this browser
                </Button>
              )}
            {sync.enrollmentPreview?.authority === 'postgres' &&
              sync.authority?.authority === 'postgres' && (
                <Button
                  variant="warning"
                  onClick={sync.applyExactCloudVersion}
                  loading={sync.busy}
                >
                  Apply exact cloud version
                </Button>
              )}
            {sync.manifest && sync.recovery && (
              <Button
                variant="warning"
                leftIcon={<Download size={16} />}
                onClick={sync.downloadRecovery}
              >
                Download recovery file
              </Button>
            )}
            {sync.manifest && sync.recovery && (
              <>
                <Button
                  variant="outline"
                  leftIcon={<Upload size={16} />}
                  onClick={() => sync.recoveryInput.current?.click()}
                  disabled={sync.busy}
                >
                  Verify recovery file and select
                </Button>
                <input
                  ref={sync.recoveryInput}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  aria-label="Downloaded NPC recovery file"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) void sync.verifyRecoveryAndSelect(file);
                  }}
                />
              </>
            )}
            {sync.recovery && (
              <Button
                variant="outline"
                onClick={sync.prepare}
                loading={sync.busy}
                disabled={!sync.recoveryVerified || !sync.npcsSelected}
              >
                Prepare IndexedDB
              </Button>
            )}
            {sync.manifest &&
              sync.preparedGeneration &&
              sync.manifest.blockers.length === 0 &&
              sync.authority?.authority === 'localStorage' && (
                <Button
                  variant="warning"
                  leftIcon={<ShieldCheck size={16} />}
                  onClick={sync.activateLocal}
                >
                  Confirm local cutover
                </Button>
              )}
            {sync.authority?.authority === 'indexedDB' && (
              <Button
                variant="primary"
                onClick={sync.activateCloud}
                loading={sync.busy}
              >
                Turn on cloud sync
              </Button>
            )}
            {sync.authority?.authority === 'postgres' && (
              <>
                <Button
                  variant="outline"
                  leftIcon={<History size={16} />}
                  onClick={sync.loadHistory}
                >
                  Version history
                </Button>
                <Button
                  variant="outline"
                  leftIcon={<RotateCcw size={16} />}
                  onClick={sync.rollback}
                >
                  Verified rollback
                </Button>
                <Button variant="danger" onClick={sync.removeAccountFromDevice}>
                  Remove this account from this browser
                </Button>
              </>
            )}
          </div>
        )}
        {sync.authority?.authority === 'postgres' &&
          sync.npcs &&
          sync.npcs.length > 0 && (
            <SelectField
              label="NPC for version history"
              value={sync.historyLegacyId ?? undefined}
              onValueChange={sync.setHistoryLegacyId}
            >
              {sync.npcs.map(npc => (
                <SelectItem key={npc.id} value={npc.id}>
                  {npc.name}
                </SelectItem>
              ))}
            </SelectField>
          )}
        {sync.manifest && (
          <div className="bg-surface-secondary rounded-lg p-3 text-sm">
            <p className="text-heading font-medium">
              Manifest {sync.manifest.fingerprint.slice(0, 12)}
            </p>
            <p className="text-body">
              {sync.manifest.recordCount} records · {sync.manifest.totalBytes}{' '}
              bytes · {sync.manifest.blockers.length} blockers
            </p>
            {sync.manifest.blockers.map(blocker => (
              <p
                role="alert"
                className="text-accent-red-text"
                key={`${blocker.kind}:${blocker.legacyId ?? ''}:${blocker.detail}`}
              >
                {blockerKindReferenceLabel(blocker.kind)}: {blocker.detail}
              </p>
            ))}
          </div>
        )}
        {sync.versions.length > 0 && (
          <div className="space-y-2">
            {sync.versions.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={sync.compareLatestVersions}
              >
                Compare latest versions
              </Button>
            )}
            {sync.comparison && (
              <p className="text-body text-sm">{sync.comparison}</p>
            )}
            {sync.versions.map(version => (
              <div
                className="border-divider flex items-center justify-between rounded-lg border p-2"
                key={version.serverVersion}
              >
                <span className="text-body text-sm">
                  Version {version.serverVersion} · epoch {version.cutoverEpoch}{' '}
                  ·{' '}
                  {version.tombstoned
                    ? 'tombstone'
                    : version.payloadFingerprint.slice(0, 10)}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => sync.exportVersion(version.serverVersion)}
                  >
                    Export exact version
                  </Button>
                  {version.serverVersion !== sync.versions[0].serverVersion && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => sync.restoreVersion(version.serverVersion)}
                    >
                      Restore as new version
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {sync.authority?.authority === 'postgres' && (
          <p role="status" className="text-muted text-sm">
            Player view: not applicable · NPCs are DM-private
          </p>
        )}
        {sync.status && (
          <p role="status" className="text-body text-sm">
            {sync.status}
          </p>
        )}
        {sync.error && (
          <p role="alert" className="text-accent-red-text text-sm">
            {sync.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
