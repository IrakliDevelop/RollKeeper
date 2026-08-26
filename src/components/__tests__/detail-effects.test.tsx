// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DetailEffects } from '@/components/ui/encounter/combat-screen/detail/DetailEffects';
import { useEncounterStore } from '@/store/encounterStore';
import { DEFAULT_COMBAT_CONFIG } from '@/types/encounter';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

afterEach(cleanup);

function makeActions(): EntityActions {
  return {
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
    onDamage: vi.fn(),
    onHeal: vi.fn(),
    onAddTempHp: vi.fn(),
    onSetMaxHp: vi.fn(),
    onAddCondition: vi.fn(),
    onRemoveCondition: vi.fn(),
    onSetConditionRounds: vi.fn(),
    onUseAbility: vi.fn(),
    onRestoreAbility: vi.fn(),
    onSpendResource: vi.fn(() => true),
    onRestoreResource: vi.fn(),
    onUseLegendaryAction: vi.fn(),
    onResetLegendaryActions: vi.fn(),
    onSetConcentration: vi.fn(),
    onUseLairAction: vi.fn(),
    onSetInitiative: vi.fn(),
    onLongRest: vi.fn(),
    onShortRest: vi.fn(),
  };
}

const entity: EncounterEntity = {
  id: 'npc-1',
  type: 'npc',
  name: 'Guard',
  initiative: 12,
  initiativeModifier: 1,
  currentHp: 11,
  maxHp: 11,
  tempHp: 0,
  armorClass: 16,
  conditions: [],
};

describe('DetailEffects — combatConfig.customStatuses selector', () => {
  beforeEach(() => {
    useEncounterStore.setState({ combatConfig: DEFAULT_COMBAT_CONFIG });
  });

  it('renders without an update loop when persisted combatConfig lacks customStatuses (legacy data)', () => {
    // Pre-custom-statuses localStorage hydrates a combatConfig without the
    // field; the selector fallback must stay referentially stable or React's
    // useSyncExternalStore loops ("The result of getSnapshot should be cached").
    useEncounterStore.setState({
      combatConfig: {
        enemyHpDisplay: 'off',
        hpStateBands: [],
        enemyConditionsDisplay: 'off',
      },
    });

    expect(() =>
      render(<DetailEffects entity={entity} actions={makeActions()} />)
    ).not.toThrow();
    expect(screen.getByText('Conditions')).toBeTruthy();
  });

  it('renders defined custom statuses in the conditions palette', () => {
    useEncounterStore.setState({
      combatConfig: {
        ...DEFAULT_COMBAT_CONFIG,
        customStatuses: ['Marked by Fate'],
      },
    });

    render(<DetailEffects entity={entity} actions={makeActions()} />);
    expect(screen.getByText('Marked by Fate')).toBeTruthy();
  });
});
