// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatBlockTraits } from '@/components/ui/encounter/combat-screen/detail/StatBlockTraits';
import type {
  MonsterAbility,
  MonsterStatBlock,
  NpcResource,
  StatBlockEntry,
} from '@/types/encounter';

afterEach(cleanup);

const RESOURCE: NpcResource = {
  id: 'res-1',
  name: 'Wild Shape',
  icon: 'paw-print',
  color: 'emerald',
  displayStyle: 'pips',
  maxUses: 4,
  usesExpended: 0,
  shortRestReset: 1,
};

function statBlock(actions: StatBlockEntry[]): MonsterStatBlock {
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
    actions,
    reactions: [],
    bonusActions: [],
    lairActions: [],
    cr: '1',
    type: 'Humanoid',
    size: 'Medium',
    languages: '',
    alignment: '',
    hpFormula: '',
  };
}

const LINKED_ENTRY: StatBlockEntry = {
  id: 'entry-1',
  name: 'Elemental Form',
  text: 'Transforms.',
  resourceCost: { resourceId: 'res-1', amount: 2 },
};

describe('StatBlockTraits — resource costs', () => {
  it('renders cost badge with amount prefix and a Use button that reports the entry', async () => {
    const onUseEntry = vi.fn();
    const user = userEvent.setup();
    render(
      <StatBlockTraits
        statBlock={statBlock([LINKED_ENTRY])}
        resources={[RESOURCE]}
        onUseEntry={onUseEntry}
      />
    );
    expect(screen.getByText('2× Wild Shape')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Use' }));
    expect(onUseEntry).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Elemental Form' })
    );
  });

  it('omits the amount prefix when cost is 1', async () => {
    render(
      <StatBlockTraits
        statBlock={statBlock([
          { ...LINKED_ENTRY, resourceCost: { resourceId: 'res-1', amount: 1 } },
        ])}
        resources={[RESOURCE]}
        onUseEntry={vi.fn()}
      />
    );
    expect(screen.getByText('Wild Shape')).toBeVisible();
  });

  it('disables Use when remaining < amount and never calls onUseEntry', async () => {
    const onUseEntry = vi.fn();
    render(
      <StatBlockTraits
        statBlock={statBlock([LINKED_ENTRY])}
        resources={[{ ...RESOURCE, usesExpended: 3 }]}
        onUseEntry={onUseEntry}
      />
    );
    const btn = screen.getByRole('button', { name: 'Use' });
    expect(btn).toBeDisabled();
    expect(onUseEntry).not.toHaveBeenCalled();
  });

  it('dangling link renders "Unknown resource" disabled — never a free use', async () => {
    const onUseEntry = vi.fn();
    render(
      <StatBlockTraits
        statBlock={statBlock([LINKED_ENTRY])}
        resources={[]}
        onUseEntry={onUseEntry}
      />
    );
    expect(screen.getByText('Unknown resource')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Use' })).toBeDisabled();
  });

  it('no resources/onUseEntry props: renders exactly as before (no badge, no button)', async () => {
    render(<StatBlockTraits statBlock={statBlock([LINKED_ENTRY])} />);
    expect(
      screen.queryByRole('button', { name: 'Use' })
    ).not.toBeInTheDocument();
  });

  it('entry with its own uses label AND a cost shows both, independently', async () => {
    render(
      <StatBlockTraits
        statBlock={statBlock([
          { ...LINKED_ENTRY, name: 'Elemental Form', uses: 3 },
        ])}
        resources={[RESOURCE]}
        onUseEntry={vi.fn()}
      />
    );
    expect(screen.getByText(/3\/Day/)).toBeVisible();
    expect(screen.getByText('2× Wild Shape')).toBeVisible();
  });

  it('trackable entry renders inline pips wired to onUseAbilityEntry', () => {
    const onUseAbilityEntry = vi.fn();
    const sb = statBlock([
      { id: 'entry-a', name: 'Smite', text: 'holy', uses: 2 },
    ]);
    const abilities: MonsterAbility[] = [
      {
        id: 'entry-a',
        name: 'Smite',
        description: 'holy',
        usageType: 'per-day',
        maxUses: 2,
        usedUses: 0,
      },
    ];
    const { getByLabelText } = render(
      <StatBlockTraits
        statBlock={sb}
        abilities={abilities}
        onUseAbilityEntry={onUseAbilityEntry}
      />
    );
    getByLabelText('Smite use 1 (available)').click();
    expect(onUseAbilityEntry).toHaveBeenCalled();
  });
});
