import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import QuickStats from '../QuickStats';

afterEach(cleanup);

const base = {
  passivePerception: 12,
  passiveInsight: 11,
  passiveInvestigation: 10,
  proficiencyBonus: 3,
  carryingCapacity: 150,
  currentWeight: 30,
  itemCount: 4,
};

it('shows passives and proficiency as cells in a three-column grid', () => {
  const { container } = render(<QuickStats {...base} />);
  for (const label of [
    'Passive Perception',
    'Passive Investigation',
    'Passive Insight',
    'Proficiency bonus',
  ]) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
  expect(screen.getByText('+3')).toHaveClass('type-num-lg');
  expect(container.querySelector('.grid-cols-3')).not.toBeNull();
  expect(screen.queryByText('Spell attack')).toBeNull();
  expect(screen.queryByText('Spell save DC')).toBeNull();
});

it('adds spell cells when the character casts', () => {
  render(<QuickStats {...base} spellAttackBonus={5} spellSaveDC={13} />);
  expect(screen.getByText('Spell attack')).toBeInTheDocument();
  expect(screen.getByText('+5')).toBeInTheDocument();
  expect(screen.getByText('Spell save DC')).toBeInTheDocument();
  expect(screen.getByText('13')).toBeInTheDocument();
});

it('shows carrying capacity beside its label', () => {
  render(<QuickStats {...base} />);
  expect(screen.getByText('Carrying capacity')).toBeInTheDocument();
  expect(screen.getByText('30.0 / 150 lb')).toBeInTheDocument();
  expect(screen.queryByText('Encumbered')).toBeNull();
});

it('flags encumbrance', () => {
  render(<QuickStats {...base} currentWeight={200} />);
  expect(screen.getByText('Encumbered')).toBeInTheDocument();
  expect(screen.getByText('200.0 / 150 lb')).toHaveClass('text-ember-text');
});

it('nudges when items have no weight', () => {
  render(<QuickStats {...base} currentWeight={0} />);
  expect(
    screen.getByText(/None of your items have a weight/)
  ).toBeInTheDocument();
});
