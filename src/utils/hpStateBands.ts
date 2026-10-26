import { DEFAULT_HP_STATE_BANDS, type HpStateBand } from '@/types/encounter';

/**
 * The default HP state bands before Felt and Brass Phase 2. A DM who never
 * edited them still has this exact list saved in their combat config.
 */
export const LEGACY_DEFAULT_HP_STATE_BANDS: readonly HpStateBand[] = [
  { minPercent: 100, label: 'Unharmed' },
  { minPercent: 75, label: 'Healthy' },
  { minPercent: 50, label: 'Injured' },
  { minPercent: 25, label: 'Bloodied' },
  { minPercent: 1, label: 'Near Death' },
  { minPercent: 0, label: 'Down' },
];

function isLegacyDefaultList(bands: unknown): boolean {
  if (!Array.isArray(bands)) return false;
  if (bands.length !== LEGACY_DEFAULT_HP_STATE_BANDS.length) return false;
  return LEGACY_DEFAULT_HP_STATE_BANDS.every((legacy, i) => {
    const band = bands[i] as Partial<HpStateBand> | null | undefined;
    return (
      band?.minPercent === legacy.minPercent && band?.label === legacy.label
    );
  });
}

/**
 * Swaps a saved band list that still equals the old defaults (same order,
 * same words) for today's defaults. Any list the DM changed is kept.
 *
 * Returns the SAME object when there is nothing to upgrade: the encounter
 * store's hydrate → write-through must leave untouched configs byte-identical
 * (see normalizeCombatConfig in src/utils/customConditions.ts).
 */
export function upgradeLegacyDefaultHpBands<
  C extends { hpStateBands?: unknown },
>(config: C): C {
  if (!isLegacyDefaultList(config.hpStateBands)) return config;
  return { ...config, hpStateBands: [...DEFAULT_HP_STATE_BANDS] };
}
