import type { FogAppearanceV1 } from '@/types/battlemap';

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

export interface BattleMapFogAppearanceProjectionV1 {
  v: 1;
  appearance: FogAppearanceV1;
  updatedAt: string;
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

export function parseBattleMapFogAppearanceProjection(
  value: unknown
): BattleMapFogAppearanceProjectionV1 | null {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<BattleMapFogAppearanceProjectionV1>;
  const updatedAt = normalizeFogAppearanceProjectionTimestamp(
    candidate.updatedAt
  );
  if (
    candidate.v !== 1 ||
    !isFogAppearanceV1(candidate.appearance) ||
    updatedAt === null
  ) {
    return null;
  }
  return {
    v: 1,
    appearance: candidate.appearance,
    updatedAt,
  };
}
