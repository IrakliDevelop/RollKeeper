// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonsterStatBlockPanel } from '@/components/ui/encounter/MonsterStatBlockPanel';
import type {
  MonsterStatBlock,
  NpcResource,
  StatBlockEntry,
} from '@/types/encounter';

afterEach(cleanup);

const RESOURCE: NpcResource = {
  id: 'res-1',
  name: 'Channel Divinity',
  icon: 'sun',
  color: 'amber',
  displayStyle: 'pips',
  maxUses: 2,
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
    cr: '2',
    type: 'Humanoid',
    size: 'Medium',
    languages: '',
    alignment: '',
    hpFormula: '',
  };
}

const LINKED: StatBlockEntry = {
  id: 'entry-1',
  name: 'Turn Undead',
  text: 'Presents holy symbol.',
  resourceCost: { resourceId: 'res-1', amount: 1 },
};

describe('MonsterStatBlockPanel — resource costs', () => {
  it('without new props renders read-only with no Use button (bestiary regression guard)', async () => {
    render(<MonsterStatBlockPanel statBlock={statBlock([LINKED])} />);
    expect(screen.getByText('Turn Undead')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Use' })
    ).not.toBeInTheDocument();
  });

  it('with props renders badge + Use button that reports the entry', async () => {
    const onUseEntry = vi.fn();
    const user = userEvent.setup();
    render(
      <MonsterStatBlockPanel
        statBlock={statBlock([LINKED])}
        resources={[RESOURCE]}
        onUseEntry={onUseEntry}
      />
    );
    expect(screen.getByText('Channel Divinity')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Use' }));
    expect(onUseEntry).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Turn Undead' })
    );
  });

  it('dangling link disabled with "Unknown resource"', async () => {
    render(
      <MonsterStatBlockPanel
        statBlock={statBlock([LINKED])}
        resources={[]}
        onUseEntry={vi.fn()}
      />
    );
    expect(screen.getByText('Unknown resource')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Use' })).toBeDisabled();
  });
});

describe('MonsterStatBlockPanel — ability tracking', () => {
  it('no new props: an entry with uses renders text-only (no pips/buttons) — bestiary regression', () => {
    const { container } = render(
      <MonsterStatBlockPanel
        statBlock={statBlock([
          { id: 'entry-x', name: 'Smite', text: 'holy', uses: 3 },
        ])}
      />
    );
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('with abilityUsage + callbacks: pips render seeded from usage and fire useNpcAbility path', async () => {
    const onUseAbilityEntry = vi.fn();
    const user = userEvent.setup();
    render(
      <MonsterStatBlockPanel
        statBlock={statBlock([
          { id: 'entry-x', name: 'Smite', text: 'holy', uses: 3 },
        ])}
        abilityUsage={{ 'entry-x': 1 }}
        onUseAbilityEntry={onUseAbilityEntry}
      />
    );
    expect(screen.getByLabelText('Smite use 1 (used)')).toBeTruthy();
    await user.click(screen.getByLabelText('Smite use 2 (available)'));
    expect(onUseAbilityEntry).toHaveBeenCalled();
  });

  it('readOnly with abilityUsage renders static pips, zero buttons', () => {
    const { container } = render(
      <MonsterStatBlockPanel
        statBlock={statBlock([
          { id: 'entry-x', name: 'Smite', text: 'holy', uses: 3 },
        ])}
        abilityUsage={{ 'entry-x': 2 }}
        readOnly
      />
    );
    expect(screen.getByLabelText('Smite use 2 (used)')).toBeTruthy();
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
