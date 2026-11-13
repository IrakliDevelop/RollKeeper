'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { FogPresetDeleteConfirm } from './FogPresetDeleteConfirm';
import { FogPresetRow } from './FogPresetRow';
import type { FogPresetControls } from '../useFogPresetControls';

type DeleteIntent = 'confirm' | 'cancel' | null;

function trackButton(
  refs: Map<string, HTMLButtonElement>,
  id: string
): (node: HTMLButtonElement | null) => void {
  return node => {
    if (node) refs.set(id, node);
    else refs.delete(id);
  };
}

export function FogPresetManager({
  controls,
}: {
  controls: FogPresetControls;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const { library, pendingDeleteId } = controls;

  // The confirm block owns focus while it is open; when it closes, its
  // buttons unmount, so put focus somewhere useful. The intent is recorded
  // here because the store write and clearing `pendingDeleteId` are separate
  // updates, so the library cannot tell a confirm from a cancel.
  const intentRef = useRef<DeleteIntent>(null);
  const previousPendingRef = useRef<string | null>(null);
  const renameRefs = useRef(new Map<string, HTMLButtonElement>());
  const deleteRefs = useRef(new Map<string, HTMLButtonElement>());
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = previousPendingRef.current;
    previousPendingRef.current = pendingDeleteId;
    if (previous === null || pendingDeleteId !== null) return;
    const intent = intentRef.current;
    intentRef.current = null;
    if (intent === 'cancel') {
      deleteRefs.current.get(previous)?.focus();
    } else if (intent === 'confirm') {
      // Skip the deleted id in case the library has not caught up yet.
      const next = library.find(preset => preset.id !== previous);
      const nextRename = next ? renameRefs.current.get(next.id) : undefined;
      (nextRename ?? contentRef.current)?.focus();
    }
  }, [pendingDeleteId, library]);

  if (!controls.managerOpen) return null;
  const pending = library.find(p => p.id === pendingDeleteId) ?? null;

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) controls.closeManager();
      }}
    >
      <DialogContent ref={contentRef} aria-label="Fog presets">
        <DialogHeader>
          <DialogTitle>Fog presets</DialogTitle>
          <DialogDescription>
            Editing or deleting a preset never changes maps that already use it.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2">
          {library.length === 0 ? (
            <p className="type-small text-muted">
              No custom presets yet. Use Customize fog, then Save as new preset.
            </p>
          ) : (
            <ul className="divide-divider divide-y">
              {library.map(preset => (
                <FogPresetRow
                  key={preset.id}
                  preset={preset}
                  controls={controls}
                  renaming={renamingId === preset.id}
                  onStartRename={() => setRenamingId(preset.id)}
                  onStopRename={() => setRenamingId(null)}
                  renameButtonRef={trackButton(renameRefs.current, preset.id)}
                  deleteButtonRef={trackButton(deleteRefs.current, preset.id)}
                />
              ))}
            </ul>
          )}
          {controls.managerError && (
            <p role="alert" className="type-small text-blood-text">
              {controls.managerError}
            </p>
          )}
          {pending && (
            <FogPresetDeleteConfirm
              key={pending.id}
              name={pending.name}
              onConfirm={() => {
                intentRef.current = 'confirm';
                controls.confirmDelete();
              }}
              onCancel={() => {
                intentRef.current = 'cancel';
                controls.cancelDelete();
              }}
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
