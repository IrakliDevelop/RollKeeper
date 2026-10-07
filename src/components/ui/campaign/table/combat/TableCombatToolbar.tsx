'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/forms/button';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Badge } from '@/components/ui/layout/badge';
import type { TableEncounterRecordV1 } from '@/lib/table/schema';

import type { TableCombatNotice } from './useTableCombat';

const NO_RUN = '__none__';

function runLabel(run: TableEncounterRecordV1, activeRunId: string | null) {
  const label = run.label ?? 'Imported run';
  if (run.runId === activeRunId) return `${label} · running`;
  if (run.isActive) return `${label} · imported active`;
  return label;
}

/**
 * Header controls of the Table combat panel: explicit run selection, new
 * run, history, end, publication status, notices and the visible residuals.
 */
export function TableCombatToolbar(props: {
  campaignCode: string;
  runs: TableEncounterRecordV1[];
  selectedRun: TableEncounterRecordV1 | null;
  activeRunId: string | null;
  running: boolean;
  loggingPaused: boolean;
  publicationLabel: string;
  canPublish: boolean;
  saving: boolean;
  notice: TableCombatNotice | null;
  onSelect: (runId: string) => void;
  onNewRun: () => void;
  onHistory: () => void;
  onEnd: () => void;
  onPublish: () => void;
}) {
  const run = props.selectedRun;
  return (
    <div className="border-divider space-y-2 border-b px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        <SelectField
          wrapperClassName="min-w-0 flex-1 basis-40"
          value={run?.runId ?? NO_RUN}
          onValueChange={value => value !== NO_RUN && props.onSelect(value)}
          triggerProps={{ 'aria-label': 'Scene run', size: 'sm' }}
        >
          <SelectItem value={NO_RUN} disabled>
            No run selected
          </SelectItem>
          {props.runs.map(item => (
            <SelectItem key={item.runId} value={item.runId}>
              {runLabel(item, props.activeRunId)}
            </SelectItem>
          ))}
        </SelectField>
        <Button variant="outline" size="sm" onClick={props.onNewRun}>
          New run
        </Button>
        <Button variant="ghost" size="sm" onClick={props.onHistory}>
          History
        </Button>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge variant="neutral" size="sm">
          Saved on this device
        </Badge>
        <p
          className="text-muted min-w-0 flex-1 text-xs"
          role="status"
          aria-live="polite"
        >
          {props.publicationLabel}
        </p>
        {props.canPublish && (
          <Button variant="outline" size="sm" onClick={props.onPublish}>
            Publish current state
          </Button>
        )}
        {props.running && (
          <Button variant="danger" size="sm" onClick={props.onEnd}>
            End combat
          </Button>
        )}
      </div>
      {run?.sourceEncounterId && (
        <p className="text-muted text-xs">
          Adopted from a library encounter ·{' '}
          <Link
            className="text-accent-blue-text underline"
            href={`/dm/campaign/${encodeURIComponent(props.campaignCode)}/encounters/${encodeURIComponent(run.sourceEncounterId)}`}
          >
            Open library encounter
          </Link>
        </p>
      )}
      {props.loggingPaused && (
        <p className="text-accent-amber-text text-xs">
          Combat log paused (archive full)
        </p>
      )}
      {run && (
        <p className="text-faint text-xs">
          DM condition changes are not sent to player sheets in scene runs
        </p>
      )}
      {(props.saving || props.notice) && (
        <div className="flex flex-wrap items-center gap-2">
          <p
            role="status"
            aria-live="polite"
            className={`min-w-0 flex-1 text-xs ${
              props.notice?.tone === 'error'
                ? 'text-accent-red-text'
                : 'text-muted'
            }`}
          >
            {props.notice?.message ?? 'Saving…'}
          </p>
          {props.notice?.link && (
            <Link
              className="text-accent-blue-text text-xs underline"
              href={props.notice.link.href}
            >
              {props.notice.link.label}
            </Link>
          )}
          {props.notice?.retry && (
            <Button variant="outline" size="sm" onClick={props.notice.retry}>
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
