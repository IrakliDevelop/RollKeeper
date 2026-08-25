'use client';

import { useEffect, useId, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Wrench,
} from 'lucide-react';

import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import type {
  DurableFamilyAdapter,
  FamilyConfirmation,
  FamilyManifestHandle,
  MigrationRunContext,
} from '@/lib/durableDm/durableFamilyAdapter';
import type { NormalizedAuthority } from '@/lib/durableDm/familyAuthorityNormalizer';
import type { RegistryEntry } from '@/lib/durableDm/familyRegistry';
import {
  readFamilyPreparedState,
  readFamilySelection,
} from '@/lib/durableDm/familySelectionReader';
import {
  deriveFamilyStepState,
  type FamilyStepState,
} from '@/lib/durableDm/migrationRunState';
import { openRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';
import type { StorageNamespace } from '@/lib/indexeddb/shadowJournal';

import {
  cloudActivationFailureMessage,
  friendlyMigrationMessage,
} from '../migrationCopy';
import type { FamilyRunOutcome } from '../MigrationWizard.types';

/** Ruling R9.2: names the behavioural number instead of a bare literal (matches steps/RecoveryStep.tsx). */
const FINGERPRINT_DISPLAY_LENGTH = 12;

function shortHash(hash: string): string {
  return hash.length > FINGERPRINT_DISPLAY_LENGTH
    ? `${hash.slice(0, FINGERPRINT_DISPLAY_LENGTH)}…`
    : hash;
}

const DEFAULT_AUTHORITY: NormalizedAuthority = {
  state: 'legacy',
  epoch: 0,
  campaignId: null,
  accountId: null,
  rolledBack: false,
};

const STEP_BADGE: Record<
  FamilyStepState,
  { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' }
> = {
  notAvailable: { label: 'Not yet available', variant: 'neutral' },
  legacy: { label: 'Not started', variant: 'neutral' },
  selected: { label: 'Chosen', variant: 'neutral' },
  prepared: { label: 'Copied here', variant: 'neutral' },
  indexedDb: { label: 'In this browser only', variant: 'warning' },
  postgresUnverified: { label: 'Moved', variant: 'success' },
  verified: { label: 'Moved', variant: 'success' },
  blocked: { label: 'Needs attention', variant: 'danger' },
  rolledBack: { label: 'Rolled back', variant: 'warning' },
  inconsistent: { label: 'Needs attention', variant: 'danger' },
};

interface FamilyStepProps {
  entry: RegistryEntry;
  stepNumber: number;
  totalSteps: number;
  enabled: boolean;
  adapter: DurableFamilyAdapter | null;
  context: MigrationRunContext | null;
  authority: NormalizedAuthority | null;
  runRecovery: { runId: string; manifestHash: string };
  onCheckDrift: () => Promise<string | null>;
  onRun: () => Promise<FamilyRunOutcome>;
  onRepair: () => Promise<{ ok: boolean; message: string }>;
  onSkip: () => void;
}

/**
 * Steps 2..N (spec R6, R12, R13; design "one per registered data category").
 * `FamilyStep` and `entry.family` are internal compatibility names only —
 * neither appears in rendered copy. Every state this component renders is
 * derived fresh from `deriveFamilyStepState` each render (never mirrored
 * into a separate FamilyStepState field of its own), fed by this session's
 * best-known `authority` (refreshed by the caller after every action) and
 * this render's freshly-fetched manifest.
 */
export function FamilyStep({
  entry,
  stepNumber,
  totalSteps,
  enabled,
  adapter,
  context,
  authority,
  runRecovery,
  onCheckDrift,
  onRun,
  onRepair,
  onSkip,
}: FamilyStepProps) {
  const inputId = useId();
  const [manifest, setManifest] = useState<FamilyManifestHandle | null>(null);
  const [confirmation, setConfirmation] = useState<FamilyConfirmation | null>(
    null
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<{
    runId: string;
    manifestHash: string;
  } | null>(null);
  const [preparedState, setPreparedState] = useState<string | null>(null);
  const [driftKey, setDriftKey] = useState<string | null>(null);
  const [phrase, setPhrase] = useState('');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<FamilyRunOutcome | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Reset every transient, session-only piece of UI state when the DM moves
  // to a different family. None of it is ever written to storage (spec R11)
  // — it exists only to reflect what THIS session has attempted.
  useEffect(() => {
    setManifest(null);
    setConfirmation(null);
    setLoadError(null);
    setSelection(null);
    setPreparedState(null);
    setDriftKey(null);
    setPhrase('');
    setRunning(false);
    setRunResult(null);
    setRepairing(false);
    setRepairResult(null);
  }, [entry.family]);

  useEffect(() => {
    if (!enabled || !adapter || !context) return;
    let cancelled = false;
    (async () => {
      try {
        const nextManifest = await adapter.previewManifest(context);
        if (cancelled) return;
        setManifest(nextManifest);
        setConfirmation(adapter.confirmation(context, nextManifest));
      } catch (cause) {
        // Final fix wave, F4: `cause.message` used to render verbatim, so a
        // blocked-IndexedDB `DOMException` (or any other platform text)
        // reached the DM as the only explanation next to a data category
        // they were about to move. Routed through the same mapping the
        // report step already used for `verifyCloud`.
        if (!cancelled)
          setLoadError(friendlyMigrationMessage('preview', cause));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on family identity, not the (re-created every render) context/adapter references
  }, [entry.family, enabled, adapter !== null, context !== null]);

  // Coordinator review, Important 3: `selected`/`prepared` are real,
  // persisted evidence -- a selection record matching this run's
  // recovery.runId/manifestHash, and the `migration-state:<scope>` `meta`
  // checkpoint `prepareIndexedDb` writes -- not states this component may
  // invent from its own transient click history. Read fresh whenever the
  // family or its context changes; both reads are read-only.
  useEffect(() => {
    if (!enabled || entry.status !== 'registered' || !context) return;
    let cancelled = false;
    (async () => {
      try {
        const namespace = `user:${context.accountId}` as StorageNamespace;
        const nextSelection = readFamilySelection(
          entry.family,
          window.localStorage,
          namespace,
          context.campaignId
        );
        if (!cancelled) setSelection(nextSelection);
        const database = await openRollkeeperDatabase();
        try {
          const nextPreparedState = await readFamilyPreparedState(
            database,
            namespace,
            entry.family,
            context.campaignId
          );
          if (!cancelled) setPreparedState(nextPreparedState);
        } finally {
          database.close();
        }
      } catch (cause) {
        // Coordinator review round 2, item 6: this effect previously had no
        // error handling at all -- unlike the manifest effect directly
        // above, a rejection from `openRollkeeperDatabase()` or a throw
        // from `readFamilySelection` escaped as an unhandled promise
        // rejection, surfaced no `loadError`, and (when it came from the
        // open call before `database` existed) never had a handle to leak
        // in the first place, but a throw from `readFamilyPreparedState`
        // AFTER a successful open would have. Matches the manifest effect's
        // pattern exactly.
        // Final fix wave, F4: same hazard, same mapping — this is the
        // channel `openRollkeeperDatabase()` rejects on in a private window.
        if (!cancelled)
          setLoadError(friendlyMigrationMessage('browserRecord', cause));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on family identity, not the (re-created every render) context reference
  }, [entry.family, enabled, entry.status, context !== null]);

  // Spec R3: re-checked on entry to this family's step, before any write is
  // even offered. Skipped once a family is already Postgres-authoritative
  // (completed families stay migrated) or already blocked on a marker
  // disagreement (that failure takes precedence).
  useEffect(() => {
    if (
      !enabled ||
      !authority ||
      authority.state === 'postgres' ||
      authority.state === 'inconsistent'
    ) {
      return;
    }
    let cancelled = false;
    (async () => {
      const key = await onCheckDrift();
      if (!cancelled) setDriftKey(key);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCheckDrift is stable per render pass; family identity is what should re-trigger this
  }, [entry.family, enabled, authority?.state]);

  const blockers = manifest?.blockers ?? [];
  const stepState = deriveFamilyStepState({
    entry,
    enabled,
    authority: authority ?? DEFAULT_AUTHORITY,
    selection,
    runRecovery,
    preparedState,
    blockers,
    verification: null,
  });
  const badge = STEP_BADGE[stepState];
  const chosenOrBeyond =
    stepState === 'selected' ||
    stepState === 'prepared' ||
    stepState === 'indexedDb' ||
    stepState === 'postgresUnverified' ||
    stepState === 'verified';
  const preparedOrBeyond =
    stepState === 'prepared' ||
    stepState === 'indexedDb' ||
    stepState === 'postgresUnverified' ||
    stepState === 'verified';

  const phraseMatches = Boolean(
    confirmation &&
      phrase.trim().toLowerCase() ===
        confirmation.requiredPhrase.trim().toLowerCase()
  );

  async function handleMoveToCloud() {
    if (!phraseMatches) return;
    setRunning(true);
    setRunResult(null);
    const result = await onRun();
    setRunning(false);
    setRunResult(result);
    if (result.outcome === 'drift') setDriftKey(result.changedKey);
  }

  async function handleRepair() {
    setRepairing(true);
    const result = await onRepair();
    setRepairing(false);
    setRepairResult(result);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted mb-0.5 text-[11px] font-bold tracking-wide uppercase">
            Step {stepNumber} of {totalSteps} &middot; Data category
          </p>
          <h3 className="text-heading text-lg font-semibold">{entry.label}</h3>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {/* Rendered independent of `stepState`: a successful repair moves
          `authority` straight out of `inconsistent` on the very next
          render, so gating this message to the (now former) inconsistent
          branch would make the success copy invisible the instant it
          becomes true. */}
      {repairResult && (
        <p
          role={repairResult.ok ? 'status' : 'alert'}
          className={
            repairResult.ok
              ? 'text-accent-emerald-text text-sm'
              : 'text-accent-red-text text-sm'
          }
        >
          {repairResult.message}
        </p>
      )}

      {!enabled && (
        <div className="border-divider bg-surface-secondary rounded-lg border p-4">
          <p className="text-body text-sm">
            {entry.label} is not yet available in this wizard.
          </p>
        </div>
      )}

      {enabled && stepState === 'inconsistent' && authority && (
        <div className="border-accent-red-border bg-accent-red-bg flex flex-col gap-3 rounded-lg border p-4">
          <div>
            <p
              role="alert"
              className="text-accent-red-text text-sm font-semibold"
            >
              This browser&apos;s record needs attention
            </p>
            <p className="text-accent-red-text mt-1 text-sm">
              This browser and your account disagree about where{' '}
              {entry.label.toLowerCase()} currently lives. Check this browser to
              see if it can be fixed automatically, or skip this one for now.
            </p>
          </div>
          <div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Wrench size={14} />}
              onClick={() => void handleRepair()}
              loading={repairing}
            >
              Check this browser and fix it
            </Button>
          </div>
        </div>
      )}

      {enabled && stepState !== 'inconsistent' && driftKey && (
        <div
          role="alert"
          className="border-accent-red-border bg-accent-red-bg flex items-start gap-3 rounded-lg border p-4"
        >
          <AlertTriangle
            size={18}
            className="text-accent-red-text mt-px shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="text-accent-red-text text-sm font-semibold">
              This browser&apos;s data changed
            </p>
            <p className="text-accent-red-text mt-1 text-sm">
              {driftKey} changed since your safety copy was checked. Download a
              fresh backup of this browser and check it again before this data
              category can move.
            </p>
          </div>
        </div>
      )}

      {enabled && stepState !== 'inconsistent' && !driftKey && loadError && (
        <p role="alert" className="text-accent-red-text text-sm">
          {loadError}
        </p>
      )}

      {enabled &&
        stepState !== 'inconsistent' &&
        !driftKey &&
        (stepState === 'postgresUnverified' || stepState === 'verified') && (
          <div
            role="status"
            className="border-accent-emerald-border bg-accent-emerald-bg rounded-lg border p-4"
          >
            <p className="text-accent-emerald-text text-sm font-semibold">
              Moved to cloud sync
            </p>
            <p className="text-accent-emerald-text mt-1 text-sm">
              {entry.label} now lives in your account&apos;s cloud workspace.
            </p>
          </div>
        )}

      {enabled &&
        stepState !== 'inconsistent' &&
        !driftKey &&
        stepState !== 'postgresUnverified' &&
        stepState !== 'verified' &&
        manifest && (
          <>
            <div className="border-divider bg-surface rounded-lg border p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Records" value={manifest.recordCount} />
                <Stat label="Size" value={`${manifest.totalBytes} bytes`} />
                <Stat label="Blockers" value={manifest.blockers.length} />
                <Stat
                  label="References"
                  value={manifest.records.reduce(
                    (total, record) => total + record.references.length,
                    0
                  )}
                />
              </div>
              {manifest.blockers.length > 0 && (
                <div
                  role="alert"
                  className="border-accent-amber-border bg-accent-amber-bg mt-3 rounded-lg border p-3"
                >
                  <p className="text-accent-amber-text text-sm font-semibold">
                    Some records need attention before this can move
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {manifest.blockers.map((blocker, index) => (
                      <li
                        key={`${blocker.kind}-${blocker.legacyId ?? index}`}
                        className="text-accent-amber-text text-xs"
                      >
                        {blocker.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <StageChain
              chosen={chosenOrBeyond}
              copiedHere={preparedOrBeyond}
              inThisBrowser={
                authority?.state === 'indexedDB' ||
                authority?.state === 'postgres'
              }
              inCloudSync={authority?.state === 'postgres'}
            />

            {authority?.state === 'indexedDB' && (
              <div
                role="alert"
                className="border-accent-red-border bg-accent-red-bg rounded-lg border p-4"
              >
                <p className="text-accent-red-text text-sm font-semibold">
                  Saved only in this browser
                </p>
                <p className="text-accent-red-text mt-1 text-sm">
                  {/* Final fix wave, F1: `runResult.reason` is an INTERNAL
                      `CloudActivationConflictReason` discriminant and used to
                      render verbatim here (the DM read
                      "cloud-generation-diverged"). It is mapped to product
                      copy at this render boundary, never passed through. */}
                  {runResult?.outcome === 'cloudFailure'
                    ? cloudActivationFailureMessage(runResult.reason)
                    : "This data hasn't moved to cloud sync yet."}
                </p>
              </div>
            )}

            {runResult?.outcome === 'error' && (
              <p role="alert" className="text-accent-red-text text-sm">
                {runResult.message}
              </p>
            )}

            {manifest.blockers.length === 0 && confirmation && (
              <div className="border-divider bg-surface flex flex-col gap-3 rounded-lg border p-4">
                {/* R12: the structured confirmation contract's safety
                    fields, rendered so the DM can see exactly what they are
                    about to confirm -- not only the typed-phrase gate. The
                    fingerprint shown here comes from `confirmation`, the
                    same object `requiredPhrase` below comes from, so it is
                    the fingerprint under confirmation, not a value read
                    independently from `manifest`. */}
                <p className="text-muted text-xs">
                  Confirming {confirmation.familyLabel} for{' '}
                  {confirmation.campaignLabel} &middot; manifest{' '}
                  <span className="font-mono">
                    {shortHash(confirmation.manifestFingerprint)}
                  </span>
                </p>
                <Input
                  id={inputId}
                  label={`Type "${confirmation.requiredPhrase}" to confirm`}
                  value={phrase}
                  onChange={event => setPhrase(event.target.value)}
                  placeholder={confirmation.requiredPhrase}
                  autoComplete="off"
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="warning"
                    onClick={() => void handleMoveToCloud()}
                    disabled={!phraseMatches}
                    loading={running}
                  >
                    Move this data to cloud sync
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onSkip}>
                    Skip this one
                  </Button>
                </div>
              </div>
            )}
            {manifest.blockers.length > 0 && (
              <div>
                <Button variant="ghost" size="sm" onClick={onSkip}>
                  Skip this one
                </Button>
              </div>
            )}
          </>
        )}

      {enabled && stepState === 'inconsistent' && (
        <div>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip this one
          </Button>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-muted text-[11px] uppercase">{label}</p>
      <p className="text-heading text-sm font-bold">{value}</p>
    </div>
  );
}

function StageChain({
  chosen,
  copiedHere,
  inThisBrowser,
  inCloudSync,
}: {
  /** `stepState` at or beyond `selected` -- a real, persisted selection record matches this run (spec R6). */
  chosen: boolean;
  /** `stepState` at or beyond `prepared` -- the persisted `CUTOVER_READY` checkpoint (spec R6). */
  copiedHere: boolean;
  inThisBrowser: boolean;
  inCloudSync: boolean;
}) {
  const stages: { label: string; done: boolean }[] = [
    { label: 'Chosen', done: chosen },
    { label: 'Copied here', done: copiedHere },
    { label: 'This browser', done: inThisBrowser },
    { label: 'Cloud sync', done: inCloudSync },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stages.map(stage => {
        const Icon = stage.done ? CheckCircle2 : CircleDashed;
        return (
          <div
            key={stage.label}
            className="border-divider bg-surface flex items-center gap-2 rounded-lg border px-3 py-2"
          >
            <Icon
              size={14}
              className={stage.done ? 'text-accent-emerald-text' : 'text-faint'}
              aria-hidden="true"
            />
            <span className="text-body text-xs">{stage.label}</span>
          </div>
        );
      })}
    </div>
  );
}
