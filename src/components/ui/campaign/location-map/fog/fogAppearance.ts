import type { FogRendererOptions } from '@fieldnotes/core';
import type { FogAppearanceV1 } from '@/types/battlemap';

const VALID_APPEARANCES = new Set<FogAppearanceV1>(['solid', 'cloudy']);

const SOLID_PRESET: FogRendererOptions = {};

const CLOUDY_PRESET: FogRendererOptions = {
  editorStyle: {
    kind: 'procedural',
    backdrop: 'rgba(20, 28, 50, 0.5)',
    tint: '#7090c0',
    opacity: 0.55,
    scale: 200,
    seed: 42,
    detail: 3,
  },
  playerStyle: {
    kind: 'procedural',
    backdrop: '#0b1020',
    tint: '#384868',
    opacity: 0.6,
    scale: 200,
    seed: 42,
    detail: 3,
  },
};

export function parseFogAppearance(value: unknown): FogAppearanceV1 {
  if (
    typeof value === 'string' &&
    VALID_APPEARANCES.has(value as FogAppearanceV1)
  ) {
    return value as FogAppearanceV1;
  }
  return 'solid';
}

export function resolveFogRendererOptions(
  appearance: FogAppearanceV1
): FogRendererOptions {
  if (appearance === 'cloudy') return CLOUDY_PRESET;
  return SOLID_PRESET;
}
