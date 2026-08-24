'use client';

import { useMemo } from 'react';
import {
  Database,
  Download,
  History,
  RotateCcw,
  ScrollText,
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
import {
  canonicalJson,
  combatLogArchivePayloadFrom,
  type CombatLogArchiveManifestBlocker,
} from '@/lib/durableDm/combatLogArchiveFamily';
import { isCombatLogArchiveClientVisible } from '@/lib/durableDm/slice11fFlags';
import { useCombatLogStore } from '@/store/combatLogStore';
import { useEncounterStore } from '@/store/encounterStore';
import type { CampaignInfo } from '@/types/campaign';
import type {
  CombatLogAdmissionReason,
  CombatLogState,
} from '@/types/combatLog';

import {
  ACTIVE_COMBAT_LOG_GUIDANCE,
  downloadFile,
} from './CombatLogArchiveSyncControls.hooks';
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

/**
 * Sizes are for a DM, not a developer: always a rounded number with a unit,
 * never a bare byte count. Under a kilobyte the unit *is* bytes, because
 * "0.4 KB" reads worse than "431 bytes" for the smallest logs.
 */
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
 * A DM names an encounter, never an archive, so the encounter's own name is the
 * only plain-language label a combat log has. `encounterId` is a developer
 * identifier and is deliberately not shown; a log whose encounter has since
 * been deleted still gets words rather than a hex-looking id.
 */
function archiveName(names: Map<string, string>, encounterId: string) {
  return names.get(encounterId) ?? 'Untitled combat';
}

function eventCountLabel(count: number) {
  return count === 1 ? '1 event' : `${count} events`;
}

/**
 * Same measurement the manifest and the admission bounds use — canonical UTF-8
 * bytes of the payload — so a row can never disagree with the summary above it.
 */
function archiveBytes(archive: CombatLogState) {
  return new TextEncoder().encode(
    canonicalJson(combatLogArchivePayloadFrom(archive))
  ).byteLength;
}

/**
 * Plain-language version of a refused edit (ruling 5). The store rejects the
 * change outright, so every message says so: a DM must never be left believing
 * a combat was recorded when it was not.
 */
function admissionMessage(reason: CombatLogAdmissionReason) {
  switch (reason) {
    case 'record-bytes':
      return 'That combat log has grown too big to save, so that change was not saved. End this combat and start a new log — everything already saved is safe.';
    case 'item-count':
      return 'This campaign already holds as many combat logs as it can, so that change was not saved. Delete one you no longer need, then try again.';
    case 'total-bytes':
      return 'Your combat logs for this campaign take up too much space together, so that change was not saved. Delete one you no longer need, then try again.';
    default: {
      // A fourth bound must get its own words rather than silently inheriting
      // the total-bytes copy, so the compiler refuses this branch.
      const unhandled: never = reason;
      return unhandled;
    }
  }
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
  // Read before the guards below: a hook can never sit behind an early return.
  const encounters = useEncounterStore(state => state.encounters);
  const admissionError = useCombatLogStore(state => state.lastAdmissionError);
  const dismissAdmissionError = useCombatLogStore(
    state => state.dismissAdmissionError
  );
  const exportArchive = useCombatLogStore(state => state.exportArchive);
  const encounterNames = useMemo(
    () => new Map(encounters.map(encounter => [encounter.id, encounter.name])),
    [encounters]
  );
  // A campaign may hold up to COMBAT_LOG_ARCHIVE_MAX_ITEMS archives of up to
  // COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES each, so the per-row sizes are encoded
  // only when the archives themselves change. `encounterNames` is deliberately
  // NOT a dependency here: the encounter store uses immutable updates, so every
  // encounter edit changes its array identity and would otherwise re-encode
  // every archive on a route the DM keeps open during live combat.
  const archives = sync?.archives;
  const measured = useMemo(
    () =>
      (archives ?? []).map(({ archiveId, archive }) => ({
        archiveId,
        encounterId: archive.encounterId,
        label: archiveLabel(archive.startedAt, archive.endedAt),
        detail: `${eventCountLabel(archive.events.length)} · ${formatSize(
          archiveBytes(archive)
        )}`,
      })),
    [archives]
  );
  // Joining the name back on is a map lookup per row and nothing more.
  const rows = useMemo(
    () =>
      measured.map(row => ({
        ...row,
        name: archiveName(encounterNames, row.encounterId),
      })),
    [measured, encounterNames]
  );
  if (!sync || !isCombatLogArchiveClientVisible()) return null;
  if (sync.campaignCode !== campaign.code) return null;

  const downloadArchive = (archiveId: string, format: 'json' | 'text') =>
    downloadFile(
      `combat-log-${archiveId}.${format === 'json' ? 'json' : 'txt'}`,
      exportArchive(archiveId, format),
      format === 'json' ? 'application/json' : 'text/plain'
    );

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
        {/* A refused edit is the one thing on this card that happens mid-combat
            and needs saying first, whether or not backup is set up. */}
        {admissionError && (
          <div className="border-accent-red-border bg-accent-red-bg flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3">
            <p role="alert" className="text-accent-red-text text-sm">
              {admissionMessage(admissionError.reason)}
            </p>
            <Button size="sm" variant="ghost" onClick={dismissAdmissionError}>
              Dismiss
            </Button>
          </div>
        )}
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
              Check this device
            </Button>
            {sync.enrollmentPreview?.authority === 'postgres' &&
              sync.authority?.authority === 'localStorage' && (
                <Button variant="warning" onClick={sync.enrollDevice}>
                  Add this device to your account
                </Button>
              )}
            {sync.enrollmentPreview?.authority === 'postgres' &&
              sync.authority?.authority === 'postgres' && (
                <Button
                  variant="warning"
                  onClick={sync.applyExactCloudVersion}
                  loading={sync.busy}
                >
                  Use the copy from your account
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
            {sync.authority?.authority === 'indexedDB' && (
              <Button
                variant="primary"
                onClick={sync.activateCloud}
                loading={sync.busy}
              >
                Turn on backup to your account
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
                  Remove this account&apos;s data from this device
                </Button>
              </>
            )}
          </div>
        )}
        {sync.authority?.authority === 'postgres' &&
          sync.archives.length > 0 && (
            <SelectField
              label="Combat log to show earlier versions for"
              value={sync.historyLegacyId ?? undefined}
              onValueChange={sync.setHistoryLegacyId}
            >
              {rows.map(row => (
                <SelectItem key={row.archiveId} value={row.archiveId}>
                  {`${row.name} · ${row.label}`}
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
            {rows.map(({ archiveId, name, label, detail }) => (
              <div
                className="border-divider flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"
                key={archiveId}
              >
                <div>
                  <p className="text-body text-sm font-medium">{name}</p>
                  <p className="text-muted text-xs">{`${label} · ${detail}`}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => downloadArchive(archiveId, 'json')}
                  >
                    Download as JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => downloadArchive(archiveId, 'text')}
                  >
                    Download as text
                  </Button>
                  {/* Never gated. A refused edit is raised by the local store
                      with no relation to enrollment, and its guidance tells the
                      DM to delete a combat log, so this control has to exist
                      wherever that banner can appear. It is last in the row,
                      after both downloads, and `window.confirm` still covers
                      the destructive step. */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => sync.deleteArchive(archiveId)}
                  >
                    Delete this combat log
                  </Button>
                </div>
              </div>
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
            Players never see these. Running combat is unaffected.
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
