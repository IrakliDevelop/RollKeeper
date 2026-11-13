'use client';

import { Button } from '@/components/ui/forms/button';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { OptionLabel } from '../../ToolOptionControls';
import type { FogPresetControls } from '../useFogPresetControls';

export function FogPresetSelector({
  controls,
}: {
  controls: FogPresetControls;
}) {
  const { library, selectedValue, appliedLabel } = controls;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <OptionLabel>Appearance</OptionLabel>
      <SelectField
        wrapperClassName="w-auto"
        value={selectedValue}
        onValueChange={controls.select}
        triggerProps={{
          'aria-label': 'Fog appearance',
          size: 'sm',
          className: 'min-w-44',
        }}
      >
        <SelectItem value="solid">Solid (classic)</SelectItem>
        <SelectItem value="cloudy">Cloudy</SelectItem>
        {library.map(preset => (
          <SelectItem key={preset.id} value={preset.id}>
            {preset.name}
          </SelectItem>
        ))}
        {selectedValue === 'custom' && (
          <SelectItem value="custom">{appliedLabel ?? 'Custom'}</SelectItem>
        )}
      </SelectField>
      <Button variant="ghost" size="sm" onClick={controls.openEditor}>
        Customize fog
      </Button>
      <Button variant="ghost" size="sm" onClick={controls.openManager}>
        Manage fog presets
      </Button>
    </div>
  );
}
