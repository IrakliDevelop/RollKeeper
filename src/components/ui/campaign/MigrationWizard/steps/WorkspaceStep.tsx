'use client';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';

interface WorkspaceStepProps {
  campaignCode: string;
  /**
   * The campaign's own name, as the DM dashboard knows it — the dashboard's
   * fork button is named after it, not after the code (re-review N3).
   * `null` when this browser's campaign roster has no entry for
   * `campaignCode`: the dashboard then renders no fork button for it
   * either, so the guidance names only the create control.
   */
  campaignName: string | null;
  discovering: boolean;
  discoveryError: string | null;
  /** Derived from the controller's `accountId !== null` — never fabricated. */
  signedIn: boolean;
  workspace: DmWorkspaceDocument | null;
  onDiscover: () => void;
  creatingWorkspace?: boolean;
  workspaceCreationError?: string | null;
  onCreateWorkspace?: () => void;
}

/**
 * Step 0 (spec R2a): read-only owner-workspace discovery. Nothing here ever
 * writes — no selection record, no marker, no pointer. `onDiscover` calls the
 * wizard's own `discover()`, which only ever calls
 * `BrowserDmWorkspaceContext.list()` (and, on failure to discover a signed-in
 * context, nothing at all).
 */
export function WorkspaceStep({
  campaignCode,
  campaignName,
  discovering,
  discoveryError,
  signedIn,
  workspace,
  onDiscover,
  creatingWorkspace = false,
  workspaceCreationError = null,
  onCreateWorkspace = () => {},
}: WorkspaceStepProps) {
  // Derived, not fabricated: before any discovery attempt neither `signedIn`
  // nor `discoveryError` is set, and the row says so honestly rather than
  // claiming readiness that was never checked.
  const signInLabel = discovering
    ? 'Checking your account...'
    : signedIn
      ? 'Signed in'
      : discoveryError
        ? 'Not signed in'
        : 'Sign-in not checked yet';
  // Final fix wave, gate defect D3: the wizard dead-ended for a DM whose
  // account has no cloud workspace for this campaign. Step 1 said "No cloud
  // workspace found yet" and offered only "Find my campaigns", which finds
  // nothing again -- with no explanation and no route to the action that
  // actually creates one. This is what tells the two states apart: a lookup
  // that has NOT run yet (nothing to explain) versus one that ran, found the
  // signed-in owner, and genuinely has no workspace for this campaign.
  const searchedAndFoundNothing =
    signedIn && !workspace && !discovering && !discoveryError;
  const signInBadge = discovering
    ? { variant: 'neutral' as const, label: 'Checking...' }
    : signedIn
      ? { variant: 'success' as const, label: 'Ready' }
      : discoveryError
        ? { variant: 'danger' as const, label: 'Not signed in' }
        : { variant: 'neutral' as const, label: 'Not checked' };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-muted mb-0.5 text-[11px] font-bold tracking-wide uppercase">
            Step 1 of 3: Account
          </p>
          <h3 className="text-heading text-lg font-semibold">
            Connect your campaign
          </h3>
        </div>
        <Badge variant="neutral" className="self-start">
          No changes yet
        </Badge>
      </div>

      <div className="border-divider bg-surface flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {signedIn ? (
              <CheckCircle2
                size={18}
                className="text-accent-emerald-text shrink-0"
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle
                size={18}
                className="text-muted shrink-0"
                aria-hidden="true"
              />
            )}
            <span className="text-heading text-sm font-medium">
              {signInLabel}
            </span>
          </div>
          <Badge variant={signInBadge.variant}>{signInBadge.label}</Badge>
        </div>
        <div className="border-divider flex flex-col items-stretch gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-heading text-sm font-medium">
              {workspace
                ? `Connected to ${workspace.name}`
                : `Online backup is not set up for ${campaignCode}`}
            </p>
            <p className="text-muted mt-0.5 text-xs">
              {workspace
                ? 'This campaign is ready for online backup.'
                : searchedAndFoundNothing
                  ? 'Set it up here, then continue with one backup for the whole campaign.'
                  : 'Check your account for an existing online copy of this campaign.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw size={14} />}
            onClick={onDiscover}
            loading={discovering}
            className="w-full sm:w-auto"
          >
            Check my account
          </Button>
        </div>
      </div>

      {discoveryError && (
        <p role="alert" className="text-accent-red-text text-sm">
          {discoveryError}
        </p>
      )}

      {searchedAndFoundNothing && (
        <div
          role="alert"
          className="border-accent-amber-border bg-accent-amber-bg flex flex-col gap-3 rounded-lg border p-4"
        >
          <div>
            <p className="text-accent-amber-text text-sm font-semibold">
              Set up online backup
            </p>
            <p className="text-accent-amber-text mt-1 text-sm">
              Create a private online copy for{' '}
              {campaignName ? <strong>{campaignName}</strong> : 'this campaign'}
              . Your current campaign stays available while RollKeeper copies
              each section, and players are not affected.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={onCreateWorkspace}
            loading={creatingWorkspace}
          >
            Set up online backup
          </Button>
          {workspaceCreationError && (
            <p role="alert" className="text-accent-red-text text-sm">
              {workspaceCreationError}
            </p>
          )}
        </div>
      )}

      <div
        role="status"
        className="border-accent-emerald-border bg-accent-emerald-bg flex items-start gap-2.5 rounded-lg border px-3.5 py-3"
      >
        <ShieldCheck
          size={16}
          className="text-accent-emerald-text mt-px shrink-0"
          aria-hidden="true"
        />
        <p className="text-accent-emerald-text text-sm">
          Nothing changes until you confirm a campaign section. Your browser
          copy stays available throughout setup.
        </p>
      </div>
    </section>
  );
}
