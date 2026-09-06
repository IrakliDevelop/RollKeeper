'use client';

import { Button } from '@/components/ui/forms/button';
import type { FogPresetControls } from '../useFogPresetControls';

export function FogPresetSelector({
  controls,
}: {
  controls: FogPresetControls;
}) {
  const { library, selectedValue, appliedLabel } = controls;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-muted flex items-center gap-2 text-xs font-semibold">
        Appearance
        <select
          aria-label="Fog appearance"
          value={selectedValue}
          onChange={event => controls.select(event.target.value)}
          className="border-divider bg-surface text-body min-h-[44px] rounded-md border px-2 text-xs"
        >
          <option value="solid">Solid (classic)</option>
          <option value="cloudy">Cloudy</option>
          {library.map(preset => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
          {selectedValue === 'custom' && (
            <option value="custom">{appliedLabel ?? 'Custom'}</option>
          )}
        </select>
      </label>
      <Button
        variant="ghost"
        onClick={controls.openEditor}
        className="min-h-[44px] px-3 text-xs"
      >
        Customize fog
      </Button>
      <Button
        variant="ghost"
        onClick={controls.openManager}
        className="min-h-[44px] px-3 text-xs"
      >
        Manage fog presets
      </Button>
    </div>
  );
}
