import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  makeCharacter,
  makeWarlock,
  makeWizard,
} from '@/utils/__tests__/test-utils';
import type { CharacterState, Spell } from '@/types/character';
import { sentenceCase } from '../shared';
import { SpellsTab } from '../SpellsTab';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function makeSpell(
  overrides: Partial<Spell> & Pick<Spell, 'name' | 'level'>
): Spell {
  return {
    id: `spell-${overrides.name.toLowerCase().replace(/\s+/g, '-')}`,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    description: 'Test spell description.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const emptySlots = {
  1: { max: 0, used: 0 },
  2: { max: 0, used: 0 },
  3: { max: 0, used: 0 },
  4: { max: 0, used: 0 },
  5: { max: 0, used: 0 },
  6: { max: 0, used: 0 },
  7: { max: 0, used: 0 },
  8: { max: 0, used: 0 },
  9: { max: 0, used: 0 },
};

function wizard(): CharacterState {
  return makeWizard({
    level: 5,
    totalLevel: 5,
    spellSlots: { ...emptySlots, 1: { max: 4, used: 1 } },
    spells: [
      makeSpell({ name: 'Fire Bolt', level: 0 }),
      makeSpell({ name: 'Magic Missile', level: 1, isPrepared: true }),
      makeSpell({
        name: 'Identify',
        level: 1,
        isPrepared: false,
        ritual: true,
      }),
      makeSpell({
        name: 'Bless',
        level: 1,
        isPrepared: true,
        concentration: true,
      }),
    ],
  });
}

describe('SpellsTab', () => {
  it('states ability, spell attack and save DC on one line', () => {
    render(<SpellsTab char={wizard()} />);
    expect(screen.getByText(/^Intelligence/)).toHaveTextContent(
      'Intelligence · Spell attack +7 · Spell save DC 15'
    );
  });

  it('shows each level as a section with its slots', () => {
    render(<SpellsTab char={wizard()} />);
    expect(
      screen.getByRole('heading', { level: 4, name: 'Level 1' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '3 of 4 level 1 slots available' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 4, name: 'Cantrips' })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('img', { name: /slots available/ })
    ).toHaveLength(1);
    expect(
      within(screen.getByRole('button', { name: 'Level 1' })).queryByRole('img')
    ).toBeNull();
  });

  it('collapses a level from its heading', async () => {
    const user = userEvent.setup();
    render(<SpellsTab char={wizard()} />);
    const toggle = screen.getByRole('button', { name: 'Level 1' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Magic Missile')).toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Magic Missile')).toBeNull();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Magic Missile')).toBeInTheDocument();
  });

  it('shows pact magic with its slots', () => {
    render(
      <SpellsTab
        char={makeWarlock({
          level: 5,
          totalLevel: 5,
          spells: [makeSpell({ name: 'Eldritch Blast', level: 0 })],
          spellSlots: { ...emptySlots },
          pactMagic: { slots: { max: 2, used: 1 }, level: 3 },
        })}
      />
    );
    expect(
      screen.getByRole('heading', { name: 'Pact magic, level 3' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '1 of 2 pact slots available' })
    ).toBeInTheDocument();
  });

  it('names each view button and opens the spell', async () => {
    const user = userEvent.setup();
    render(<SpellsTab char={wizard()} />);
    await user.click(
      screen.getByRole('button', { name: 'View Magic Missile' })
    );
    expect(
      screen.getByRole('dialog', { name: 'Magic Missile' })
    ).toBeInTheDocument();
  });

  it('marks prepared and concentration spells in words', () => {
    render(<SpellsTab char={wizard()} />);
    expect(screen.getAllByRole('img', { name: 'Prepared' })).toHaveLength(2);
    expect(screen.getAllByText('Not prepared')).toHaveLength(1);
    expect(screen.getByText('Concentration')).toHaveAttribute(
      'data-variant',
      'magic'
    );
    expect(screen.getByText('Ritual')).toBeInTheDocument();
    expect(screen.queryByText('C')).toBeNull();
    expect(screen.queryByText('R')).toBeNull();
    expect(screen.queryByText('L1')).toBeNull();
  });

  it('says so when nothing is synced', () => {
    render(<SpellsTab char={makeCharacter({ spells: [] })} />);
    expect(screen.getByText('No spells synced')).toBeInTheDocument();
  });
});

describe('sentenceCase', () => {
  it('upper-cases the first letter and leaves the rest', () => {
    expect(sentenceCase('very rare')).toBe('Very rare');
    expect(sentenceCase('heavy')).toBe('Heavy');
    expect(sentenceCase('')).toBe('');
  });
});
