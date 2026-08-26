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
import type { EncounterManifestBlocker } from '@/lib/durableDm/encounterFamily';
import { isEncounterClientVisible } from '@/lib/durableDm/slice11eFlags';
import { areStandaloneMigrationControlsVisible } from '@/lib/durableDm/slice11gFlags';
import type { CampaignInfo } from '@/types/campaign';

import { ACTIVE_ENCOUNTER_GUIDANCE } from './EncounterSyncControls.hooks';
import { useEncounterSyncContext } from './EncounterSyncProvider';

export {
  ACTIVE_ENCOUNTER_GUIDANCE,
  planEncounterMutations,
  runEncounterMutationPlan,
  useEncounterSyncController,
  type EncounterCommitOutcome,
  type EncounterMutationPlan,
  type EncounterSyncController,
} from './EncounterSyncControls.hooks';
export {
  EncounterSyncProvider,
  useEncounterSyncContext,
} from './EncounterSyncProvider';

/** Sizes are for a DM, not a developer: KB and MB, never raw byte counts. */
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function summarize(recordCount: number, totalBytes: number, blockers: number) {
  const encounters =
    recordCount === 1 ? '1 encounter' : `${recordCount} encounters`;
  const attention =
    blockers === 0
      ? 'nothing needs attention'
      : blockers === 1
        ? '1 needs attention'
        : `${blockers} need attention`;
  return `${encounters} · ${formatSize(totalBytes)} · ${attention}`;
}

/**
 * Plain-language version of a manifest blocker. The original kind and detail
 * stay on the muted reference line below, so nothing a DM might need to quote
 * is lost.
 */
function blockerMessage(blocker: EncounterManifestBlocker) {
  const named = /"([^"]+)"/.exec(blocker.detail)?.[1];
  switch (blocker.kind) {
    case 'active-encounter':
      return `"${named ?? 'An encounter'}" is in combat right now. End that combat first.`;
    case 'incomplete-envelope':
      return 'Nothing has been saved on this browser yet. Open an encounter first.';
    case 'malformed-json':
      return "The encounters saved on this browser can't be read. Restore a safety copy first.";
    case 'legacy-schema':
    case 'future-schema':
      return 'The encounters on this browser were saved by a different version of RollKeeper. Open them once in this version, then try again.';
    case 'oversized-record':
      return `"${named ?? 'One encounter'}" is too big to back up. Remove some creatures from it and try again.`;
    case 'oversized-family':
      return 'These encounters are too big to back up together. Delete an encounter you no longer need and try again.';
    default:
      return 'One of your encounters has a problem that needs fixing first. Nothing has changed.';
  }
}

/**
 * The visible card. Hydration and autosave are owned by the route-level
 * `EncounterSyncProvider` (mounted in `app/dm/campaign/[code]/layout.tsx`), so
 * this component only reads that controller and renders nothing when the owner
 * is absent, belongs to another campaign, or the client flag is off.
 */
