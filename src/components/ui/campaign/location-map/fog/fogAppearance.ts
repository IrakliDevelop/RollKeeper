import type { FogRendererOptions } from '@fieldnotes/core';
import type { FogAppearanceV1 } from '@/types/battlemap';
import { normalizeFogAppearance } from '@/lib/fogOfWar';

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
  return normalizeFogAppearance(value);
}

export function resolveFogRendererOptions(value: unknown): FogRendererOptions {
  const appearance = parseFogAppearance(value);
  if (appearance === 'cloudy') return CLOUDY_PRESET;
  return SOLID_PRESET;
}
