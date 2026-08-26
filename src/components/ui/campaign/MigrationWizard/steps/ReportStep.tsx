'use client';

import { Loader2, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import type {
  DurableFamilyAdapter,
  DurableFamilyName,
  FamilyVerification,
} from '@/lib/durableDm/durableFamilyAdapter';
import type { NormalizedAuthority } from '@/lib/durableDm/familyAuthorityNormalizer';
import {
  DURABLE_FAMILY_REGISTRY,
  type RegistryEntry,
} from '@/lib/durableDm/familyRegistry';

type ReportBadgeState =
  | 'notAvailable'
  | 'turnedOff'
  | 'notStarted'
  | 'notVerified'
  | 'verified';

const REPORT_BADGE: Record<
  ReportBadgeState,
  { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' }
> = {
  notAvailable: { label: 'Not yet available', variant: 'neutral' },
  turnedOff: { label: 'Turned off', variant: 'neutral' },
  notStarted: { label: 'Not moved yet', variant: 'neutral' },
  notVerified: { label: 'Not verified', variant: 'danger' },
  verified: { label: 'Verified', variant: 'success' },
};

interface ReportStepProps {
  stepNumber: number;
  totalSteps: number;
  /** Last-observed authority per family (spec R6) — used only to tell "never moved" from "moved but not (yet) verified". */
  familyAuthorities: Partial<Record<DurableFamilyName, NormalizedAuthority>>;
  /** This render's live verification results (spec R14: ephemeral, never persisted). */
  verifications: Partial<Record<DurableFamilyName, FamilyVerification>>;
  /**
   * Which currently-enabled family's `verifyCloud` call REJECTED on the
   * most recent batch, and why (Task 16 fix round 1, CRITICAL item 1) — a
   * family missing from `verifications` because its check genuinely FAILED
   * (IndexedDB unavailable, a network error, ...) rather than because it
   * was never routed or was disabled. Rendered as a `role="alert"` so the
   * DM is told the check could not run, rather than reading silence as
   * "still whatever it showed last time".
   */
  verificationErrors: Partial<Record<DurableFamilyName, string>>;
  verifying: boolean;
  /**
   * Legacy keys NOT owned by any currently-migrated family whose bytes no
   * longer match the run's one verified bundle (spec R8's sixth condition).
   * A non-empty list blocks EVERY family's "verified" badge, not only the
   * family that happens to own the changed key -- unrelated drift threatens
   * confidence in the whole browser's data, not one category.
   */
  crossFamilyDrift: string[];
  adapterFor: (family: DurableFamilyName) => DurableFamilyAdapter | null;
  onRefresh: () => void;
}

/**
 * Step 8 -- Result (spec R8, R13, R14). Verification is driven entirely by
 * the caller (`MigrationWizard.hooks.ts`'s `verifyReport`, on entry and on
 * Refresh); this component only renders whatever it is handed and never
 * calls `verifyCloud` itself. `verifications`/`crossFamilyDrift` are never
 * mirrored into local state here -- there is nothing for this component to
 * persist (R14).
 */
export function ReportStep({
  stepNumber,
  totalSteps,
  familyAuthorities,
  verifications,
  verificationErrors,
  verifying,
  crossFamilyDrift,
  adapterFor,
  onRefresh,
}: ReportStepProps) {
  const registeredEntries = DURABLE_FAMILY_REGISTRY.filter(
    (entry): entry is Extract<RegistryEntry, { status: 'registered' }> =>
      entry.status === 'registered'
  );
  const erroredEntries = registeredEntries.filter(
    entry => verificationErrors[entry.family] !== undefined
  );
  const plannedEntries = DURABLE_FAMILY_REGISTRY.filter(
    entry => entry.status === 'planned'
  );

  const crossFamilyOk = crossFamilyDrift.length === 0;

  function isEnabled(family: DurableFamilyName): boolean {
    return adapterFor(family)?.isVisible() === true;
  }

  // R8's sixth condition is global, not per-family: unrelated drift blocks
  // every family's verified claim, not only the family that happens to own
  // the changed key.
  function isVerified(family: DurableFamilyName): boolean {
    return verifications[family]?.verified === true && crossFamilyOk;
  }

  function badgeStateFor(entry: RegistryEntry): ReportBadgeState {
    if (entry.status === 'planned') return 'notAvailable';
    if (!isEnabled(entry.family)) return 'turnedOff';
    const authority = familyAuthorities[entry.family];
    const routed =
      authority?.state === 'indexedDB' || authority?.state === 'postgres';
    if (!routed) return 'notStarted';
    return isVerified(entry.family) ? 'verified' : 'notVerified';
  }

  const enabledEntries = registeredEntries.filter(entry =>
    isEnabled(entry.family)
  );
  const disabledEntries = registeredEntries.filter(
    entry => !isEnabled(entry.family)
  );
  const verifiedCount = registeredEntries.filter(entry =>
    isVerified(entry.family)
  ).length;
  const unverifiedEnabledEntries = enabledEntries.filter(
    entry => !isVerified(entry.family)
  );
  // Rendering only: a family whose check genuinely ERRORED gets its own,
  // more specific alert below rather than being restated in the generic
  // "not yet confirmed" list. `unverifiedEnabledEntries` itself (used for
  // the claim computation above) is untouched -- an errored family still
  // correctly blocks "All"/"Available".
  const unverifiedWithoutErrorEntries = unverifiedEnabledEntries.filter(
    entry => verificationErrors[entry.family] === undefined
  );
  // R13: "Available campaign data is synced" requires at least one enabled
  // family -- an empty enabled set (everything turned off) is not a
  // completion claim, it is the `partial` default below.
  const allEnabledVerified =
    enabledEntries.length > 0 && unverifiedEnabledEntries.length === 0;
  const allRegisteredEnabled = disabledEntries.length === 0;

  const claim: 'all' | 'available' | 'partial' = allEnabledVerified
    ? allRegisteredEnabled
      ? 'all'
      : 'available'
    : 'partial';

  return (
    <section
      className="flex flex-col gap-4"
      data-testid="migration-report"
      aria-label="Result"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-muted mb-0.5 text-[11px] font-bold tracking-wide uppercase">
            Step {stepNumber} of {totalSteps}: Result
          </p>
          <h3 className="text-heading text-lg font-semibold">
            Online backup summary
          </h3>
        </div>
        {/* Deliberately never passes `loading` -- `Button`'s `loading` prop
            ALSO disables the control, which would make a second Refresh
            unreachable while an earlier verification is still in flight.
            Spec R14 requires exactly that to be possible (a fresh request
            must be able to supersede a slow one). A visible, non-disabling
            busy state is given instead: the same spinner `Button` itself
            uses for `loading` (`Loader2` + `animate-spin`), swapped in for
            the icon while `verifying` is true, plus `aria-busy` for
            assistive tech -- so a sighted DM sees the check is running
            without losing the ability to click Refresh again. */}
        <Button
          variant="outline"
          size="sm"
          leftIcon={
            verifying ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw size={14} />
            )
          }
          onClick={onRefresh}
          aria-busy={verifying}
        >
          Refresh
        </Button>
      </div>

      <div
        role="status"
        data-testid="report-claim"
        className="border-divider bg-surface rounded-lg border p-4"
      >
        <p className="text-heading text-sm font-semibold">
          {verifiedCount} of {registeredEntries.length} campaign sections backed
          up
        </p>
        <p className="text-body mt-1 text-sm">
          {claim === 'all' && 'Your campaign backup is complete.'}
          {claim === 'available' &&
            'Everything currently available is backed up.'}
          {claim === 'partial' && 'Not finished yet.'}
        </p>
      </div>

      {disabledEntries.length > 0 && (
        <div
          role="status"
          data-testid="disabled-categories-status"
          className="border-accent-amber-border bg-accent-amber-bg rounded-lg border p-4"
        >
          <p className="text-accent-amber-text text-sm font-semibold">
            Turned off in this browser
          </p>
          <ul className="mt-1 list-disc pl-5">
            {disabledEntries.map(entry => (
              <li key={entry.family} className="text-accent-amber-text text-xs">
                {entry.label} is not available for online backup in this browser
                yet.
              </li>
            ))}
          </ul>
        </div>
      )}

      {erroredEntries.length > 0 && (
        <div
          role="alert"
          data-testid="verification-error-alert"
          className="border-accent-red-border bg-accent-red-bg rounded-lg border p-4"
        >
          <p className="text-accent-red-text text-sm font-semibold">
            Could not check online backup
          </p>
          {/* Static, mapping-independent reassurance -- kept OUT of the
              per-family list items below so each `<li>` renders ONLY the
              mapped, R17-clean message `reportFriendlyVerificationError`
              actually returned. A hardcoded phrase duplicated into every
              `<li>` regardless of that mapping's outcome would make a test
              asserting on the fallback text vacuous -- it would pass even
              if the mapping function were gutted. */}
          <p className="text-accent-red-text mt-1 text-xs">
            Nothing was changed. Try Refresh again.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {erroredEntries.map(entry => (
              <li key={entry.family} className="text-accent-red-text text-xs">
                {entry.label}: {verificationErrors[entry.family]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {unverifiedWithoutErrorEntries.length > 0 && (
        <div
          role="alert"
          data-testid="unverified-categories-alert"
          className="border-accent-red-border bg-accent-red-bg rounded-lg border p-4"
        >
          <p className="text-accent-red-text text-sm font-semibold">
            Online backup is not finished
          </p>
          <ul className="mt-1 list-disc pl-5">
            {unverifiedWithoutErrorEntries.map(entry => (
              <li key={entry.family} className="text-accent-red-text text-xs">
                {entry.label} still needs attention. Try Refresh, or return to
                that step and try again.
              </li>
            ))}
          </ul>
        </div>
      )}

      {crossFamilyDrift.length > 0 && (
        <div
          role="alert"
          data-testid="cross-family-drift-alert"
          className="border-accent-red-border bg-accent-red-bg rounded-lg border p-4"
        >
          <p className="text-accent-red-text text-sm font-semibold">
            Your campaign changed during setup
          </p>
          <p className="text-accent-red-text mt-1 text-xs">
            Close this setup and start again so the safety copy includes your
            latest changes.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {registeredEntries.map(entry => {
          const badge = REPORT_BADGE[badgeStateFor(entry)];
          return (
            <div
              key={entry.family}
              className="border-divider bg-surface flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <span className="text-body text-sm">{entry.label}</span>
              <Badge
                variant={badge.variant}
                data-testid={`${entry.family}-status`}
              >
                {badge.label}
              </Badge>
            </div>
          );
        })}
        {plannedEntries.map(entry => (
          <div
            key={entry.family}
            className="border-divider bg-surface-secondary flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
            data-testid={`${entry.family}-status`}
          >
            <p className="text-faint text-sm">
              {entry.label}: not yet available
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
