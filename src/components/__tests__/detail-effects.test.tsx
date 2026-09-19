// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailEffects } from '@/components/ui/encounter/combat-screen/detail/DetailEffects';
import { useEncounterStore } from '@/store/encounterStore';
import { createMockEncounter } from '@/test/helpers';
import { DEFAULT_COMBAT_CONFIG } from '@/types/encounter';
import type { CustomCondition, MonsterStatBlock } from '@/types/encounter';
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

describe('DetailEffects — combatConfig.customConditions selector', () => {
  beforeEach(() => {
    useEncounterStore.setState({
      encounters: [],
      activeEncounterId: null,
      combatConfig: DEFAULT_COMBAT_CONFIG,
    });
  });

  it('renders without an update loop when persisted combatConfig lacks customConditions (legacy data)', () => {
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
        customConditions: [
          {
            id: 'cc-fate',
            name: 'Marked by Fate',
            description: '',
            icon: 'trending-down',
            kind: 'debuff',
          },
        ],
      },
    });

    render(<DetailEffects entity={entity} actions={makeActions()} />);
    expect(screen.getByText('Marked by Fate')).toBeTruthy();
  });

  const webbed: CustomCondition = {
    id: 'cc-web',
    name: 'Webbed',
    description: 'Restrained by sticky webbing.',
    icon: 'link',
    kind: 'debuff',
  };

  function blockWith(conditions: CustomCondition[]): MonsterStatBlock {
    return {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
      saves: '',
      skills: '',
      speed: '30 ft.',
      resistances: '',
      immunities: '',
      vulnerabilities: '',
      conditionImmunities: [],
      senses: '',
      passivePerception: 10,
      traits: [],
      actions: [],
      reactions: [],
      bonusActions: [],
      lairActions: [],
      cr: '1',
      type: 'Beast',
      size: 'Large',
      languages: '',
      alignment: '',
      hpFormula: '',
      inflictableConditions: conditions,
    };
  }

  it('shows library icons, and files buff-kind entries under the Buffs tab', async () => {
    const user = userEvent.setup();
    useEncounterStore.setState({
      combatConfig: {
        ...DEFAULT_COMBAT_CONFIG,
        customConditions: [
          webbed,
          {
            id: 'cc-ward',
            name: 'Warded',
            description: '',
            icon: 'shield-plus',
            kind: 'buff',
          },
        ],
      },
    });
    render(<DetailEffects entity={entity} actions={makeActions()} />);

    const chip = screen.getByRole('button', { name: 'Webbed' });
    expect(chip.querySelector('.lucide-link')).not.toBeNull();
    expect(chip.getAttribute('title')).toBe('Restrained by sticky webbing.');
    expect(screen.queryByRole('button', { name: 'Warded' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Buffs' }));
    expect(
      screen
        .getByRole('button', { name: 'Warded' })
        .querySelector('.lucide-shield-plus')
    ).not.toBeNull();
  });

  it('lists creature conditions once in a "From creatures" row and applies them with their source', async () => {
    const user = userEvent.setup();
    const spider: EncounterEntity = {
      ...entity,
      id: 'spider-1',
      type: 'monster',
      name: 'Giant Spider',
      monsterStatBlock: blockWith([webbed]),
    };
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          entities: [
            spider,
            { ...spider, id: 'spider-2', name: 'Giant Spider 2' },
            entity,
          ],
        }),
      ],
      activeEncounterId: 'enc-1',
      combatConfig: {
        ...DEFAULT_COMBAT_CONFIG,
        // Same id, edited in the library → the library version wins.
        customConditions: [{ ...webbed, name: 'Web Snare' }],
      },
    });
    const actions = makeActions();
    render(<DetailEffects entity={entity} actions={actions} />);

    expect(screen.getByText('From creatures')).toBeTruthy();
    const chips = screen.getAllByRole('button', {
      name: 'Web Snare (from Giant Spider)',
    });
    expect(chips).toHaveLength(1);
    await user.click(chips[0]);

    expect(actions.onAddCondition).toHaveBeenCalledWith('npc-1', {
      name: 'Web Snare',
      description: 'Restrained by sticky webbing.',
      icon: 'link',
      kind: 'debuff',
      source: 'dm',
      sourceEntity: 'Giant Spider',
    });
  });

  it('renders no "From creatures" row when no combatant inflicts anything', () => {
    useEncounterStore.setState({
      encounters: [createMockEncounter({ id: 'enc-1', entities: [entity] })],
      activeEncounterId: 'enc-1',
    });
    render(<DetailEffects entity={entity} actions={makeActions()} />);
    expect(screen.queryByText('From creatures')).toBeNull();
  });
});
