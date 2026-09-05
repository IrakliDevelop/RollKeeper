import type { FogRendererOptions, FogStyle } from '@fieldnotes/core';
import type {
  CustomFogMaterialV1,
  CustomProceduralFogMaterialV1,
  CustomSolidFogMaterialV1,
} from '@/types/fogMaterial';

export const FOG_MATERIAL_BOUNDS = {
  noiseOpacity: { min: 0, max: 1 },
  scale: { min: 64, max: 1024 },
  detail: { min: 1, max: 4 },
  seed: { min: 0, max: 65535 },
} as const;

/** Product-owned editor translucency. User input can never change it. */
const EDITOR_SOLID_ALPHA = 0.45;
const EDITOR_PROCEDURAL_BACKDROP_ALPHA = 0.5;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) return null;
  return value.toLowerCase();
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function finiteInRange(
  value: unknown,
  min: number,
  max: number
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value >= min && value <= max ? value : null;
}

function integerInRange(
  value: unknown,
  min: number,
  max: number
): number | null {
  const n = finiteInRange(value, min, max);
  return n !== null && Number.isInteger(n) ? n : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Strict parser for stored/API materials. Rejects instead of clamping so a
 * corrupted or hostile payload never becomes a silently different material.
 * Always returns a fresh object with only the known keys.
 */
export function parseCustomFogMaterial(
  value: unknown
): CustomFogMaterialV1 | null {
  if (!isRecord(value) || value.v !== 1) return null;
  if (value.kind === 'solid') {
    const color = normalizeHexColor(value.color);
    if (color === null) return null;
    return { v: 1, kind: 'solid', color };
  }
  if (value.kind === 'procedural') {
    const baseColor = normalizeHexColor(value.baseColor);
    const noiseColor = normalizeHexColor(value.noiseColor);
    const b = FOG_MATERIAL_BOUNDS;
    const noiseOpacity = finiteInRange(
      value.noiseOpacity,
      b.noiseOpacity.min,
      b.noiseOpacity.max
    );
    const scale = finiteInRange(value.scale, b.scale.min, b.scale.max);
    const detail = integerInRange(value.detail, b.detail.min, b.detail.max);
    const seed = integerInRange(value.seed, b.seed.min, b.seed.max);
    if (
      baseColor === null ||
      noiseColor === null ||
      noiseOpacity === null ||
      scale === null ||
      detail === null ||
      seed === null
    ) {
      return null;
    }
    return {
      v: 1,
      kind: 'procedural',
      baseColor,
      noiseColor,
      noiseOpacity,
      scale,
      detail: detail as 1 | 2 | 3 | 4,
      seed,
    };
  }
  return null;
}

/** Canonical, key-ordered JSON. Safe as a React effect dependency or dedup key. */
export function fogMaterialFingerprint(material: CustomFogMaterialV1): string {
  if (material.kind === 'solid') {
    return JSON.stringify({ color: material.color, kind: 'solid', v: 1 });
  }
  return JSON.stringify({
    baseColor: material.baseColor,
    detail: material.detail,
    kind: 'procedural',
    noiseColor: material.noiseColor,
    noiseOpacity: material.noiseOpacity,
    scale: material.scale,
    seed: material.seed,
    v: 1,
  });
}

export function fogMaterialsEqual(
  a: CustomFogMaterialV1,
  b: CustomFogMaterialV1
): boolean {
  return fogMaterialFingerprint(a) === fogMaterialFingerprint(b);
}

export function resolveCustomPlayerFogStyle(
  material: CustomFogMaterialV1
): FogStyle {
  if (material.kind === 'solid')
    return { kind: 'solid', color: material.color };
  return {
    kind: 'procedural',
    backdrop: material.baseColor,
    tint: material.noiseColor,
    opacity: material.noiseOpacity,
    scale: material.scale,
    seed: material.seed,
    detail: material.detail,
  };
}

/** Editor style is translucent so the DM can edit beneath fog; player style is opaque. */
export function resolveCustomFogRendererOptions(
  material: CustomFogMaterialV1
): FogRendererOptions {
  const playerStyle = resolveCustomPlayerFogStyle(material);
  if (material.kind === 'solid') {
    return {
      editorStyle: {
        kind: 'solid',
        color: hexToRgba(material.color, EDITOR_SOLID_ALPHA),
      },
      playerStyle,
    };
  }
  return {
    editorStyle: {
      kind: 'procedural',
      backdrop: hexToRgba(material.baseColor, EDITOR_PROCEDURAL_BACKDROP_ALPHA),
      tint: material.noiseColor,
      opacity: material.noiseOpacity,
      scale: material.scale,
      seed: material.seed,
      detail: material.detail,
    },
    playerStyle,
  };
}

export const DEFAULT_CUSTOM_SOLID_MATERIAL: CustomSolidFogMaterialV1 = {
  v: 1,
  kind: 'solid',
  color: '#0b1020',
};

export const DEFAULT_CUSTOM_PROCEDURAL_MATERIAL: CustomProceduralFogMaterialV1 =
  {
    v: 1,
    kind: 'procedural',
    baseColor: '#0b1020',
    noiseColor: '#384868',
    noiseOpacity: 0.6,
    scale: 256,
    detail: 2,
    seed: 0,
  };

/** The shipped Cloudy player look expressed as a custom material (editor starting point only). */
export const CLOUDY_AS_CUSTOM_MATERIAL: CustomProceduralFogMaterialV1 = {
  v: 1,
  kind: 'procedural',
  baseColor: '#0b1020',
  noiseColor: '#384868',
  noiseOpacity: 0.6,
  scale: 200,
  detail: 3,
  seed: 42,
};
