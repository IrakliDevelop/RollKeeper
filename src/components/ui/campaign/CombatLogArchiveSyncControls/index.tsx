'use client';

import {
  Database,
  Download,
  ScrollText,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/layout/card';
import type { CombatLogArchiveManifestBlocker } from '@/lib/durableDm/combatLogArchiveFamily';
import { isCombatLogArchiveClientVisible } from '@/lib/durableDm/slice11fFlags';
import type { CampaignInfo } from '@/types/campaign';

import { ACTIVE_COMBAT_LOG_GUIDANCE } from './CombatLogArchiveSyncControls.hooks';
import { useCombatLogArchiveSyncContext } from './CombatLogArchiveSyncProvider';

export {
  ACTIVE_COMBAT_LOG_GUIDANCE,
  planCombatLogArchiveMutations,
  runCombatLogArchiveMutationPlan,
  useCombatLogArchiveSyncController,
  type CampaignArchive,
  type CombatLogArchiveCommitOutcome,
  type CombatLogArchiveMutationPlan,
  type CombatLogArchiveSyncController,
} from './CombatLogArchiveSyncControls.hooks';
export {
  CombatLogArchiveSyncProvider,
  useCombatLogArchiveSyncContext,
} from './CombatLogArchiveSyncProvider';

/** Sizes are for a DM, not a developer: KB and MB, never raw byte counts. */
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function summarize(recordCount: number, totalBytes: number, blockers: number) {
  const logs =
    recordCount === 1 ? '1 combat log' : `${recordCount} combat logs`;
  const attention =
    blockers === 0
      ? 'nothing needs attention'
      : blockers === 1
        ? '1 needs attention'
        : `${blockers} need attention`;
  return `${logs} · ${formatSize(totalBytes)} · ${attention}`;
}

/**
 * Plain-language version of a manifest blocker. The original kind and detail
 * stay on the muted reference line below, so nothing a DM might need to quote
 * is lost.
 */
function blockerMessage(blocker: CombatLogArchiveManifestBlocker) {
  switch (blocker.kind) {
    case 'active-combat-log':
      return 'One of these combat logs is still running. End that combat first.';
    case 'incomplete-envelope':
      return 'Nothing has been saved on this device yet. Run a combat first.';
    case 'malformed-json':
      return "The combat logs saved on this device can't be read. Restore a safety copy first.";
    case 'legacy-schema':
    case 'future-schema':
      return 'The combat logs on this device were saved by a different version of RollKeeper. Open them once in this version, then try again.';
    case 'oversized-record':
      return 'One combat log is too big to back up. Delete it or shorten it and try again.';
    case 'too-many-records':
    case 'oversized-family':
      return 'These combat logs are too big to back up together. Delete one you no longer need and try again.';
    default:
      return 'One of your combat logs has a problem that needs fixing first. Nothing has changed.';
  }
}

function archiveLabel(startedAt: string, endedAt: string | undefined) {
  const started = new Date(startedAt);
  const when = Number.isNaN(started.getTime())
    ? startedAt
    : started.toLocaleString();
  return endedAt ? when : `${when} · still running`;
}

/**
 * The visible card. Hydration and autosave are owned by the route-level
 * `CombatLogArchiveSyncProvider`, so this component only reads that controller
 * and renders nothing when the owner is absent, belongs to another campaign, or
 * the client flag is off.
 */
export function CombatLogArchiveSyncControls({
  campaign,
}: {
  campaign: CampaignInfo;
}) {
  const sync = useCombatLogArchiveSyncContext();
  if (!sync || !isCombatLogArchiveClientVisible()) return null;
  if (sync.campaignCode !== campaign.code) return null;

  return (
    <Card padding="lg" className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText size={20} /> Combat log backup
        </CardTitle>
        <CardDescription>
          Keep your combat logs on this device and, if you want, back them up to
          your account so you can open them on another device. Nothing leaves
          this device until you turn it on. Players never see your combat logs,
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
                disabled={!sync.recoveryVerified || !sync.archivesSelected}
              >
                Get this device ready
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
                  Turn on for this device
                </Button>
              )}
          </div>
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
            {/* Ruling 3: an unfinished combat log blocks only the switch-over;
                every edit keeps saving while it runs. */}
            {sync.manifest.blockers.some(
              blocker => blocker.kind === 'active-combat-log'
            ) && (
              <p role="alert" className="text-accent-amber-text">
                {ACTIVE_COMBAT_LOG_GUIDANCE}
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
                  {blocker.kind}: {blocker.detail}
                </p>
              ))}
            </div>
          </div>
        )}
        {sync.archives.length > 0 && (
          <div className="space-y-2">
            {sync.archives.map(({ archiveId, archive }) => (
              <div
                className="border-divider flex items-center justify-between rounded-lg border p-2"
                key={archiveId}
              >
                <span className="text-body text-sm">
                  {archive.encounterId} ·{' '}
                  <span className="text-muted">
                    {archiveLabel(archive.startedAt, archive.endedAt)}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => sync.deleteArchive(archiveId)}
                >
                  Delete this archive
                </Button>
              </div>
            ))}
          </div>
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
