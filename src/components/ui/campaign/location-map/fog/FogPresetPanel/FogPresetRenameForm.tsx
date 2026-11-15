'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import type { FogPresetControls } from '../useFogPresetControls';
import type { FogPresetV1 } from '@/types/fogMaterial';

/** Mounted only while a row is being renamed, so its local draft/error state
 * resets for free each time editing starts on a (possibly different) row.
 * Takes focus on mount because the Rename button that opened it has just
 * unmounted; `FogPresetManager` moves focus back to that row when it closes. */
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
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  return (
    <>
      <Input
        ref={inputRef}
        aria-label={`New name for ${preset.name}`}
        value={name}
        error={error ?? undefined}
        onChange={event => {
          setName(event.target.value);
          setError(null);
        }}
      />
      <Button
        variant="primary"
        size="sm"
        onClick={() => {
          const nextError = controls.renamePreset(preset.id, name);
          if (nextError) setError(nextError);
          else {
            controls.setManagerError(null);
            onDone();
          }
        }}
      >
        Save name
      </Button>
      <Button variant="ghost" size="sm" onClick={onDone}>
        Cancel
      </Button>
    </>
  );
}
