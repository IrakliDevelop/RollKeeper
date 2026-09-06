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
import { FogPresetDeleteConfirm } from './FogPresetDeleteConfirm';
import { FogPresetRow } from './FogPresetRow';
import type { FogPresetControls } from '../useFogPresetControls';

export function FogPresetManager({
  controls,
}: {
  controls: FogPresetControls;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  if (!controls.managerOpen) return null;
  const pending =
    controls.library.find(p => p.id === controls.pendingDeleteId) ?? null;

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) controls.closeManager();
      }}
    >
      <DialogContent aria-label="Fog presets">
        <DialogHeader>
          <DialogTitle>Fog presets</DialogTitle>
          <DialogDescription>
            Editing or deleting a preset never changes maps that already use it.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2">
          {controls.library.length === 0 && (
            <p className="text-muted text-xs">
              No custom presets yet. Use Customize fog, then Save as new preset.
            </p>
          )}
          {controls.library.map(preset => (
            <FogPresetRow
              key={preset.id}
              preset={preset}
              controls={controls}
              renaming={renamingId === preset.id}
              onStartRename={() => setRenamingId(preset.id)}
              onStopRename={() => setRenamingId(null)}
            />
          ))}
          {controls.managerError && (
            <p role="alert" className="text-accent-red-text text-sm">
              {controls.managerError}
            </p>
          )}
          {pending && (
            <FogPresetDeleteConfirm name={pending.name} controls={controls} />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