export function EncounterSyncControls({
  campaign,
}: {
  campaign: CampaignInfo;
}) {
  const sync = useEncounterSyncContext();
  if (!sync || !isEncounterClientVisible()) return null;
  if (!areStandaloneMigrationControlsVisible()) return null;
  if (sync.campaignCode !== campaign.code) return null;

  return (
    <Card padding="lg" className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud size={20} /> Encounter backup
        </CardTitle>
        <CardDescription>
          Keep your encounters on this browser and, if you want, back them up to
          your account so you can open them on another browser. Nothing leaves
          this browser until you turn it on. Players never see your encounters,
          and running combat is unaffected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!sync.context && (
          <Button variant="outline" onClick={sync.discover} loading={sync.busy}>
            Find my campaigns
          </Button>
        )}
        {sync.context && !sync.workspace && (
          <div className="space-y-2">
            <p className="text-body text-sm">
              Pick the campaign in your account that matches this one.
            </p>
            {sync.workspaces.map(item => (
              <Button
                key={item.localId}
                variant="outline"
                size="sm"
                onClick={() => sync.choose(item)}
              >
                Use {item.name} ({item.displayCode})
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
              See what will be backed up
            </Button>
            <Button
              variant="outline"
              onClick={sync.previewEnrollment}
              loading={sync.busy}
            >
              Check this browser
            </Button>
            {sync.enrollmentPreview?.authority === 'postgres' &&
              sync.authority?.authority === 'localStorage' && (
                <Button variant="warning" onClick={sync.enrollDevice}>
                  Add this browser to my account
                </Button>
              )}
            {sync.enrollmentPreview?.authority === 'postgres' &&
              sync.authority?.authority === 'postgres' && (
                <Button
                  variant="warning"
                  onClick={sync.applyExactCloudVersion}
                  loading={sync.busy}
                >
                  Load the copy from my account
                </Button>
              )}
            {sync.manifest && sync.recovery && (
              <Button
                variant="warning"
                leftIcon={<Download size={16} />}
                onClick={sync.downloadRecovery}
              >
                Download a safety copy
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
                  Open the safety copy to continue
                </Button>
                <input
                  ref={sync.recoveryInput}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  aria-label="Safety copy you downloaded"
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
                disabled={!sync.recoveryVerified || !sync.encountersSelected}
              >
                Get this browser ready
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
                  Switch this browser over
                </Button>
              )}
            {sync.authority?.authority === 'indexedDB' && (
              <Button
                variant="primary"
                onClick={sync.activateCloud}
                loading={sync.busy}
              >
                Turn on backup to my account
              </Button>
            )}
            {sync.authority?.authority === 'postgres' && (
              <>
                <Button
                  variant="outline"
                  leftIcon={<History size={16} />}
                  onClick={sync.loadHistory}
                >
                  Earlier versions
                </Button>
                <Button
                  variant="outline"
                  leftIcon={<RotateCcw size={16} />}
                  onClick={sync.rollback}
                >
                  Stop backing up
                </Button>
                <Button variant="danger" onClick={sync.removeAccountFromDevice}>
                  Remove this account&apos;s data from this browser
                </Button>
              </>
            )}
          </div>
        )}
        {sync.authority?.authority === 'postgres' &&
          sync.encounters.length > 0 && (
            <SelectField
              label="Encounter to show earlier versions for"
              value={sync.historyLegacyId ?? undefined}
              onValueChange={sync.setHistoryLegacyId}
            >
              {sync.encounters.map(encounter => (
                <SelectItem key={encounter.id} value={encounter.id}>
                  {encounter.name}
                </SelectItem>
              ))}
            </SelectField>
          )}
        {sync.manifest && (
          <div className="bg-surface-secondary rounded-lg p-3 text-sm">
            <p className="text-heading font-medium">
              {summarize(
                sync.manifest.recordCount,
                sync.manifest.totalBytes,
                sync.manifest.blockers.length
              )}
            </p>
            {sync.manifest.blockers.map(blocker => (
              <p
                role="alert"
                className="text-accent-red-text"
                key={`${blocker.kind}:${blocker.legacyId ?? ''}:${blocker.detail}`}
              >
                {blockerMessage(blocker)}
              </p>
            ))}
            {/* Ruling 1b: an active combat blocks only the switch-over; every
                edit keeps saving while it runs. */}
            {sync.manifest.blockers.some(
              blocker => blocker.kind === 'active-encounter'
            ) && (
              <p role="alert" className="text-accent-amber-text">
                {ACTIVE_ENCOUNTER_GUIDANCE}
              </p>
            )}
            {/* Reference detail: exact identifiers a DM can quote to support. */}
            <div className="text-muted mt-2 space-y-1 text-xs">
              <p>
                Reference: {sync.manifest.fingerprint.slice(0, 12)}
                {sync.authority && sync.authority.epoch > 0
                  ? ` · step ${sync.authority.epoch}`
                  : ''}
              </p>
              {sync.manifest.blockers.map(blocker => (
                <p
                  key={`detail:${blocker.kind}:${blocker.legacyId ?? ''}:${blocker.detail}`}
                >
                  {blockerKindReferenceLabel(blocker.kind)}: {blocker.detail}
                </p>
              ))}
            </div>
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
                Compare the two most recent
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
                  Version {version.serverVersion} ·{' '}
                  <span className="text-muted">
                    {version.tombstoned
                      ? 'deleted'
                      : version.payloadFingerprint.slice(0, 10)}
                  </span>
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => sync.exportVersion(version.serverVersion)}
                  >
                    Download this version
                  </Button>
                  {version.serverVersion !== sync.versions[0].serverVersion && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => sync.restoreVersion(version.serverVersion)}
                    >
                      Restore this version
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {sync.authority?.authority === 'postgres' && (
          <p role="status" className="text-muted text-sm">
            Players never see these. Live combat is unaffected.
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
