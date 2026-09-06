'use client';

import { useEffect, useRef } from 'react';
import { renderFogStylePreview } from '@fieldnotes/core';
import { Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { NumberField } from '@/components/ui/forms/NumberInput';
import type { FogPresetControls } from '../useFogPresetControls';
import {
  FOG_MATERIAL_BOUNDS,
  resolveCustomPlayerFogStyle,
} from '@/lib/fogMaterial';
import type {
  CustomFogMaterialV1,
  CustomProceduralFogMaterialV1,
} from '@/types/fogMaterial';

export function ColorField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit(hex: string): void;
}) {
  return (
    <label className="text-heading flex min-h-[44px] items-center justify-between gap-3 text-sm font-medium">
      {label}
      <span className="border-divider bg-surface-muted relative h-10 w-16 overflow-hidden rounded-lg border shadow-sm">
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={event => onCommit(event.target.value)}
          className="absolute -inset-2 h-14 w-20 cursor-pointer border-0 bg-transparent p-0"
        />
      </span>
    </label>
  );
}

export function FogMaterialPreview({
  material,
}: {
  material: CustomFogMaterialV1;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const size = Math.max(
        1,
        Math.round(canvas.getBoundingClientRect().width || 176)
      );
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      renderFogStylePreview(
        ctx,
        resolveCustomPlayerFogStyle(material),
        size,
        size
      );
    };

    draw();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw);
    observer?.observe(canvas);
    return () => observer?.disconnect();
  }, [material]);

  return (
    <figure className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        aria-label="Fog material preview"
        role="img"
        className="border-divider aspect-square w-full overflow-hidden rounded-xl border shadow-inner"
      />
      <figcaption className="text-muted text-center text-xs">
        Material preview
      </figcaption>
    </figure>
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
      <ColorField
        key="base"
        label="Fog color"
        value={draft.baseColor}
        onCommit={baseColor => controls.updateDraft({ baseColor })}
      />
      <ColorField
        key="noise"
        label="Noise color"
        value={draft.noiseColor}
        onCommit={noiseColor => controls.updateDraft({ noiseColor })}
      />
      <label className="text-body flex flex-col gap-1 text-xs">
        <span className="flex items-center justify-between">
          Noise amount
          <output className="text-muted tabular-nums">
            {Math.round(draft.noiseOpacity * 100)}%
          </output>
        </span>
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
        <span className="flex items-center justify-between">
          Noise size
          <output className="text-muted tabular-nums">{draft.scale}px</output>
        </span>
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
        <span className="text-faint -mt-1 flex justify-between text-[11px]">
          <span>Fine</span>
          <span>Broad</span>
        </span>
      </label>
      <details className="border-divider border-t pt-1">
        <summary className="text-body flex min-h-[44px] cursor-pointer items-center text-sm font-medium">
          Advanced
        </summary>
        <div className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-end gap-3 pb-1">
          <label className="text-body flex flex-col gap-1 text-xs">
            Detail
            <NumberField
              aria-label="Detail"
              value={draft.detail}
              min={b.detail.min}
              max={b.detail.max}
              className="border-divider bg-surface-muted text-heading h-10 w-full rounded-lg border px-3"
              onChange={value => {
                if (
                  value !== undefined &&
                  value >= b.detail.min &&
                  value <= b.detail.max
                )
                  controls.updateDraft({ detail: value as 1 | 2 | 3 | 4 });
              }}
            />
          </label>
          <label className="text-body flex flex-col gap-1 text-xs">
            Seed
            <NumberField
              aria-label="Seed"
              value={draft.seed}
              min={b.seed.min}
              max={b.seed.max}
              className="border-divider bg-surface-muted text-heading h-10 w-full rounded-lg border px-3"
              onChange={value => {
                if (
                  value !== undefined &&
                  Number.isInteger(value) &&
                  value >= b.seed.min &&
                  value <= b.seed.max
                )
                  controls.updateDraft({ seed: value });
              }}
            />
          </label>
          <Button
            variant="secondary"
            onClick={controls.randomizeSeed}
            aria-label="Randomize seed"
            className="h-10 px-3 text-xs"
            leftIcon={<Shuffle className="h-4 w-4" />}
          >
            Randomize
          </Button>
        </div>
      </details>
    </>
  );
}
