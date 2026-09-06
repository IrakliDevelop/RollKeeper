import type {
  FogAppearance,
  FogAppearanceV1,
  ProjectedFogAppearance,
} from '@/types/battlemap';
import type { AppliedCustomFogAppearanceV2 } from '@/types/fogMaterial';
import { fogMaterialFingerprint, parseCustomFogMaterial } from './fogMaterial';

const VALID_FOG_APPEARANCES = new Set<FogAppearanceV1>(['solid', 'cloudy']);

export function isFogOfWarEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FOG_OF_WAR_ENABLED === 'true';
}

/**
 * Rollout gate for the DM-facing procedural appearance selector. Keep this
 * separate from fog-of-war itself so incomplete viewer propagation can never
 * expose a control that only changes the DM's canvas.
 */
export function isProceduralFogAppearanceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED === 'true';
}

/**
 * Rollout gate for the campaign fog preset library. Additive on top of the
 * procedural gate: nothing in the library can be visible while the
 * Solid/Cloudy control itself is hidden.
 */
export function isFogPresetLibraryEnabled(): boolean {
  return (
    isProceduralFogAppearanceEnabled() &&
    process.env.NEXT_PUBLIC_FOG_PRESET_LIBRARY_ENABLED === 'true'
  );
}

export function isFogAppearanceV1(value: unknown): value is FogAppearanceV1 {
  return (
    typeof value === 'string' &&
    VALID_FOG_APPEARANCES.has(value as FogAppearanceV1)
  );
}

export function normalizeFogAppearance(value: unknown): FogAppearanceV1 {
  return isFogAppearanceV1(value) ? value : 'solid';
}

export function normalizeFogAppearanceProjectionTimestamp(
  value: unknown
): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    return new Date(value).toISOString() === value ? value : null;
  } catch {
    return null;
  }
}

export interface BattleMapFogAppearanceProjectionV1 {
  v: 1;
  appearance: FogAppearanceV1;
  updatedAt: string;
}

export interface BattleMapFogAppearanceProjectionV2 {
  v: 2;
  appearance: ProjectedFogAppearance;
  updatedAt: string;
}

export type BattleMapFogAppearanceProjection =
  | BattleMapFogAppearanceProjectionV1
  | BattleMapFogAppearanceProjectionV2;

const MAX_SOURCE_PRESET_ID_LENGTH = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCustomAppearanceRecord(
  value: unknown,
  keepSourceId: boolean
): AppliedCustomFogAppearanceV2 | null {
  if (!isRecord(value) || value.v !== 2 || value.kind !== 'custom') return null;
  const material = parseCustomFogMaterial(value.material);
  if (material === null) return null;
  const result: AppliedCustomFogAppearanceV2 = {
    v: 2,
    kind: 'custom',
    material,
  };
  if (value.sourcePresetId !== undefined) {
    if (
      typeof value.sourcePresetId !== 'string' ||
      value.sourcePresetId.length === 0 ||
      value.sourcePresetId.length > MAX_SOURCE_PRESET_ID_LENGTH
    ) {
      return null;
    }
    if (keepSourceId) result.sourcePresetId = value.sourcePresetId;
  }
  return result;
}

/** DM-side parse. Legacy strings pass through; anything malformed is Solid. */
export function parseAppliedFogAppearance(value: unknown): FogAppearance {
  if (isFogAppearanceV1(value)) return value;
  return parseCustomAppearanceRecord(value, true) ?? 'solid';
}

/** Viewer-side parse. Never yields a `sourcePresetId`. */
export function parseProjectedFogAppearance(
  value: unknown
): ProjectedFogAppearance {
  if (isFogAppearanceV1(value)) return value;
  return parseCustomAppearanceRecord(value, false) ?? 'solid';
}

export function toProjectedFogAppearance(
  appearance: FogAppearance
): ProjectedFogAppearance {
  if (typeof appearance === 'string') return appearance;
  return { v: 2, kind: 'custom', material: appearance.material };
}

/** While the library gate is off a stored custom snapshot renders as Solid without being rewritten. */
export function downgradeFogAppearanceForGate<
  T extends FogAppearance | ProjectedFogAppearance,
>(appearance: T, libraryEnabled: boolean): T | 'solid' {
  return typeof appearance === 'string' || libraryEnabled
    ? appearance
    : 'solid';
}

export function parseFogAppearanceForClient(value: unknown): FogAppearance {
  return downgradeFogAppearanceForGate(
    parseAppliedFogAppearance(value),
    isFogPresetLibraryEnabled()
  );
}

/** Stable string for effect deps, dedup keys, and "Modified" labels. */
export function fogAppearanceFingerprint(
  appearance: FogAppearance | ProjectedFogAppearance
): string {
  if (typeof appearance === 'string') return appearance;
  return `custom:${fogMaterialFingerprint(appearance.material)}`;
}

export function parseBattleMapFogAppearanceProjection(
  value: unknown
): BattleMapFogAppearanceProjection | null {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(value)) return null;
  const updatedAt = normalizeFogAppearanceProjectionTimestamp(value.updatedAt);
  if (updatedAt === null) return null;
  if (value.v === 1) {
    if (!isFogAppearanceV1(value.appearance)) return null;
    return { v: 1, appearance: value.appearance, updatedAt };
  }
  if (value.v === 2) {
    const appearance = parseCustomAppearanceRecord(value.appearance, false);
    if (appearance === null) return null;
    return { v: 2, appearance, updatedAt };
  }
  return null;
}
