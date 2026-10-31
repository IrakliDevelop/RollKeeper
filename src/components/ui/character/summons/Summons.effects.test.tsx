// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SummonCard } from './SummonCard';
import { SummonsSubTab } from './SummonsSubTab';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { SavedCreature, Summon } from '@/types/summon';

const creature = (id: string): SavedCreature => ({
  id,
  name: `Very long ${id} creature name`,
  size: 'Tiny',
  type: 'Fiend',
  alignment: 'Neutral',
  ac: 13,
  hp: 10,
  speed: '30 ft.',
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
  createdAt: '2026-10-01',
  updatedAt: '2026-10-01',
});
const summon: Summon = {
  id: 'summon-1',
  type: 'summon',
  sourceSpellName: 'Conjure Animals',
  requiresConcentration: true,
  createdAt: '2026-10-01',
  entity: {
    id: 'entity-1',
    type: 'monster',
    name: 'Very long summoned creature name',
    initiative: null,
    initiativeModifier: 0,
    currentHp: 20,
    maxHp: 20,
    tempHp: 0,
    armorClass: 13,
    conditions: [
      { id: 'poison', name: 'Poisoned' },
      { id: 'prone', name: 'Prone' },
    ],
  },
};

describe('Summons combat effects', () => {
  beforeEach(() => {
    const character = makeCharacter();
    character.savedCreatures = [creature('first'), creature('second')];
    character.summons = [summon];
    useCharacterStore.setState({ character });
  });
  afterEach(cleanup);

  it('shows full summon name, lapis concentration chip and ember removable conditions', async () => {
    const user = userEvent.setup();
    const onRemoveCondition = vi.fn();
    const { container } = render(
      <SummonCard
        summon={summon}
        onDamage={vi.fn()}
        onHeal={vi.fn()}
        onAddTempHp={vi.fn()}
        onAddCondition={vi.fn()}
        onRemoveCondition={onRemoveCondition}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByText('Very long summoned creature name')).toBeTruthy();
    expect(container.querySelector('[data-kind="concentration"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-kind="condition"]')).toHaveLength(
      2
    );
    await user.click(screen.getByRole('button', { name: 'Remove Poisoned' }));
    expect(onRemoveCondition).toHaveBeenCalledWith('summon-1', 'poison');
  });

  it('uses a clearable HP amount field', async () => {
    const user = userEvent.setup();
    render(
      <SummonCard
        summon={summon}
        onDamage={vi.fn()}
        onHeal={vi.fn()}
        onAddTempHp={vi.fn()}
        onAddCondition={vi.fn()}
        onRemoveCondition={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    const amount = screen.getByRole('textbox', { name: 'HP amount' });
    expect(amount.getAttribute('type')).toBe('text');
    await user.type(amount, '5');
    await user.clear(amount);
    expect(amount.getAttribute('value')).toBe('');
  });

  it('keeps saved creature actions visible and returns focus after removal', async () => {
    const user = userEvent.setup();
    render(<SummonsSubTab />);
    await user.click(screen.getByRole('button', { name: /Saved creatures/ }));
    expect(
      screen.getByRole('button', { name: 'Edit Very long first creature name' })
    ).toBeTruthy();
    await user.click(
      screen.getByRole('button', {
        name: 'Delete Very long first creature name',
      })
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', {
          name: 'Edit Very long second creature name',
        })
      )
    );
  });

  it('moves focus between condition chips and to Add condition after the last removal', async () => {
    const user = userEvent.setup();
    render(<SummonsSubTab />);
    await user.click(screen.getByRole('button', { name: 'Remove Poisoned' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Remove Prone' })
      )
    );
    await user.click(screen.getByRole('button', { name: 'Remove Prone' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Add condition' })
      )
    );
  });

  it('moves focus to the next summon after dismissing the focused one', async () => {
    const user = userEvent.setup();
    const second = {
      ...summon,
      id: 'summon-2',
      entity: { ...summon.entity, id: 'entity-2', name: 'Second summon' },
    };
    useCharacterStore.setState(state => ({
      character: { ...state.character, summons: [summon, second] },
    }));
    render(<SummonsSubTab />);
    await user.click(screen.getAllByRole('button', { name: /^Dismiss / })[0]);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Dismiss Second summon' })
      )
    );
  });

  it('uses rendered group order for dismissal focus and skips hidden wild shapes', async () => {
    const user = userEvent.setup();
    const other = {
      ...summon,
      id: 'other',
      requiresConcentration: false,
      entity: { ...summon.entity, id: 'other-entity', name: 'Other summon' },
    };
    const familiar = {
      ...summon,
      id: 'familiar',
      type: 'familiar' as const,
      requiresConcentration: false,
      entity: { ...summon.entity, id: 'familiar-entity', name: 'Familiar' },
    };
    const wildShape = {
      ...summon,
      id: 'wild',
      type: 'wild-shape' as const,
      entity: { ...summon.entity, id: 'wild-entity', name: 'Wild shape' },
    };
    useCharacterStore.setState(state => ({
      character: {
        ...state.character,
        summons: [other, familiar, wildShape, summon],
      },
    }));
    render(<SummonsSubTab />);
    expect(screen.getAllByRole('button', { name: /^Dismiss / })).toHaveLength(
      3
    );
    await user.click(screen.getAllByRole('button', { name: /^Dismiss / })[0]);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', {
          name: 'Dismiss Very long summoned creature name',
        })
      )
    );
    await user.click(screen.getAllByRole('button', { name: /^Dismiss / })[0]);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', {
          name: 'Dismiss Other summon',
        })
      )
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Dismiss Other summon',
      })
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /Saved creatures/ })
      )
    );
  });

  it('names Dismiss by the summon and reports open state on its toggles', async () => {
    const user = userEvent.setup();
    render(
      <SummonCard
        summon={{
          ...summon,
          entity: {
            ...summon.entity,
            monsterStatBlock: {
              conditionImmunities: [],
              traits: [],
              actions: [],
              reactions: [],
              bonusActions: [],
              lairActions: [],
            } as unknown as NonNullable<Summon['entity']['monsterStatBlock']>,
          },
        }}
        onDamage={vi.fn()}
        onHeal={vi.fn()}
        onAddTempHp={vi.fn()}
        onAddCondition={vi.fn()}
        onRemoveCondition={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(
      screen.getByRole('button', {
        name: 'Dismiss Very long summoned creature name',
      })
    ).toBeTruthy();
    for (const name of ['Add condition', 'Stat block']) {
      const toggle = screen.getByRole('button', { name });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await user.click(toggle);
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    }
  });
});
