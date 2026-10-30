// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SummonCreaturePickerModal } from './SummonCreaturePickerModal';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { Spell } from '@/types/character';

const spell: Spell = {
  id: 'spell-1',
  name: 'Conjure Animals',
  level: 3,
  school: 'Conjuration',
  castingTime: '1 action',
  range: '60 feet',
  components: { verbal: true, somatic: true, material: false },
  duration: 'Concentration, up to 1 hour',
  description: '',
  createdAt: '2026-10-01',
  updatedAt: '2026-10-01',
};

beforeEach(() => {
  const character = makeCharacter();
  character.savedCreatures = ['first', 'second'].map(id => ({
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
  }));
  useCharacterStore.setState({ character });
});
afterEach(cleanup);

it('shows saved creature actions at rest in the Spells picker and restores focus after delete', async () => {
  const user = userEvent.setup();
  render(
    <SummonCreaturePickerModal
      open
      onClose={vi.fn()}
      spell={spell}
      castAtLevel={3}
      onSummonCreated={vi.fn()}
    />
  );
  await user.click(screen.getByRole('button', { name: /My creatures/i }));
  expect(
    screen.getByRole('button', { name: 'Edit Very long first creature name' })
  ).toBeTruthy();
  await user.click(
    screen.getByRole('button', { name: 'Delete Very long first creature name' })
  );
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByText('Very long second creature name').closest('button')
    )
  );
});
