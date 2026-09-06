'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { NumberField } from '@/components/ui/forms/NumberInput';
import type { FogPresetControls } from '../useFogPresetControls';
import { FOG_MATERIAL_BOUNDS, normalizeHexColor } from '@/lib/fogMaterial';
import type { CustomProceduralFogMaterialV1 } from '@/types/fogMaterial';

/** A text field that only commits a hex color once it is a full `#rrggbb`
 * value, so partial typing never flashes an invalid preview. */
export function HexField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit(hex: string): void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => {
    setText(value);
  }, [value]);
  return (
    <Input
      label={label}
      aria-label={label}
      value={text}
      onChange={event => {
        setText(event.target.value);
        const hex = normalizeHexColor(event.target.value);
        if (hex) onCommit(hex);
      }}
      className="min-h-[44px] font-mono"
      maxLength={7}
    />
  );
}

/** Fields shown only while the draft's noise texture is enabled: base/noise
 * colors, noise amount/size sliders, and the advanced detail/seed controls. */
export function FogProceduralFields({
  controls,
  draft,
}: {
  controls: FogPresetControls;
  draft: CustomProceduralFogMaterialV1;
}) {
  const b = FOG_MATERIAL_BOUNDS;
  return (
    <>
      <HexField
        key="base"
        label="Fog color"
        value={draft.baseColor}
        onCommit={baseColor => controls.updateDraft({ baseColor })}
      />
      <HexField
        key="noise"
        label="Noise color"
        value={draft.noiseColor}
        onCommit={noiseColor => controls.updateDraft({ noiseColor })}
      />
      <label className="text-body flex flex-col gap-1 text-xs">
        Noise amount
        <input
          type="range"
          aria-label="Noise amount"
          min={b.noiseOpacity.min}
          max={b.noiseOpacity.max}
          step={0.01}
          value={draft.noiseOpacity}
          onChange={event =>
            controls.updateDraft({ noiseOpacity: Number(event.target.value) })
          }
          className="min-h-[44px]"
        />
      </label>
      <label className="text-body flex flex-col gap-1 text-xs">
        Noise size (Fine to Broad)
        <input
          type="range"
          aria-label="Noise size"
          min={b.scale.min}
          max={b.scale.max}
          step={1}
          value={draft.scale}
          onChange={event =>
            controls.updateDraft({ scale: Number(event.target.value) })
          }
          className="min-h-[44px]"
        />
      </label>
      <details>
        <summary className="text-muted min-h-[44px] cursor-pointer text-xs">
          Advanced
        </summary>
        <div className="flex flex-wrap items-end gap-2">
          <NumberField
            aria-label="Detail"
            value={draft.detail}
            min={b.detail.min}
            max={b.detail.max}
            onChange={value => {
              if (
                value !== undefined &&
                value >= b.detail.min &&
                value <= b.detail.max
              ) {
                controls.updateDraft({ detail: value as 1 | 2 | 3 | 4 });
              }
            }}
          />
          <NumberField
            aria-label="Seed"
            value={draft.seed}
            min={b.seed.min}
            max={b.seed.max}
            onChange={value => {
              if (
                value !== undefined &&
                Number.isInteger(value) &&
                value >= b.seed.min &&
                value <= b.seed.max
              ) {
                controls.updateDraft({ seed: value });
              }
            }}
          />
          <Button
            variant="ghost"
            onClick={controls.randomizeSeed}
            className="min-h-[44px] px-3 text-xs"
          >
            Randomize seed
          </Button>
        </div>
      </details>
    </>
  );
}
