'use client';

import { Button } from '@/components/ui/forms/button';
import { FogPresetRenameForm } from './FogPresetRenameForm';
import type { FogPresetControls } from '../useFogPresetControls';
import type { FogPresetV1 } from '@/types/fogMaterial';

export function FogPresetRow({
  preset,
  controls,
  renaming,
  onStartRename,
  onStopRename,
}: {
  preset: FogPresetV1;
  controls: FogPresetControls;
  renaming: boolean;
  onStartRename(): void;
  onStopRename(): void;
}) {
  return (
    <div className="border-divider flex flex-wrap items-center gap-2 rounded-md border p-2">
      {renaming ? (
        <FogPresetRenameForm
          preset={preset}
          controls={controls}
          onDone={onStopRename}
        />
      ) : (
        <>
          <span className="text-body flex-1 text-sm">{preset.name}</span>
          <Button
            variant="ghost"
            className="min-h-[44px] px-3 text-xs"
            aria-label={`Rename ${preset.name}`}
            onClick={onStartRename}
          >
            Rename
          </Button>
          <Button
            variant="ghost"
            className="min-h-[44px] px-3 text-xs"
            aria-label={`Duplicate ${preset.name}`}
            onClick={() => controls.duplicatePreset(preset.id)}
          >
            Duplicate
          </Button>
          <Button
            variant="danger"
            className="min-h-[44px] px-3 text-xs"
            aria-label={`Delete ${preset.name}`}
            onClick={() => controls.requestDelete(preset.id)}
          >
            Delete
          </Button>
        </>
      )}
    </div>
  );
}
