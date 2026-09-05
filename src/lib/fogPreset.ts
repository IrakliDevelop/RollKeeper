import type { FogPresetV1 } from '@/types/fogMaterial';
import { parseCustomFogMaterial } from './fogMaterial';

export const FOG_PRESET_LIMITS = {
  maxPresets: 50,
  maxIdLength: 64,
  nameMinCodePoints: 1,
  nameMaxCodePoints: 60,
} as const;

/** Lowercase, trimmed. Compared against the trimmed lowercase candidate. */
export const RESERVED_FOG_PRESET_NAMES = [
  'solid (classic)',
  'solid',
  'cloudy',
] as const;

const BUILT_IN_IDS = new Set(['solid', 'cloudy']);
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const ID_PREFIX = 'fp_';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

export function normalizeFogPresetName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const length = Array.from(trimmed).length;
  if (
    length < FOG_PRESET_LIMITS.nameMinCodePoints ||
    length > FOG_PRESET_LIMITS.nameMaxCodePoints
  ) {
    return null;
  }
  return trimmed;
}

function normalizeFogPresetId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value.length > FOG_PRESET_LIMITS.maxIdLength)
    return null;
  if (!ID_PATTERN.test(value) || BUILT_IN_IDS.has(value)) return null;
  return value;
}

export function parseFogPreset(value: unknown): FogPresetV1 | null {
  if (!isRecord(value) || value.v !== 1) return null;
  const id = normalizeFogPresetId(value.id);
  const name = normalizeFogPresetName(value.name);
  const material = parseCustomFogMaterial(value.material);
  if (
    id === null ||
    name === null ||
    material === null ||
    !isIsoTimestamp(value.createdAt) ||
    !isIsoTimestamp(value.updatedAt)
  ) {
    return null;
  }
  return {
    v: 1,
    id,
    name,
    material,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

/** Invalid records are skipped so one bad preset never poisons the campaign. */
export function parseFogPresetLibrary(value: unknown): FogPresetV1[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const library: FogPresetV1[] = [];
  for (const raw of value) {
    if (library.length >= FOG_PRESET_LIMITS.maxPresets) break;
    const preset = parseFogPreset(raw);
    if (!preset || seen.has(preset.id)) continue;
    seen.add(preset.id);
    library.push(preset);
  }
  return library;
}

export function generateFogPresetId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c && typeof c.randomUUID === 'function')
    return `${ID_PREFIX}${c.randomUUID()}`;
  const fallback = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${ID_PREFIX}${fallback}`;
}

export function canAddFogPreset(library: readonly FogPresetV1[]): boolean {
  return library.length < FOG_PRESET_LIMITS.maxPresets;
}

export function findFogPresetNameConflict(
  library: readonly FogPresetV1[],
  name: string,
  excludeId?: string
): 'reserved' | 'duplicate' | null {
  const key = name.trim().toLowerCase();
  if ((RESERVED_FOG_PRESET_NAMES as readonly string[]).includes(key))
    return 'reserved';
  const clash = library.some(
    p => p.id !== excludeId && p.name.toLowerCase() === key
  );
  return clash ? 'duplicate' : null;
}

export function sortFogPresetsForDisplay(
  library: readonly FogPresetV1[]
): FogPresetV1[] {
  return [...library].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}
