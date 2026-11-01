import { describe, expect, it } from 'vitest';
import { DEFAULT_HP_STATE_BANDS, type CombatConfig } from '@/types/encounter';
import {
  LEGACY_DEFAULT_HP_STATE_BANDS,
  upgradeLegacyDefaultHpBands,
} from '../hpStateBands';

const config = (hpStateBands: unknown): CombatConfig =>
  ({
    enemyHpDisplay: 'label',
    hpStateBands,
    enemyConditionsDisplay: 'off',
  }) as CombatConfig;

describe('upgradeLegacyDefaultHpBands', () => {
  it('swaps a saved copy of the old defaults for the new defaults', () => {
    const saved = config(
      LEGACY_DEFAULT_HP_STATE_BANDS.map(band => ({ ...band }))
    );
    const out = upgradeLegacyDefaultHpBands(saved);
    expect(out.hpStateBands).toEqual(DEFAULT_HP_STATE_BANDS);
    expect(out.enemyHpDisplay).toBe('label');
    expect(out.enemyConditionsDisplay).toBe('off');
    // A copy, so a later setCombatConfig can't mutate the shared default.
    expect(out.hpStateBands).not.toBe(DEFAULT_HP_STATE_BANDS);
  });

  it('keeps a list the DM edited (one word changed)', () => {
    const edited = config(
      LEGACY_DEFAULT_HP_STATE_BANDS.map(band =>
        band.label === 'Injured' ? { ...band, label: 'Hurt' } : { ...band }
      )
    );
    expect(upgradeLegacyDefaultHpBands(edited)).toBe(edited);
  });

  it('keeps a list the DM shortened or reordered', () => {
    const shortened = config(LEGACY_DEFAULT_HP_STATE_BANDS.slice(1));
    expect(upgradeLegacyDefaultHpBands(shortened)).toBe(shortened);
    const reordered = config([...LEGACY_DEFAULT_HP_STATE_BANDS].reverse());
    expect(upgradeLegacyDefaultHpBands(reordered)).toBe(reordered);
  });

  it('returns the same object for the new defaults, an empty list and a missing list', () => {
    const current = config([...DEFAULT_HP_STATE_BANDS]);
    expect(upgradeLegacyDefaultHpBands(current)).toBe(current);
    const empty = config([]);
    expect(upgradeLegacyDefaultHpBands(empty)).toBe(empty);
    const missing: { enemyHpDisplay: string; hpStateBands?: unknown } = {
      enemyHpDisplay: 'exact',
    };
    expect(upgradeLegacyDefaultHpBands(missing)).toBe(missing);
  });

  it('ignores malformed entries', () => {
    const malformed = config([null, 'Healthy', 3, {}, [], undefined]);
    expect(upgradeLegacyDefaultHpBands(malformed)).toBe(malformed);
  });
});
