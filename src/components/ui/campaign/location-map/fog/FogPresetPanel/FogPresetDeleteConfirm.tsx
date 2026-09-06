'use client';

import { Button } from '@/components/ui/forms/button';
import type { FogPresetControls } from '../useFogPresetControls';

export function FogPresetDeleteConfirm({
  name,
  controls,
}: {
  name: string;
  controls: FogPresetControls;
}) {
  return (
    <div
      role="alertdialog"
      aria-label="Delete fog preset"
      className="bg-surface-raised flex flex-wrap items-center gap-2 rounded-md p-2"
    >
      <div className="min-w-56 flex-1 text-xs">
        <div className="text-body font-semibold">
          Delete &ldquo;{name}&rdquo;?
        </div>
        <div className="text-muted">
          Maps already using this preset keep their current appearance.
        </div>
      </div>
      <Button
        variant="danger"
        className="min-h-[44px] px-3 text-xs"
        onClick={controls.confirmDelete}
      >
        Delete preset
      </Button>
      <Button
        variant="ghost"
        className="min-h-[44px] px-3 text-xs"
        onClick={controls.cancelDelete}
      >
        Keep preset
      </Button>
    </div>
  );
}
