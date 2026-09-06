'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import type { FogPresetControls } from '../useFogPresetControls';
import type { FogPresetV1 } from '@/types/fogMaterial';

/** Mounted only while a row is being renamed, so its local draft/error state
 * resets for free each time editing starts on a (possibly different) row. */
export function FogPresetRenameForm({
  preset,
  controls,
  onDone,
}: {
  preset: FogPresetV1;
  controls: FogPresetControls;
  onDone(): void;
}) {
  const [name, setName] = useState(preset.name);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Input
        aria-label={`New name for ${preset.name}`}
        value={name}
        error={error ?? undefined}
        onChange={event => {
          setName(event.target.value);
          setError(null);
        }}
        className="min-h-[44px]"
      />
      <Button
        variant="primary"
        className="min-h-[44px] px-3 text-xs"
        onClick={() => {
          const nextError = controls.renamePreset(preset.id, name);
          if (nextError) setError(nextError);
          else onDone();
        }}
      >
        Save name
      </Button>
      <Button
        variant="ghost"
        className="min-h-[44px] px-3 text-xs"
        onClick={onDone}
      >
        Cancel
      </Button>
    </>
  );
}
