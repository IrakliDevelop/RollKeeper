// @vitest-environment jsdom
import { useState } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NPCSpellListEditor } from '../NPCSpellListEditor';
import type { Spell } from '@/types/character';

vi.mock('@/hooks/useSpellsData', () => ({
  useSpellsData: () => ({
    spells: [],
    loading: false,
    error: null,
    searchResults: () => [],
    getSpellById: () => undefined,
    getSpellByName: () => undefined,
  }),
}));

afterEach(cleanup);

function makeSpell(id: string, name: string, level: number): Spell {
  return {
    id,
    name,
    level,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    description: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const FIRE_BOLT = makeSpell('s-bolt', 'Fire Bolt', 0);
const SHIELD = makeSpell('s-shield', 'Shield', 1);
const MAGIC_MISSILE = makeSpell('s-missile', 'Magic Missile', 1);
const BLESS = {
  ...makeSpell('s-bless', 'Bless', 1),
  freeCastMax: 2,
  freeCastsUsed: 1,
  tags: ['Signature'],
};

function Harness({ initial }: { initial: Spell[] }) {
  const [spells, setSpells] = useState(initial);
  return (
    <>
      <NPCSpellListEditor spells={spells} onChange={setSpells} />
      <pre data-testid="state">{JSON.stringify(spells)}</pre>
    </>
  );
}

function state(): Spell[] {
  return JSON.parse(screen.getByTestId('state').textContent ?? '[]');
}

function region() {
  return within(screen.getByRole('region', { name: 'Spells' }));
}

describe('NPCSpellListEditor', () => {
  it('shows an empty state with the add button', () => {
    render(<Harness initial={[]} />);
    expect(screen.getByRole('region', { name: 'Spells' })).toBeInTheDocument();
    expect(screen.getByText('No spells yet.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add spell' })
    ).toBeInTheDocument();
  });

  it('lists spells under level headings with only Edit and Remove buttons', () => {
    render(<Harness initial={[SHIELD, FIRE_BOLT, BLESS]} />);
    const headings = screen
      .getAllByRole('heading', { level: 4 })
      .map(h => h.textContent);
    expect(headings).toEqual(['Cantrips', 'Level 1']);
    expect(screen.getByText('2 per day')).toBeInTheDocument();
    expect(screen.queryByText('1 of 2 left')).toBeNull();
    for (const name of ['Fire Bolt', 'Shield', 'Bless']) {
      expect(
        screen.getByRole('button', { name: `Edit ${name}` })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: `Remove ${name}` })
      ).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /^Cast / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^View / })).toBeNull();
  });

  it('removes at once and moves focus to the next row, then the previous, then Add spell', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[SHIELD, MAGIC_MISSILE, BLESS]} />);

    await user.click(screen.getByRole('button', { name: 'Remove Shield' }));
    expect(state().map(s => s.name)).toEqual(['Magic Missile', 'Bless']);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Edit Magic Missile' })
      ).toHaveFocus()
    );

    await user.click(screen.getByRole('button', { name: 'Remove Bless' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Edit Magic Missile' })
      ).toHaveFocus()
    );

    await user.click(
      screen.getByRole('button', { name: 'Remove Magic Missile' })
    );
    expect(state()).toEqual([]);
    expect(screen.getByText('No spells yet.')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add spell' })).toHaveFocus()
    );
  });

  it('adds a spell through the dialog and focuses its Edit button', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[SHIELD]} />);
    await user.click(region().getByRole('button', { name: 'Add spell' }));
    const dialog = screen.getByRole('dialog', { name: 'Add spell' });
    fireEvent.change(within(dialog).getByLabelText(/Spell Name/), {
      target: { value: 'Mage Armor' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Add spell' }));
    expect(state().map(s => s.name)).toEqual(['Shield', 'Mage Armor']);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Edit Mage Armor' })
      ).toHaveFocus()
    );
  });

  it('edits a spell in place, keeping its identity, and returns focus to its Edit button', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[BLESS, SHIELD]} />);
    await user.click(screen.getByRole('button', { name: 'Edit Bless' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Bless' });
    fireEvent.change(within(dialog).getByLabelText(/Spell Name/), {
      target: { value: 'Greater Bless' },
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Save spell' })
    );
    const [edited, other] = state();
    expect(edited).toEqual(
      expect.objectContaining({
        id: 's-bless',
        name: 'Greater Bless',
        createdAt: '2026-01-01T00:00:00.000Z',
        freeCastMax: 2,
        freeCastsUsed: 1,
        tags: ['Signature'],
      })
    );
    expect(other.name).toBe('Shield');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Edit Greater Bless' })
      ).toHaveFocus()
    );
  });
});
