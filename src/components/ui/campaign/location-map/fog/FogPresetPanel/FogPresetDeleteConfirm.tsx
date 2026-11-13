'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/forms/button';

/** Inline confirm under the preset list. Takes focus on mount so the keyboard
 * lands on the safe choice; `FogPresetManager` moves focus back out when it
 * closes. */
export function FogPresetDeleteConfirm({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm(): void;
  onCancel(): void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => keepRef.current?.focus(), []);

  return (
    <div
      role="alertdialog"
      aria-label="Delete fog preset"
      className="border-divider mt-2 flex flex-wrap items-center gap-2 border-t pt-3"
    >
      <div className="min-w-56 flex-1">
        <p className="type-ui text-heading">Delete &ldquo;{name}&rdquo;?</p>
        <p className="type-small text-muted">
          Maps already using this preset keep their current appearance.
        </p>
      </div>
      <Button variant="danger-solid" size="sm" onClick={onConfirm}>
        Delete preset
      </Button>
      <Button ref={keepRef} variant="secondary" size="sm" onClick={onCancel}>
        Keep preset
      </Button>
    </div>
  );
}
