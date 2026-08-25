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
  discovering: boolean;
  discoveryError: string | null;
  /** Derived from the controller's `accountId !== null` — never fabricated. */
  signedIn: boolean;
  workspace: DmWorkspaceDocument | null;
  onDiscover: () => void;
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
  discovering,
  discoveryError,
  signedIn,
  workspace,
  onDiscover,
}: WorkspaceStepProps) {
  // Derived, not fabricated: before any discovery attempt neither `signedIn`
  // nor `discoveryError` is set, and the row says so honestly rather than
  // claiming readiness that was never checked.
  const signInLabel = discovering
    ? 'Checking sign-in on this browser…'
    : signedIn
      ? 'Signed in on this browser'
      : discoveryError
        ? 'Not signed in on this browser'
        : 'Sign-in not checked yet';
  const signInBadge = discovering
    ? { variant: 'neutral' as const, label: 'Checking…' }
    : signedIn
      ? { variant: 'success' as const, label: 'Ready' }
      : discoveryError
        ? { variant: 'danger' as const, label: 'Not signed in' }
        : { variant: 'neutral' as const, label: 'Not checked' };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted mb-0.5 text-[11px] font-bold tracking-wide uppercase">
            Step 1 of 3 &middot; Account
          </p>
          <h3 className="text-heading text-lg font-semibold">
            Find where this campaign will live
          </h3>
        </div>
        <Badge variant="neutral">Reads only</Badge>
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
        <div className="border-divider flex items-center justify-between gap-3 border-t pt-3">
          <div className="min-w-0">
            <p className="text-heading text-sm font-medium">
              {workspace
                ? `Connected to ${workspace.name}`
                : `No cloud workspace found yet for ${campaignCode}`}
            </p>
            <p className="text-muted mt-0.5 text-xs">
              {workspace
                ? `Campaign data will move into this workspace.`
                : 'Look up your account to find its cloud workspace for this campaign.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw size={14} />}
            onClick={onDiscover}
            loading={discovering}
          >
            Find my campaigns
          </Button>
        </div>
      </div>

      {discoveryError && (
        <p role="alert" className="text-accent-red-text text-sm">
          {discoveryError}
        </p>
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
          Nothing has changed. Looking up your account does not move data,
          change what this browser reads from, or touch your campaign.
        </p>
      </div>
    </section>
  );
}
