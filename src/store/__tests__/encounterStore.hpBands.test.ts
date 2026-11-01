import { beforeEach, describe, expect, it } from 'vitest';
import {
  mergeEncounterPersistedState,
  useEncounterStore,
} from '@/store/encounterStore';
import {
  DEFAULT_COMBAT_CONFIG,
  DEFAULT_HP_STATE_BANDS,
} from '@/types/encounter';
import { ENCOUNTER_STORAGE_KEY } from '@/utils/constants';
import { LEGACY_DEFAULT_HP_STATE_BANDS } from '@/utils/hpStateBands';

const savedConfig = (hpStateBands: unknown) => ({
  enemyHpDisplay: 'label',
  hpStateBands,
  enemyConditionsDisplay: 'on',
});

describe('encounterStore — old default HP bands upgrade', () => {
  beforeEach(() => {
    localStorage.clear();
    useEncounterStore.setState({
      encounters: [],
      encounterTombstones: {},
      activeEncounterId: null,
      combatConfig: DEFAULT_COMBAT_CONFIG,
    });
  });

  it('merge swaps the old default list for the new one and keeps the other settings', () => {
    const merged = mergeEncounterPersistedState(
      {
        combatConfig: savedConfig(
          LEGACY_DEFAULT_HP_STATE_BANDS.map(band => ({ ...band }))
        ),
      },
      useEncounterStore.getState()
    );
    expect(merged.combatConfig.hpStateBands).toEqual(DEFAULT_HP_STATE_BANDS);
    expect(merged.combatConfig.enemyHpDisplay).toBe('label');
    expect(merged.combatConfig.enemyConditionsDisplay).toBe('on');
  });

  it('merge passes a DM-edited list through untouched (same object)', () => {
    const edited = savedConfig([
      { minPercent: 50, label: 'Fine' },
      { minPercent: 0, label: 'Hurting' },
    ]);
    const merged = mergeEncounterPersistedState(
      { combatConfig: edited },
      useEncounterStore.getState()
    );
    expect(merged.combatConfig).toBe(edited);
  });

  it('rehydrates the old defaults, then the next write stores the new bands WITHOUT bumping the envelope version', async () => {
    localStorage.setItem(
      ENCOUNTER_STORAGE_KEY,
      JSON.stringify({
        state: {
          encounters: [],
          encounterTombstones: {},
          activeEncounterId: null,
          combatConfig: savedConfig(LEGACY_DEFAULT_HP_STATE_BANDS),
        },
        version: 2,
      })
    );

    await useEncounterStore.persist.rehydrate();
    expect(useEncounterStore.getState().combatConfig.hpStateBands).toEqual(
      DEFAULT_HP_STATE_BANDS
    );

    useEncounterStore.getState().setCombatConfig({ enemyHpDisplay: 'bar' });
    const persisted = JSON.parse(localStorage.getItem(ENCOUNTER_STORAGE_KEY)!);
    expect(persisted.version).toBe(2);
    expect(persisted.state.combatConfig.hpStateBands).toEqual(
      DEFAULT_HP_STATE_BANDS
    );
  });
});
