'use client';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import type { TableCombatArchiveSummary } from '@/lib/table/combatHistory';

/** One archive: text events, exports and a confirmed delete (closed only). */
export function TableCombatArchiveDetail(props: {
  archive: TableCombatArchiveSummary;
  text: string;
  busy: boolean;
  confirming: boolean;
  onConfirming: (confirming: boolean) => void;
  onExportJson: () => void;
  onExportText: () => void;
  onDelete: () => void;
}) {
  const { archive } = props;
  return (
    <section className="border-divider space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-heading min-w-0 flex-1 text-sm font-medium">
          {`${new Date(archive.startedAt).toLocaleString()} → ${
            archive.endedAt
              ? new Date(archive.endedAt).toLocaleString()
              : 'running'
          }`}
        </p>
        {archive.loggingPaused && (
          <Badge variant="warning" size="sm">
            logging paused
          </Badge>
        )}
      </div>
      <pre className="bg-surface-secondary text-body max-h-64 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
        {props.text || 'No events recorded.'}
      </pre>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={props.onExportJson}>
          Export JSON
        </Button>
        <Button variant="outline" size="sm" onClick={props.onExportText}>
          Export text
        </Button>
        {!archive.active && !props.confirming && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => props.onConfirming(true)}
          >
            Delete archive
          </Button>
        )}
      </div>
      {props.confirming && (
        <div className="border-accent-red-border space-y-2 rounded border p-2">
          <p className="text-accent-red-text text-xs">
            This permanently deletes the archive from this device. Export it
            first if you need a copy.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={props.onExportJson}>
              Export JSON first
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={props.busy}
              onClick={props.onDelete}
            >
              Confirm delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => props.onConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
