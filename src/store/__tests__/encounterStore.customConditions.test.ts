import { beforeEach, describe, expect, it } from 'vitest';
import {
  mergeEncounterPersistedState,
  useEncounterStore,
} from '@/store/encounterStore';
import { DEFAULT_COMBAT_CONFIG } from '@/types/encounter';
import { ENCOUNTER_STORAGE_KEY } from '@/utils/constants';

const legacyConfig = {
  enemyHpDisplay: 'label',
  hpStateBands: [{ minPercent: 0, label: 'Down' }],
  enemyConditionsDisplay: 'on',
  customStatuses: ['Marked', 'Hexed'],
};

describe('encounterStore — customStatuses → customConditions migration', () => {
  beforeEach(() => {
    localStorage.clear();
    useEncounterStore.setState({
      encounters: [],
      encounterTombstones: {},
      activeEncounterId: null,
      combatConfig: DEFAULT_COMBAT_CONFIG,
    });
  });

  it('merge maps legacy strings to objects and keeps the other settings', () => {
    const merged = mergeEncounterPersistedState(
      { combatConfig: legacyConfig },
      useEncounterStore.getState()
    );
    expect(merged.combatConfig.customConditions).toEqual([
      {
        id: 'legacy-marked',
        name: 'Marked',
        description: '',
        icon: 'trending-down',
        kind: 'debuff',
      },
      {
        id: 'legacy-hexed',
        name: 'Hexed',
        description: '',
        icon: 'trending-down',
        kind: 'debuff',
      },
    ]);
    expect('customStatuses' in merged.combatConfig).toBe(false);
    expect(merged.combatConfig.enemyHpDisplay).toBe('label');
    expect(merged.combatConfig.enemyConditionsDisplay).toBe('on');
  });

  it('merge tolerates a missing persisted state and a config without either field', () => {
    const current = useEncounterStore.getState();
    expect(
      mergeEncounterPersistedState(undefined, current).combatConfig
        .customConditions
    ).toEqual([]);
    // A persisted config from before the library is passed through UNTOUCHED
    // (byte-fixpoint); readers fall back to EMPTY_CUSTOM_CONDITIONS.
    const persistedConfig = {
      enemyHpDisplay: 'off',
      hpStateBands: [],
      enemyConditionsDisplay: 'off',
    };
    const merged = mergeEncounterPersistedState(
      { combatConfig: persistedConfig },
      current
    );
    expect(merged.combatConfig).toBe(persistedConfig);
    expect(merged.combatConfig.customConditions).toBeUndefined();
  });

  it('rehydrates legacy storage, then the next write drops the legacy key WITHOUT bumping the envelope version', async () => {
    localStorage.setItem(
      ENCOUNTER_STORAGE_KEY,
      JSON.stringify({
        state: {
          encounters: [],
          encounterTombstones: {},
          activeEncounterId: null,
          combatConfig: legacyConfig,
        },
        version: 2,
      })
    );

    await useEncounterStore.persist.rehydrate();

    const config = useEncounterStore.getState().combatConfig;
    expect(config.customConditions?.map(c => c.name)).toEqual([
      'Marked',
      'Hexed',
    ]);
    expect('customStatuses' in config).toBe(false);

    useEncounterStore.getState().setCombatConfig({ enemyHpDisplay: 'off' });
    const persisted = JSON.parse(localStorage.getItem(ENCOUNTER_STORAGE_KEY)!);
    expect(persisted.version).toBe(2);
    expect(persisted.state.combatConfig.customStatuses).toBeUndefined();
    expect(persisted.state.combatConfig.customConditions).toHaveLength(2);
  });
});
