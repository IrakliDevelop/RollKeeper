'use client';

import { useState } from 'react';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import {
  combatHistoryExport,
  combatHistoryText,
  listCombatArchives,
} from '@/lib/table/combatHistory';
import type { TableWorkspaceSnapshotV1 } from '@/lib/table/schema';

import { TableCombatArchiveDetail } from './TableCombatArchiveDetail';
import { downloadCombatHistory } from './combatHistoryDownload';

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/gu, '-').slice(0, 80) || 'combat';
}

/**
 * Local scene combat history (D7): list, text view, JSON/text export and a
 * confirmed delete of closed archives (A1: frees capacity, no tombstone).
 */
export function TableCombatHistoryDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: TableWorkspaceSnapshotV1 | null;
  busy: boolean;
  onDelete: (archiveId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const archives = props.snapshot ? listCombatArchives(props.snapshot) : [];
  const current = archives.find(item => item.archiveId === selected) ?? null;
  const text =
    current && props.snapshot
      ? combatHistoryText(props.snapshot, current.archiveId)
      : '';
  const title = (item: (typeof archives)[number]) =>
    `${item.label ?? 'Imported run'} · generation ${item.combatGeneration ?? '—'}`;

  const exportJson = () => {
    if (!current || !props.snapshot) return;
    const payload = combatHistoryExport(props.snapshot, current.archiveId);
    if (!payload) return;
    downloadCombatHistory(
      `${safeName(current.label ?? current.runId)}-${current.combatGeneration ?? 0}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={open => {
        setConfirming(false);
        props.onOpenChange(open);
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Combat history</DialogTitle>
          <DialogDescription>
            Scene fights saved on this device, independent of the encounter
            library.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {archives.length === 0 ? (
            <p className="text-muted text-sm">No scene combat history yet.</p>
          ) : (
            <ul className="space-y-1" aria-label="Archives">
              {archives.map(item => (
                <li key={item.archiveId}>
                  <Button
                    variant={
                      item.archiveId === selected ? 'secondary' : 'ghost'
                    }
                    size="sm"
                    fullWidth
                    className="justify-between text-left"
                    onClick={() => {
                      setSelected(item.archiveId);
                      setConfirming(false);
                    }}
                  >
                    <span className="min-w-0 truncate">{title(item)}</span>
                    <span className="text-muted shrink-0 text-xs">
                      {`${item.sceneName ?? 'Scene'} · ${item.eventCount} events`}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {current && (
            <TableCombatArchiveDetail
              archive={current}
              text={text}
              busy={props.busy}
              confirming={confirming}
              onConfirming={setConfirming}
              onExportJson={exportJson}
              onExportText={() =>
                downloadCombatHistory(
                  `${safeName(current.label ?? current.runId)}-${current.combatGeneration ?? 0}.txt`,
                  text,
                  'text/plain'
                )
              }
              onDelete={() => {
                setConfirming(false);
                setSelected(null);
                props.onDelete(current.archiveId);
              }}
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
