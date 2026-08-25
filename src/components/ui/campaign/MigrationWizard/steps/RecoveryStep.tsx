'use client';

import { useId, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ShieldAlert,
} from 'lucide-react';

import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import type { MigrationRecoveryState } from '../MigrationWizard.types';

/** Ruling R9.2: names the behavioural number instead of a bare literal. */
const FINGERPRINT_DISPLAY_LENGTH = 12;

function shortHash(hash: string | null): string {
  if (!hash) return '';
  return hash.length > FINGERPRINT_DISPLAY_LENGTH
    ? `${hash.slice(0, FINGERPRINT_DISPLAY_LENGTH)}…`
    : hash;
}

interface RecoveryStepProps {
  recovery: MigrationRecoveryState;
  onDownload: () => void;
  onSelectFile: (file: File) => void;
  onEnrich: () => void;
}

const STATUS_BADGE: Record<
  MigrationRecoveryState['status'],
  { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' }
> = {
  pending: { label: 'Needed', variant: 'warning' },
  verified: { label: 'Checked', variant: 'success' },
  resumed: { label: 'Picked back up', variant: 'success' },
  stale: { label: 'Not usable', variant: 'danger' },
};

/**
 * Step 1 (spec R3, R4): one verified `rollkeeper-device-backup` bundle for
 * the whole run. Every family step later in the run reuses this exact
 * receipt — this step never runs a second time within one run.
 */
export function RecoveryStep({
  recovery,
  onDownload,
  onSelectFile,
  onEnrich,
}: RecoveryStepProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const badge = STATUS_BADGE[recovery.status];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted mb-0.5 text-[11px] font-bold tracking-wide uppercase">
            Step 2 of 3 &middot; Backup
          </p>
          <h3 className="text-heading text-lg font-semibold">
            Back up this browser
          </h3>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <p className="text-body text-sm">
        One file covers the whole run &mdash; every data category below reuses
        it. Download it, then pick it back up so we can check it arrived intact.
      </p>

      {recovery.status === 'resumed' && (
        <div
          role="status"
          className="border-accent-emerald-border bg-accent-emerald-bg flex items-start gap-3 rounded-lg border p-4"
        >
          <CheckCircle2
            size={18}
            className="text-accent-emerald-text mt-px shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-accent-emerald-text text-sm font-semibold">
              Your safety copy is ready
            </p>
            <p className="text-accent-emerald-text mt-1 text-sm">
              This browser&apos;s data still matches the safety copy you checked
              earlier, so we picked that run back up instead of asking for
              another download.
            </p>
            <p className="text-accent-emerald-text mt-2 font-mono text-xs break-all">
              {recovery.runId} &middot; verified{' '}
              {recovery.verifiedAt ?? 'earlier'} &middot; manifest{' '}
              {shortHash(recovery.manifestHash)}
            </p>
          </div>
        </div>
      )}

      {recovery.status === 'pending' && (
        <div className="border-divider bg-surface flex flex-col gap-3.5 rounded-lg border p-4">
          {recovery.needsEnrichment && (
            <div className="border-divider bg-surface-secondary flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-body text-sm">
                This browser already has a checked safety copy for this exact
                data, saved before entry-by-entry detail was recorded.
              </p>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<ShieldAlert size={14} />}
                  onClick={onEnrich}
                >
                  Check this browser&apos;s backup
                </Button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-heading text-sm font-medium">
                1 &mdash; Download the file
              </p>
              <p className="text-muted mt-0.5 text-xs">
                {recovery.bundle
                  ? `${recovery.bundle.entries.length} entries · ${recovery.bundle.validation.totalBytes} bytes`
                  : 'Preparing your safety copy…'}
              </p>
            </div>
            <Button
              variant="warning"
              leftIcon={<Download size={16} />}
              onClick={onDownload}
              disabled={!recovery.bundle}
            >
              Download backup
            </Button>
          </div>
          <div className="border-divider flex items-end justify-between gap-3 border-t pt-3.5">
            <div className="min-w-0 flex-1">
              <label
                htmlFor={inputId}
                className="text-heading mb-1.5 block text-sm font-medium"
              >
                2 &mdash; Pick your safety copy file back up
              </label>
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept="application/json,.json"
                className="text-muted border-divider bg-surface-secondary block w-full rounded-lg border-2 border-dashed px-3 py-2 text-sm"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) onSelectFile(file);
                  if (inputRef.current) inputRef.current.value = '';
                }}
              />
            </div>
          </div>
        </div>
      )}

      {recovery.status === 'verified' && (
        <div className="border-accent-emerald-border bg-accent-emerald-bg rounded-lg border p-4">
          <p className="text-accent-emerald-text text-sm font-semibold">
            Checked &mdash; every entry matches
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-2.5">
            <div>
              <p className="text-accent-emerald-text text-[11px] uppercase">
                Entries
              </p>
              <p className="text-accent-emerald-text text-sm font-bold">
                {recovery.entryCount}
              </p>
            </div>
            <div>
              <p className="text-accent-emerald-text text-[11px] uppercase">
                Size
              </p>
              <p className="text-accent-emerald-text text-sm font-bold">
                {recovery.totalBytes} bytes
              </p>
            </div>
            <div>
              <p className="text-accent-emerald-text text-[11px] uppercase">
                Receipt
              </p>
              <p className="text-accent-emerald-text text-sm font-bold">
                {recovery.runId}
              </p>
            </div>
          </div>
        </div>
      )}

      {recovery.status === 'stale' && (
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
              That file does not match this browser
            </p>
            <p className="text-accent-red-text mt-1 text-sm">
              It was saved from different data, so it could not restore this
              browser. Download a fresh one and pick that up instead.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
