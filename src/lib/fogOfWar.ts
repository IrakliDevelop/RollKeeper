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
  appearance: import('@/types/battlemap').FogAppearanceV1;
  updatedAt: string;
}
