import type { FogRendererOptions, FogStyle } from '@fieldnotes/core';
import type { FogAppearance } from '@/types/battlemap';
import { parseFogAppearanceForClient } from '@/lib/fogOfWar';
import {
  resolveCustomFogRendererOptions,
  resolveCustomPlayerFogStyle,
} from '@/lib/fogMaterial';

const SOLID_PRESET: FogRendererOptions = {};

/** Fieldnotes' own default player fill; keeps legacy Solid exports byte-identical. */
const DEFAULT_PLAYER_SOLID_STYLE: FogStyle = {
  kind: 'solid',
  color: '#0b1020',
};

export const CLOUDY_PRESET: FogRendererOptions & { playerStyle: FogStyle } = {
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

/** Gate-aware: a stored custom snapshot is Solid until the library gate is on. */
export function parseFogAppearance(value: unknown): FogAppearance {
  return parseFogAppearanceForClient(value);
}

export function resolveFogRendererOptions(value: unknown): FogRendererOptions {
  const appearance = parseFogAppearance(value);
  if (appearance === 'cloudy') return CLOUDY_PRESET;
  if (appearance === 'solid') return SOLID_PRESET;
  return resolveCustomFogRendererOptions(appearance.material);
}

/** Explicit player style for exports/publication so a live draft never leaks in. */
export function resolvePlayerFogStyle(value: unknown): FogStyle {
  const appearance = parseFogAppearance(value);
  if (appearance === 'cloudy') return CLOUDY_PRESET.playerStyle;
  if (appearance === 'solid') return DEFAULT_PLAYER_SOLID_STYLE;
  return resolveCustomPlayerFogStyle(appearance.material);
}
