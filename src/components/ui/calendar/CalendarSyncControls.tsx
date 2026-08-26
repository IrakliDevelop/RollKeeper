'use client';

import { useEffect, useRef, useState } from 'react';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/layout/card';
import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  buildCalendarManifest,
  buildCalendarWorkingCopyManifest,
  calendarPayloadFromCampaignCalendar,
  fingerprintCalendarPayload,
  fingerprintCalendarTombstone,
  type CalendarManifest,
} from '@/lib/durableDm/calendarFamily';
import { blockerKindReferenceLabel } from '@/lib/durableDm/blockerReferenceLabel';
import { calendarApi } from '@/lib/durableDm/calendarApi';
import { CalendarHttpGateway } from '@/lib/durableDm/calendarHttpGateway';
import { CalendarSyncService } from '@/lib/durableDm/calendarSyncService';
import { isCalendarClientVisible } from '@/lib/durableDm/slice11bFlags';
import { areStandaloneMigrationControlsVisible } from '@/lib/durableDm/slice11gFlags';
import {
  readCalendarProjectionAuthority,
  writeCalendarProjectionAuthority,
} from '@/lib/durableDm/calendarLegacyProjection';
import {
  captureDeviceBackup,
  initiateDeviceBackupDownload,
  type DeviceBackupV1,
  verifyDownloadedDeviceBackup,
} from '@/lib/deviceRecovery';
import {
  commitCalendarLocalCutover,
  enrollCalendarCloudDevice,
  markCalendarCloudAuthority,
  readCalendarAuthority,
  rollbackCalendarLocalAuthority,
  type CalendarAuthority,
} from '@/lib/indexeddb/calendarAuthority';
import { runCalendarIndexedDbMigration } from '@/lib/indexeddb/calendarMigration';
import { IndexedDbCalendarRepository } from '@/lib/indexeddb/calendarRepository';
import {
  hasCalendarSelection,
  readCalendarSelection,
  selectCalendar,
} from '@/lib/indexeddb/calendarSelection';
import { openRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';
import {
  associateWorkspaceWithLegacyCampaign,
  createBrowserDmWorkspace,
  type BrowserDmWorkspaceContext,
} from '@/lib/supabase/browserDmWorkspace';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import type { CampaignInfo } from '@/types/campaign';
import { APP_VERSION } from '@/utils/constants';
import { useCalendarStore } from '@/store/calendarStore';

interface VersionMetadata {
  serverVersion: number;
  cutoverEpoch: number;
  schemaVersion: number;
  payloadFingerprint: string;
  tombstoned: boolean;
  acceptedAt: string;
}

interface VersionExport {
  serverVersion: number;
  schemaVersion: number;
  payloadFingerprint: string;
  tombstoned: boolean;
  payload: CalendarManifest['records'][number]['payload'] | null;
}

interface EnrollmentPreview {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  legacyId?: string;
  serverVersion?: number;
  schemaVersion?: number;
  payloadFingerprint?: string;
  tombstoned?: boolean;
  payload?: CalendarManifest['records'][number]['payload'] | null;
}

interface ProjectionStatus {
  status: 'current' | 'pending' | 'failed';
  pendingCount: number;
  failedCount: number;
  oldestPendingAt: string | null;
  freshnessSloSeconds: number;
}

interface ProjectionIncident {
  incidentId: string;
  eventId: string;
  kind: string;
  createdAt: string;
}

interface Props {
  campaign: CampaignInfo;
}

function currentRawEnvelope() {
  return localStorage.getItem('rollkeeper-calendar-data') ?? '';
}

function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function hideCalendar(campaignCode: string) {
  useCalendarStore.setState(state => ({
    calendars: state.calendars.filter(
      value => value.campaignCode !== campaignCode
    ),
  }));
}

/** Identity of the exact local generation a hydration pass consumed. */
function authorityGeneration(
  accountId: string,
  campaignId: string,
  next: CalendarAuthority
) {
  return `${accountId}:${campaignId}:${next.authority}:${next.epoch}`;
}

function applyCalendarPayload(
  campaignCode: string,
  payload: CalendarManifest['records'][number]['payload']
) {
  useCalendarStore.setState(state => ({
    calendars: [
      ...state.calendars.filter(value => value.campaignCode !== campaignCode),
      { campaignCode, ...structuredClone(payload) },
    ],
  }));
}

export function CalendarSyncControls({ campaign }: Props) {
  const calendar = useCalendarStore(state =>
    state.calendars.find(value => value.campaignCode === campaign.code)
  );
  const [context, setContext] = useState<BrowserDmWorkspaceContext | null>(
    null
  );
  const [scope, setScope] = useState<{
    accountId: string;
    campaignId: string;
  } | null>(null);
  const [workspaces, setWorkspaces] = useState<DmWorkspaceDocument[]>([]);
  const [workspace, setWorkspace] = useState<DmWorkspaceDocument | null>(null);
  const [manifest, setManifest] = useState<CalendarManifest | null>(null);
  const [recovery, setRecovery] = useState<DeviceBackupV1 | null>(null);
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [calendarSelected, setCalendarSelected] = useState(false);
  const [preparedGeneration, setPreparedGeneration] = useState<string | null>(
    null
  );
  const [authority, setAuthority] = useState<CalendarAuthority | null>(null);
  const [versions, setVersions] = useState<VersionMetadata[]>([]);
  const [comparison, setComparison] = useState<string | null>(null);
  const [enrollmentPreview, setEnrollmentPreview] =
    useState<EnrollmentPreview | null>(null);
  const [projectionStatus, setProjectionStatus] =
    useState<ProjectionStatus | null>(null);
  const [projectionIncidents, setProjectionIncidents] = useState<
    ProjectionIncident[]
  >([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Autosave is armed only once the store provably holds this device's routed
  // generation. `authority && scope` is not enough: device enrollment sets both
  // while the store still shows the un-uploaded local candidate.
  const [hydrated, setHydrated] = useState(false);
  const lastFingerprint = useRef<string | null>(null);
  // The exact local generation the store was hydrated from, so a repeated
  // Supabase auth event cannot re-run hydration over newer local work.
  const hydrationSignature = useRef<string | null>(null);
  // Autosave runs are serialized so two overlapping runs cannot interleave
  // their acknowledgements and rewind the baseline fingerprint, and so
  // hydration can queue behind an in-flight run.
  const autosaveChain = useRef<Promise<void>>(Promise.resolve());
  const rollbackMutationId = useRef<string | null>(null);
  const recoveryInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const marker = readCalendarProjectionAuthority(localStorage, campaign.code);
    if (!marker?.namespace || marker.authority === 'legacy_restored') return;
    let cancelled = false;
    const client = createSupabaseBrowserClient();
    if (!client) return;
    const hide = () => {
      setScope(null);
      setAuthority(null);
      setHydrated(false);
      hydrationSignature.current = null;
      hideCalendar(campaign.code);
    };
    const hydrate = async (accountId: string | null) => {
      if (cancelled) return;
      if (!accountId || marker.namespace !== `user:${accountId}`) {
        hide();
        return;
      }
      const database = await openRollkeeperDatabase();
      try {
        const [localAuthority, document] = await Promise.all([
          readCalendarAuthority(database, marker.namespace!, marker.campaignId),
          new IndexedDbCalendarRepository(database).getDocument(
            marker.namespace!,
            campaign.code
          ),
        ]);
        if (cancelled) return;
        if (!document || localAuthority.authority === 'localStorage') {
          hide();
          return;
        }
        // `onAuthStateChange` fires on TOKEN_REFRESHED (hourly, and whenever a
        // hidden tab's token expired) with the same account and the same local
        // generation. Re-running the pass below would replace the store with
        // the pre-edit calendar and reset the baseline underneath an in-flight
        // autosave run, losing the edit everywhere at once — the legacy key is
        // frozen for a routed campaign. A genuine account, campaign, or
        // authority/epoch change still changes this signature and still
        // hydrates.
        if (
          hydrationSignature.current ===
          authorityGeneration(accountId, marker.campaignId, localAuthority)
        )
          return;
        const restoredContext = await createBrowserDmWorkspace();
        if (cancelled) {
          restoredContext?.close();
          return;
        }
        const restoredWorkspaces = restoredContext
          ? await restoredContext.list()
          : [];
        const restoredWorkspace = restoredWorkspaces.find(
          item => item.cloudId === marker.campaignId
        );
        if (
          !restoredContext ||
          restoredContext.accountId !== accountId ||
          !restoredWorkspace
        ) {
          restoredContext?.close();
          setError(
            'The initialized calendar namespace has no matching owner workspace on this browser.'
          );
          return;
        }
        const fingerprint = await fingerprintCalendarPayload(document.payload!);
        if (fingerprint !== document.contentFingerprint) {
          setError(
            'Local calendar failed fingerprint verification; use history recovery.'
          );
          return;
        }
        if (!document.payload) {
          // This pass invalidated the store without establishing a baseline
          // for it, so it must disarm like every other invalidating path:
          // left armed, the emptied store diverges from the stale payload
          // fingerprint and autosave writes a delete nothing asked for.
          hideCalendar(campaign.code);
          setHydrated(false);
          return;
        }
        applyCalendarPayload(campaign.code, document.payload);
        lastFingerprint.current = document.contentFingerprint;
        setContext(restoredContext);
        setWorkspaces(restoredWorkspaces);
        setWorkspace(restoredWorkspace);
        setScope({ accountId, campaignId: marker.campaignId });
        setAuthority(localAuthority);
        hydrationSignature.current = authorityGeneration(
          accountId,
          marker.campaignId,
          localAuthority
        );
        setHydrated(true);
        setStatus(
          'Calendar loaded from the verified local IndexedDB generation.'
        );
      } finally {
        database.close();
      }
    };
    // Hydration shares the autosave chain, so it can never interleave with an
    // in-flight run that has already captured its fingerprint.
    const queueHydrate = (accountId: string | null) => {
      const queued = autosaveChain.current.then(() => hydrate(accountId));
      autosaveChain.current = queued.catch(() => undefined);
      return queued;
    };
    void client.auth
      .getSession()
      .then(result => queueHydrate(result.data.session?.user.id ?? null))
      .catch(cause =>
        setError(
          cause instanceof Error
            ? cause.message
            : 'Local account verification failed'
        )
      );
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      void queueHydrate(session?.user.id ?? null).catch(cause =>
        setError(
          cause instanceof Error ? cause.message : 'Local hydration failed'
        )
      );
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [campaign.code]);

  useEffect(
    () => () => {
      context?.close();
    },
    [context]
  );

  useEffect(() => {
    if (
      busy ||
      !hydrated ||
      !authority ||
      authority.authority === 'localStorage' ||
      !scope
    )
      return;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbCalendarRepository(database);
        const document = await repository.getDocument(
          `user:${scope.accountId}`,
          campaign.code
        );
        const payload = calendar
          ? calendarPayloadFromCampaignCalendar(calendar)
          : null;
        const fingerprint = calendar
          ? await fingerprintCalendarPayload(payload!)
          : await fingerprintCalendarTombstone(campaign.code);
        if (cancelled) return;
        if (lastFingerprint.current === null) {
          if (!calendar) return;
          lastFingerprint.current = fingerprint;
          return;
        }
        if (lastFingerprint.current === fingerprint) return;
        const mutation = {
          namespace: `user:${scope.accountId}` as const,
          campaignId: scope.campaignId,
          legacyId: campaign.code,
          cutoverEpoch: authority.epoch,
          operation: calendar ? ('replace' as const) : ('delete' as const),
          payload,
          schemaVersion: 1,
          localRevision: (document?.localRevision ?? 0) + 1,
          baseServerVersion: document?.baseServerVersion ?? 1,
          contentFingerprint: fingerprint,
          updatedAt: new Date().toISOString(),
        };
        if (authority.authority === 'indexedDB') {
          const result = await repository.commit(mutation);
          if (!result.saved)
            throw new Error('Local IndexedDB transaction failed');
          await repository.pause(mutation.namespace, mutation.campaignId);
          setStatus('Local: saved · Cloud: not active · Player view: legacy');
        } else {
          const result = await new CalendarSyncService({
            enabled: true,
            repository,
            gateway: new CalendarHttpGateway(),
          }).commit(mutation);
          setStatus(
            result.status === 'cloud-saved'
              ? `Local: saved · Cloud: saved · Player view: ${result.playerView}`
              : result.status === 'conflict'
                ? 'Local: saved · Cloud: conflict · Player view: unchanged'
                : 'Local: saved · Cloud: queued · Player view: pending'
          );
        }
        lastFingerprint.current = fingerprint;
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'Calendar save failed'
        );
      } finally {
        database.close();
      }
    };
    autosaveChain.current = autosaveChain.current
      .then(run)
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [authority, busy, calendar, campaign.code, hydrated, scope]);

  if (!isCalendarClientVisible()) return null;

  const discover = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = context ?? (await createBrowserDmWorkspace());
      if (!next) throw new Error('Sign in to the owner account first.');
      setContext(next);
      setWorkspaces((await next.discover()).filter(item => item.cloudId));
      setStatus(
        'Owner workspaces discovered. No data category was selected or changed.'
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Workspace discovery failed'
      );
    } finally {
      setBusy(false);
    }
  };

  const choose = async (selected: DmWorkspaceDocument) => {
    if (!context || !selected.cloudId) return;
    setWorkspace(associateWorkspaceWithLegacyCampaign(selected, campaign.code));
    setScope({ accountId: context.accountId, campaignId: selected.cloudId });
    setAuthority({ authority: 'localStorage', epoch: 0 });
    setStatus(
      'Workspace chosen. Browser enrollment and authority are unchanged.'
    );
  };

  const preview = async () => {
    setBusy(true);
    setError(null);
    try {
      const sourceManifest = await buildCalendarManifest({
        campaignCode: campaign.code,
        rawEnvelope: currentRawEnvelope(),
      });
      let nextManifest = sourceManifest;
      if (
        context &&
        workspace?.cloudId &&
        authority &&
        authority.authority !== 'localStorage' &&
        sourceManifest.blockers.length === 0
      ) {
        const database = await openRollkeeperDatabase();
        try {
          const document = await new IndexedDbCalendarRepository(
            database
          ).getDocument(`user:${context.accountId}`, campaign.code);
          if (!document || document.operation === 'delete' || !document.payload)
            throw new Error(
              'A verified IndexedDB working copy is required for preview.'
            );
          const fingerprint = await fingerprintCalendarPayload(
            document.payload
          );
          if (fingerprint !== document.contentFingerprint)
            throw new Error(
              'The IndexedDB working copy failed fingerprint verification.'
            );
          nextManifest = await buildCalendarWorkingCopyManifest({
            source: sourceManifest,
            payload: document.payload,
            schemaVersion: document.schemaVersion,
          });
        } finally {
          database.close();
        }
      }
      const nextRecovery = await captureDeviceBackup(localStorage, {
        appVersion: APP_VERSION,
        runId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      });
      setManifest(nextManifest);
      setRecovery(nextRecovery);
      setRecoveryVerified(false);
      setCalendarSelected(false);
      setPreparedGeneration(null);
      setStatus(
        'Exact preview created. No authority or storage pointer changed.'
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadRecovery = async () => {
    if (!recovery) return;
    setError(null);
    try {
      await initiateDeviceBackupDownload(recovery, browserRecoveryRepository);
      setRecoveryVerified(false);
      setCalendarSelected(false);
      setStatus(
        'Recovery download initiated. Reopen that file here before selection.'
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Recovery download failed'
      );
    }
  };

  const verifyRecoveryAndSelect = async (file: File) => {
    if (!context || !workspace?.cloudId || !recovery || !manifest) return;
    setBusy(true);
    setError(null);
    try {
      await verifyDownloadedDeviceBackup(
        await file.text(),
        recovery,
        browserRecoveryRepository
      );
      setRecoveryVerified(true);
      if (
        !window.confirm(
          `Recovery file verified. Select only calendar for ${campaign.name}? This does not cut over local or cloud authority.`
        )
      ) {
        setCalendarSelected(false);
        setStatus(
          'Recovery file verified; data category selection was cancelled and cutover remains blocked.'
        );
        return;
      }
      selectCalendar(localStorage, {
        namespace: `user:${context.accountId}`,
        campaignId: workspace.cloudId,
        confirmed: true,
        recovery: {
          runId: recovery.runId,
          manifestHash: recovery.manifestHash,
          createdAt: recovery.createdAt,
        },
        now: () => new Date().toISOString(),
      });
      setCalendarSelected(true);
      setStatus(
        'Recovery file verified and calendar selected. LocalStorage remains authoritative.'
      );
    } catch (cause) {
      setRecoveryVerified(false);
      setCalendarSelected(false);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Recovery file verification failed'
      );
    } finally {
      setBusy(false);
      if (recoveryInput.current) recoveryInput.current.value = '';
    }
  };

  const prepare = async () => {
    if (!context || !workspace?.cloudId || !recovery) return;
    setBusy(true);
    try {
      if (
        !hasCalendarSelection(
          localStorage,
          `user:${context.accountId}`,
          workspace.cloudId
        )
      ) {
        throw new Error(
          'Verify the downloaded recovery and explicitly select the data category first.'
        );
      }
      const selection = readCalendarSelection(
        localStorage,
        `user:${context.accountId}`,
        workspace.cloudId
      );
      if (
        !recoveryVerified ||
        !selection ||
        selection.recovery.runId !== recovery.runId ||
        selection.recovery.manifestHash !== recovery.manifestHash
      ) {
        throw new Error(
          'The current preview requires its exact downloaded recovery file to be verified.'
        );
      }
      const runId = `calendar-${crypto.randomUUID()}`;
      const result = await runCalendarIndexedDbMigration({
        factory: indexedDB,
        storage: localStorage,
        namespace: `user:${context.accountId}`,
        campaignId: workspace.cloudId,
        campaignCode: campaign.code,
        runId,
        ownerId: crypto.randomUUID(),
        now: () => new Date().toISOString(),
        nowMs: () => Date.now(),
        requiredRecoveryManifestHash: recovery.manifestHash,
        recoveryGate: {
          hasDownloadReceipt: manifestHash =>
            browserRecoveryRepository.hasVerifiedDownloadReceipt(manifestHash),
        },
      });
      setManifest(result.manifest);
      if (result.state !== 'CUTOVER_READY') {
        throw new Error(
          result.manifest.blockers.length > 0
            ? 'Unresolved candidates block only calendar; legacy behavior remains active.'
            : 'Local IndexedDB preparation did not satisfy every safety gate.'
        );
      }
      setPreparedGeneration(result.generation);
      setStatus(
        'IndexedDB preparation validated and reopened. Final confirmation is still required.'
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Preparation failed');
    } finally {
      setBusy(false);
    }
  };

  const activateLocal = async () => {
    if (
      !context ||
      !workspace?.cloudId ||
      !manifest?.records[0] ||
      !preparedGeneration
    )
      return;
    if (manifest.blockers.length > 0) return;
    if (
      !window.confirm(
        `Confirm exact manifest ${manifest.fingerprint.slice(0, 12)} and cut only calendar to IndexedDB?`
      )
    )
      return;
    const database = await openRollkeeperDatabase();
    try {
      const current = await buildCalendarManifest({
        campaignCode: campaign.code,
        rawEnvelope: currentRawEnvelope(),
      });
      if (current.fingerprint !== manifest.fingerprint)
        throw new Error('Manifest changed; preview again.');
      // Only the cloud-enrollment paths persisted the chosen workspace, so a
      // device that merely *discovered* one had no workspace_identity document
      // and could not hydrate after a reload: hydrate() looks the campaign up
      // by cloudId, bailed out, and left the store on the frozen legacy key
      // with every later edit silently uncommitted. Local cutover must stand
      // alone, with no cloud activation. Remembering before the cutover means a
      // failure here leaves legacy authority untouched.
      await context.remember(workspace);
      const next = await commitCalendarLocalCutover(database, {
        namespace: `user:${context.accountId}`,
        campaignId: workspace.cloudId,
        generation: preparedGeneration,
        confirmed: true,
        gates: {
          recoveryReceipt: true,
          sourceManifestUnchanged: true,
          captureVerifiedAfterReopen: true,
          manifestConfirmed: true,
          noConflicts: true,
          noQuarantine: true,
          parity: true,
          journalEmpty: true,
        },
        now: () => new Date().toISOString(),
        initialDocument: {
          namespace: `user:${context.accountId}`,
          campaignId: workspace.cloudId,
          legacyId: campaign.code,
          family: 'calendar',
          cutoverEpoch: 1,
          operation: 'create',
          payload: manifest.records[0].payload,
          schemaVersion: 1,
          localRevision: 1,
          baseServerVersion: 0,
          contentFingerprint: manifest.records[0].payloadFingerprint,
          updatedAt: new Date().toISOString(),
          deletedAt: null,
        },
      });
      setAuthority(next);
      hydrationSignature.current = authorityGeneration(
        context.accountId,
        workspace.cloudId,
        next
      );
      // The store already holds exactly the calendar this cutover captured.
      setHydrated(true);
      writeCalendarProjectionAuthority(localStorage, campaign.code, {
        version: 1,
        authority: 'indexedDB',
        epoch: next.epoch,
        campaignId: workspace.cloudId,
        namespace: `user:${context.accountId}`,
      });
      lastFingerprint.current = manifest.records[0].payloadFingerprint;
      setStatus(
        `Local: saved · IndexedDB authority epoch ${next.epoch} · Cloud: inactive`
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Local cutover failed');
    } finally {
      database.close();
    }
  };

  const activateCloud = async () => {
    if (
      !context ||
      !workspace?.cloudId ||
      !manifest?.records[0] ||
      !recovery ||
      authority?.authority !== 'indexedDB'
    )
      return;
    if (
      !window.confirm(
        'Stage, revalidate, and atomically activate only calendar in Postgres?'
      )
    )
      return;
    setBusy(true);
    try {
      const assertWorkingCopyUnchanged = async () => {
        const database = await openRollkeeperDatabase();
        try {
          const document = await new IndexedDbCalendarRepository(
            database
          ).getDocument(`user:${context.accountId}`, campaign.code);
          if (
            !document ||
            document.operation === 'delete' ||
            document.contentFingerprint !==
              manifest.records[0].payloadFingerprint
          )
            throw new Error(
              'IndexedDB working copy changed; preview the exact manifest again.'
            );
        } finally {
          database.close();
        }
      };
      await assertWorkingCopyUnchanged();
      const deviceKey = `rollkeeper:campaign-calendar-device:${context.accountId}:${workspace.cloudId}`;
      let deviceId = localStorage.getItem(deviceKey);
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem(deviceKey, deviceId);
      }
      const begun = await calendarApi<{ runId: string }>({
        action: 'begin-staging',
        mutationId: crypto.randomUUID(),
        campaignId: workspace.cloudId,
        deviceId,
        expectedEpoch: Math.max(0, authority.epoch - 1),
        manifestFingerprint: manifest.fingerprint,
        recoveryManifestHash: recovery.manifestHash,
        recoveryReceiptHash: recovery.manifestHash,
        recordCount: manifest.recordCount,
        totalBytes: manifest.totalBytes,
      });
      await calendarApi({
        action: 'stage-items',
        mutationId: crypto.randomUUID(),
        runId: begun.runId,
        items: manifest.records.map(record => ({
          legacyId: record.legacyId,
          schemaVersion: record.schemaVersion,
          payload: record.payload,
          payloadFingerprint: record.payloadFingerprint,
          tombstoned: false,
        })),
      });
      await assertWorkingCopyUnchanged();
      const activated = await calendarApi<{ epoch: number }>({
        action: 'confirm-cutover',
        mutationId: crypto.randomUUID(),
        runId: begun.runId,
        manifestFingerprint: manifest.fingerprint,
        expectedEpoch: Math.max(0, authority.epoch - 1),
      });
      const database = await openRollkeeperDatabase();
      try {
        const next = await markCalendarCloudAuthority(database, {
          namespace: `user:${context.accountId}`,
          campaignId: workspace.cloudId,
          expectedLocalEpoch: authority.epoch,
          cloudEpoch: activated.epoch,
          now: () => new Date().toISOString(),
          acceptedVersion: {
            legacyId: campaign.code,
            serverVersion: 1,
            payloadFingerprint: manifest.records[0].payloadFingerprint,
          },
        });
        setAuthority(next);
        hydrationSignature.current = authorityGeneration(
          context.accountId,
          workspace.cloudId,
          next
        );
        writeCalendarProjectionAuthority(localStorage, campaign.code, {
          version: 1,
          authority: 'postgres',
          epoch: next.epoch,
          campaignId: workspace.cloudId,
          namespace: `user:${context.accountId}`,
        });
      } finally {
        database.close();
      }
      setStatus(
        'Local: saved · Cloud: saved · Player view: pending acknowledgement'
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Cloud staging failed');
      setStatus(
        'Local: saved · Cloud: staging failed · IndexedDB authority retained'
      );
    } finally {
      setBusy(false);
    }
  };

  const previewEnrollment = async () => {
    if (!workspace?.cloudId) return;
    setBusy(true);
    setError(null);
    try {
      const preview = await calendarApi<EnrollmentPreview>({
        action: 'preview-enrollment',
        campaignId: workspace.cloudId,
      });
      setEnrollmentPreview(preview);
      setStatus(
        preview.authority === 'postgres'
          ? 'Cloud enrollment preview loaded. This browser remains unenrolled.'
          : 'The selected calendar data is not cloud-authoritative.'
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Enrollment preview failed'
      );
    } finally {
      setBusy(false);
    }
  };

  const enrollDevice = async () => {
    if (
      !context ||
      !workspace?.cloudId ||
      enrollmentPreview?.authority !== 'postgres' ||
      !enrollmentPreview.previewFingerprint ||
      !enrollmentPreview.payloadFingerprint ||
      enrollmentPreview.epoch === undefined ||
      enrollmentPreview.serverVersion === undefined ||
      enrollmentPreview.schemaVersion === undefined
    )
      return;
    const local = await buildCalendarManifest({
      campaignCode: campaign.code,
      rawEnvelope: currentRawEnvelope(),
    });
    if (
      !window.confirm(
        `Enroll this browser from exact cloud preview ${enrollmentPreview.previewFingerprint.slice(0, 12)}? The local candidate is preserved and is never uploaded automatically.`
      )
    )
      return;
    const deviceKey = `rollkeeper:campaign-calendar-device:${context.accountId}:${workspace.cloudId}`;
    const deviceId = localStorage.getItem(deviceKey) ?? crypto.randomUUID();
    localStorage.setItem(deviceKey, deviceId);
    await calendarApi({
      action: 'enroll-device',
      mutationId: crypto.randomUUID(),
      campaignId: workspace.cloudId,
      deviceId,
      expectedEpoch: enrollmentPreview.epoch,
      previewFingerprint: enrollmentPreview.previewFingerprint,
      legacyCandidateFingerprint: local.rawCandidates[0]?.fingerprint ?? null,
    });
    const database = await openRollkeeperDatabase();
    try {
      const next = await enrollCalendarCloudDevice(database, {
        namespace: `user:${context.accountId}`,
        campaignId: workspace.cloudId,
        campaignCode: campaign.code,
        deviceId,
        epoch: enrollmentPreview.epoch,
        confirmed: true,
        previewFingerprint: enrollmentPreview.previewFingerprint,
        payloadFingerprint: enrollmentPreview.payloadFingerprint,
        payload: enrollmentPreview.payload ?? null,
        tombstoned: enrollmentPreview.tombstoned === true,
        schemaVersion: enrollmentPreview.schemaVersion,
        serverVersion: enrollmentPreview.serverVersion,
        localCandidate: local.rawCandidates[0]
          ? {
              rawValue: local.rawCandidates[0].rawValue,
              fingerprint: local.rawCandidates[0].fingerprint,
            }
          : null,
        preserveDivergentCandidate: true,
        now: () => new Date().toISOString(),
      });
      setAuthority(next);
      // The enrolled device holds the cloud document in IndexedDB while the
      // store still shows the local candidate, so autosave stays disarmed
      // until the DM applies the exact cloud generation. The confirm above
      // promises that candidate is never uploaded automatically.
      // The enroll control only renders on a `localStorage` authority, which
      // no arming path leaves behind, so this disarm is belt-and-braces for a
      // flag that is already false.
      setHydrated(false);
      hydrationSignature.current = authorityGeneration(
        context.accountId,
        workspace.cloudId,
        next
      );
      await context.remember(workspace);
      writeCalendarProjectionAuthority(localStorage, campaign.code, {
        version: 1,
        authority: 'postgres',
        epoch: next.epoch,
        campaignId: workspace.cloudId,
        namespace: `user:${context.accountId}`,
      });
      setStatus(
        'Browser explicitly enrolled and hydrated into its isolated IndexedDB namespace.'
      );
    } finally {
      database.close();
    }
  };

  // Rewrites the store from the accepted cloud generation and arms autosave.
  // Enrollment leaves the store on the un-uploaded local candidate, so a
  // device whose IndexedDB already holds the previewed generation is exactly
  // as un-hydrated as one that had to write it: both paths below run this.
  const hydrateFromAcceptedGeneration = (
    payload: CalendarManifest['records'][number]['payload'] | null | undefined,
    fingerprint: string
  ) => {
    lastFingerprint.current = fingerprint;
    if (payload) {
      applyCalendarPayload(campaign.code, payload);
    } else {
      hideCalendar(campaign.code);
    }
    // The store now matches the enrolled generation, so autosave is armed.
    setHydrated(true);
  };

  const applyExactCloudVersion = async () => {
    if (
      !context ||
      !workspace?.cloudId ||
      authority?.authority !== 'postgres' ||
      enrollmentPreview?.authority !== 'postgres' ||
      enrollmentPreview.epoch === undefined ||
      enrollmentPreview.serverVersion === undefined ||
      enrollmentPreview.schemaVersion === undefined ||
      !enrollmentPreview.payloadFingerprint
    )
      return;
    if (enrollmentPreview.epoch !== authority.epoch) {
      setError('Cloud preview epoch does not match this browser authority.');
      return;
    }
    if (
      !window.confirm(
        `Apply exact cloud version ${enrollmentPreview.serverVersion} to this enrolled browser? Unresolved local work blocks hydration.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    const database = await openRollkeeperDatabase();
    try {
      const repository = new IndexedDbCalendarRepository(database);
      const current = await repository.getDocument(
        `user:${context.accountId}`,
        campaign.code
      );
      if (
        current?.baseServerVersion === enrollmentPreview.serverVersion &&
        current.contentFingerprint === enrollmentPreview.payloadFingerprint
      ) {
        // The write below would be a no-op, but the store is still showing
        // the local candidate enrollment left behind, so skip only the write.
        hydrateFromAcceptedGeneration(
          current.payload,
          current.contentFingerprint
        );
        setStatus('This browser already has the exact accepted cloud version.');
        return;
      }
      await repository.applyAcceptedCloudVersion({
        namespace: `user:${context.accountId}`,
        campaignId: workspace.cloudId,
        legacyId: campaign.code,
        cutoverEpoch: enrollmentPreview.epoch,
        serverVersion: enrollmentPreview.serverVersion,
        schemaVersion: enrollmentPreview.schemaVersion,
        payload: enrollmentPreview.payload ?? null,
        payloadFingerprint: enrollmentPreview.payloadFingerprint,
        tombstoned: enrollmentPreview.tombstoned === true,
        acceptedAt: new Date().toISOString(),
      });
      await context.remember(workspace);
      hydrateFromAcceptedGeneration(
        enrollmentPreview.payload,
        enrollmentPreview.payloadFingerprint
      );
      setStatus(
        `Browser hydrated from exact cloud version ${enrollmentPreview.serverVersion}.`
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Cloud hydration failed'
      );
    } finally {
      database.close();
      setBusy(false);
    }
  };

  const loadHistory = async () => {
    if (!workspace?.cloudId) return;
    const result = await calendarApi<{ versions: VersionMetadata[] }>({
      action: 'history',
      campaignId: workspace.cloudId,
      legacyId: campaign.code,
    });
    setVersions(result.versions);
  };

  const exportVersion = async (serverVersion: number) => {
    if (!workspace?.cloudId) return;
    const value = await calendarApi({
      action: 'export-version',
      campaignId: workspace.cloudId,
      legacyId: campaign.code,
      serverVersion,
    });
    downloadJson(`campaign-calendar-v${serverVersion}.json`, value);
  };

  const compareLatestVersions = async () => {
    if (!workspace?.cloudId || versions.length < 2) return;
    const result = await calendarApi<{ identical: boolean }>({
      action: 'compare-versions',
      campaignId: workspace.cloudId,
      legacyId: campaign.code,
      leftVersion: versions[1].serverVersion,
      rightVersion: versions[0].serverVersion,
    });
    setComparison(
      result.identical
        ? 'The selected versions are byte-identical.'
        : 'The selected versions differ. Export each exact version to inspect payloads.'
    );
  };

  const restoreVersion = async (sourceVersion: number) => {
    if (
      !context ||
      !workspace?.cloudId ||
      authority?.authority !== 'postgres' ||
      versions.length === 0
    )
      return;
    if (
      !window.confirm(
        `Restore version ${sourceVersion} as a new higher version? Immutable history will not be changed.`
      )
    )
      return;
    const restored = await calendarApi<{
      serverVersion: number;
      cutoverEpoch: number;
      payloadFingerprint: string;
    }>({
      action: 'restore-version',
      mutationId: crypto.randomUUID(),
      campaignId: workspace.cloudId,
      expectedEpoch: authority.epoch,
      legacyId: campaign.code,
      sourceVersion,
      expectedServerVersion: versions[0].serverVersion,
    });
    const exact = await calendarApi<VersionExport>({
      action: 'export-version',
      campaignId: workspace.cloudId,
      legacyId: campaign.code,
      serverVersion: restored.serverVersion,
    });
    const database = await openRollkeeperDatabase();
    try {
      await new IndexedDbCalendarRepository(database).applyAcceptedCloudVersion(
        {
          namespace: `user:${context.accountId}`,
          campaignId: workspace.cloudId,
          legacyId: campaign.code,
          cutoverEpoch: restored.cutoverEpoch,
          serverVersion: exact.serverVersion,
          schemaVersion: exact.schemaVersion,
          payload: exact.payload,
          payloadFingerprint: exact.payloadFingerprint,
          tombstoned: exact.tombstoned,
          acceptedAt: new Date().toISOString(),
        }
      );
    } finally {
      database.close();
    }
    lastFingerprint.current = exact.payloadFingerprint;
    if (exact.payload) {
      applyCalendarPayload(campaign.code, exact.payload);
    } else {
      hideCalendar(campaign.code);
    }
    // A restore rewrites the store from IndexedDB, so like hydrate,
    // activateLocal, and applyExactCloudVersion it must arm autosave: on an
    // enrolled-but-unapplied device the legacy key is frozen, so a disarmed
    // edit would live only in memory and vanish on reload.
    setHydrated(true);
    setStatus(
      `Cloud: saved as version ${restored.serverVersion} · Player view: pending acknowledgement`
    );
    await loadHistory();
  };

  const rollback = async () => {
    if (!context || !workspace?.cloudId || authority?.authority !== 'postgres')
      return;
    if (
      !window.confirm(
        'Verified rollback creates a new epoch and preserves every Postgres/history/projection source. Continue?'
      )
    )
      return;
    const [current, projection] = await Promise.all([
      calendarApi<EnrollmentPreview>({
        action: 'preview-enrollment',
        campaignId: workspace.cloudId,
      }),
      calendarApi<{ status: string }>({
        action: 'projection-status',
        campaignId: workspace.cloudId,
      }),
    ]);
    if (
      current.authority !== 'postgres' ||
      !current.previewFingerprint ||
      !current.payloadFingerprint ||
      current.serverVersion === undefined ||
      projection.status !== 'current'
    )
      throw new Error(
        'Rollback requires the exact current Postgres generation and a reconciled projection journal.'
      );
    rollbackMutationId.current ??= crypto.randomUUID();
    const result = await calendarApi<{
      epoch: number;
      currentGeneration: EnrollmentPreview;
    }>({
      action: 'rollback',
      mutationId: rollbackMutationId.current,
      campaignId: workspace.cloudId,
      expectedEpoch: authority.epoch,
      manifestFingerprint: current.previewFingerprint,
      currentGeneration: {
        legacyId: current.legacyId,
        fingerprint: current.payloadFingerprint,
        serverVersion: current.serverVersion,
      },
      projectionJournalReconciled: true,
    });
    const database = await openRollkeeperDatabase();
    try {
      const local = await rollbackCalendarLocalAuthority(database, {
        namespace: `user:${context.accountId}`,
        campaignId: workspace.cloudId,
        expectedEpoch: authority.epoch,
        generation: authority.generation,
        confirmed: true,
        currentGenerationVerified: true,
        projectionJournalReconciled: true,
        now: () => new Date().toISOString(),
      });
      setAuthority(local);
    } finally {
      database.close();
    }
    writeCalendarProjectionAuthority(localStorage, campaign.code, {
      version: 1,
      authority: 'legacy_restored',
      epoch: result.epoch,
      campaignId: workspace.cloudId,
      namespace: `user:${context.accountId}`,
    });
    if (result.currentGeneration.payload) {
      applyCalendarPayload(campaign.code, result.currentGeneration.payload);
    }
    setHydrated(false);
    hydrationSignature.current = null;
    rollbackMutationId.current = null;
    setStatus(
      'Rollback accepted through a new epoch; sources were preserved. Reload to use the verified legacy generation.'
    );
  };

  const removeAccountFromDevice = async () => {
    if (
      !context ||
      !workspace?.cloudId ||
      !authority ||
      authority.authority === 'localStorage'
    )
      return;
    if (
      !window.confirm(
        `Remove only ${context.accountLabel}'s local namespace from this browser? Cloud and every preserved source remain intact.`
      )
    )
      return;
    const namespace = `user:${context.accountId}` as const;
    const database = await openRollkeeperDatabase();
    try {
      const repository = new IndexedDbCalendarRepository(database);
      const unresolved = (
        await repository.listOutbox(namespace, workspace.cloudId)
      ).some(
        entry => entry.state !== 'acknowledged' && entry.state !== 'superseded'
      );
      const lossConfirmed =
        !unresolved ||
        window.confirm(
          'Unresolved browser-only work will become inaccessible on this browser. Confirm the described loss risk?'
        );
      if (!lossConfirmed) return;
      if (authority.authority === 'postgres') {
        const deviceId = localStorage.getItem(
          `rollkeeper:campaign-calendar-device:${context.accountId}:${workspace.cloudId}`
        );
        if (!deviceId)
          throw new Error(
            'The exact enrolled browser identity is unavailable.'
          );
        await calendarApi({
          action: 'remove-device',
          mutationId: crypto.randomUUID(),
          campaignId: workspace.cloudId,
          deviceId,
          expectedEpoch: authority.epoch,
        });
      }
      await repository.removeAccountFromDevice(namespace, {
        confirmed: true,
        lossConfirmed,
      });
      hideCalendar(campaign.code);
      hydrationSignature.current = null;
      setScope(null);
      setAuthority(null);
      setHydrated(false);
      setStatus(
        'Only the selected account namespace was hidden; cloud, history, legacy, conflicts, and outboxes were preserved.'
      );
    } finally {
      database.close();
    }
  };

  const loadProjectionStatus = async () => {
    if (!workspace?.cloudId) return;
    const next = await calendarApi<ProjectionStatus>({
      action: 'projection-status',
      campaignId: workspace.cloudId,
    });
    setProjectionStatus(next);
    if (next.failedCount > 0) {
      const result = await calendarApi<{
        incidents: ProjectionIncident[];
      }>({ action: 'projection-incidents', campaignId: workspace.cloudId });
      setProjectionIncidents(result.incidents);
    } else {
      setProjectionIncidents([]);
    }
  };

  const replayProjection = async (eventId: string) => {
    if (!workspace?.cloudId || authority?.authority !== 'postgres') return;
    await calendarApi({
      action: 'replay-projection',
      mutationId: crypto.randomUUID(),
      campaignId: workspace.cloudId,
      expectedEpoch: authority.epoch,
      eventId,
    });
    setStatus('Cloud: saved · Player view: replay queued');
    await loadProjectionStatus();
  };

  if (!areStandaloneMigrationControlsVisible()) return null;

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud size={20} /> Calendar cloud canary
        </CardTitle>
        <CardDescription>
          Default-off owner workflow. Login, navigation, discovery, and first
          use never enroll or change authority.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!context && (
          <Button variant="outline" onClick={discover} loading={busy}>
            Find owner workspaces
          </Button>
        )}
        {context && !workspace && (
          <div className="space-y-2">
            <p className="text-body text-sm">
              Explicitly choose the owner-verified workspace for this local
              campaign.
            </p>
            {workspaces.map(item => (
              <Button
                key={item.localId}
                variant="outline"
                size="sm"
                onClick={() => choose(item)}
              >
                Select {item.name} ({item.displayCode})
              </Button>
            ))}
          </div>
        )}
        {workspace && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              leftIcon={<Database size={16} />}
              onClick={preview}
              loading={busy}
            >
              Preview exact manifest
            </Button>
            <Button
              variant="outline"
              onClick={previewEnrollment}
              loading={busy}
            >
              Preview cloud enrollment
            </Button>
            {enrollmentPreview?.authority === 'postgres' &&
              authority?.authority === 'localStorage' && (
                <Button variant="warning" onClick={enrollDevice}>
                  Enroll this browser
                </Button>
              )}
            {enrollmentPreview?.authority === 'postgres' &&
              authority?.authority === 'postgres' && (
                <Button
                  variant="warning"
                  onClick={applyExactCloudVersion}
                  loading={busy}
                >
                  Apply exact cloud version
                </Button>
              )}
            {manifest && recovery && (
              <Button
                variant="warning"
                leftIcon={<Download size={16} />}
                onClick={downloadRecovery}
              >
                Download recovery file
              </Button>
            )}
            {manifest && recovery && (
              <>
                <Button
                  variant="outline"
                  leftIcon={<Upload size={16} />}
                  onClick={() => recoveryInput.current?.click()}
                  disabled={busy}
                >
                  Verify recovery file and select
                </Button>
                <input
                  ref={recoveryInput}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  aria-label="Downloaded calendar recovery file"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) void verifyRecoveryAndSelect(file);
                  }}
                />
              </>
            )}
            {recovery && (
              <Button
                variant="outline"
                onClick={prepare}
                loading={busy}
                disabled={!recoveryVerified || !calendarSelected}
              >
                Prepare IndexedDB
              </Button>
            )}
            {manifest && authority?.authority === 'localStorage' && (
              <Button
                variant="warning"
                leftIcon={<ShieldCheck size={16} />}
                onClick={activateLocal}
              >
                Confirm local cutover
              </Button>
            )}
            {authority?.authority === 'indexedDB' && (
              <Button variant="primary" onClick={activateCloud} loading={busy}>
                Turn on cloud sync
              </Button>
            )}
            {authority?.authority === 'postgres' && (
              <>
                <Button
                  variant="outline"
                  leftIcon={<History size={16} />}
                  onClick={loadHistory}
                >
                  Version history
                </Button>
                <Button variant="outline" onClick={loadProjectionStatus}>
                  Player-view status
                </Button>
                <Button
                  variant="outline"
                  leftIcon={<RotateCcw size={16} />}
                  onClick={rollback}
                >
                  Verified rollback
                </Button>
                <Button variant="danger" onClick={removeAccountFromDevice}>
                  Remove this account from this browser
                </Button>
              </>
            )}
          </div>
        )}
        {manifest && (
          <div className="bg-surface-secondary rounded-lg p-3 text-sm">
            <p className="text-heading font-medium">
              Manifest {manifest.fingerprint.slice(0, 12)}
            </p>
            <p className="text-body">
              {manifest.recordCount} record · {manifest.totalBytes} bytes ·{' '}
              {manifest.blockers.length} blockers
            </p>
            <p className="text-muted">
              ID: {manifest.records[0]?.legacyId ?? 'unresolved'} · schema{' '}
              {manifest.records[0]?.schemaVersion ?? 'unknown'} ·{' '}
              {manifest.records[0]?.references.length ?? 0} typed references
            </p>
            {manifest.blockers.map(blocker => (
              <p
                role="alert"
                className="text-accent-red-text"
                key={`${blocker.kind}:${blocker.detail}`}
              >
                {/* Uniform with the four multi-record cards. No kind this
                    family emits contains a forbidden word today, so there is
                    no test that reddens without it; the mapping is applied so
                    that a kind added to calendarFamily.ts later cannot leak
                    one into rendered text (spec R17). */}
                {blockerKindReferenceLabel(blocker.kind)}: {blocker.detail}
              </p>
            ))}
          </div>
        )}
        {versions.length > 0 && (
          <div className="space-y-2">
            {versions.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={compareLatestVersions}
              >
                Compare latest versions
              </Button>
            )}
            {comparison && <p className="text-body text-sm">{comparison}</p>}
            {versions.map(version => (
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
                    onClick={() => exportVersion(version.serverVersion)}
                  >
                    Export exact version
                  </Button>
                  {version.serverVersion !== versions[0].serverVersion && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => restoreVersion(version.serverVersion)}
                    >
                      Restore as new version
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {projectionStatus && (
          <div className="bg-surface-secondary rounded-lg p-3 text-sm">
            <p role="status" className="text-body">
              Cloud: saved · Player view: {projectionStatus.status} · freshness
              SLO {projectionStatus.freshnessSloSeconds}s
            </p>
            {projectionIncidents.map(incident => (
              <div
                key={incident.incidentId}
                className="mt-2 flex items-center justify-between gap-2"
              >
                <span className="text-accent-red-text">{incident.kind}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => replayProjection(incident.eventId)}
                >
                  Replay exact version
                </Button>
              </div>
            ))}
          </div>
        )}
        {status && (
          <p role="status" className="text-body text-sm">
            {status}
          </p>
        )}
        {error && (
          <p role="alert" className="text-accent-red-text text-sm">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
