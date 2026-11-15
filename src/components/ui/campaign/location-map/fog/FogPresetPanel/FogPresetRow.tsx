'use client';

import type { Ref } from 'react';
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
  renameButtonRef,
  deleteButtonRef,
}: {
  preset: FogPresetV1;
  controls: FogPresetControls;
  renaming: boolean;
  onStartRename(): void;
  onStopRename(): void;
  renameButtonRef?: Ref<HTMLButtonElement>;
  deleteButtonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 pointer-coarse:min-h-11">
      {renaming ? (
        <FogPresetRenameForm
          preset={preset}
          controls={controls}
          onDone={onStopRename}
        />
      ) : (
        <>
          <span className="type-ui text-body flex-1">{preset.name}</span>
          <Button
            ref={renameButtonRef}
            variant="secondary"
            size="sm"
            aria-label={`Rename ${preset.name}`}
            onClick={onStartRename}
          >
            Rename
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label={`Duplicate ${preset.name}`}
            onClick={() =>
              controls.setManagerError(controls.duplicatePreset(preset.id))
            }
          >
            Duplicate
          </Button>
          <Button
            ref={deleteButtonRef}
            variant="danger"
            size="sm"
            aria-label={`Delete ${preset.name}`}
            onClick={() => controls.requestDelete(preset.id)}
          >
            Delete
          </Button>
        </>
      )}
    </li>
  );
}
