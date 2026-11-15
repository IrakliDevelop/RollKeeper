import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { SpellManagement } from '@/components/SpellManagement';
import { useCharacterStore } from '@/store/characterStore';
import { makeWizard } from '@/utils/__tests__/test-utils';
import type { Spell } from '@/types/character';

const spells: Spell[] = [
  { name: 'Shield', isPrepared: true },
  { name: 'Alarm', isPrepared: false },
  { name: 'Bless', isAlwaysPrepared: true },
].map((spell, index) => ({
  id: `spell-${index}`,
  level: 1,
  school: 'Abjuration',
  castingTime: '1 action',
  range: 'Self',
  components: { verbal: true, somatic: true, material: false },
  duration: '1 round',
  description: 'A test spell.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...spell,
}));

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify([]))
  );
  useCharacterStore.setState({ character: makeWizard({ spells }) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function names() {
  return within(screen.getByRole('region', { name: 'Level 1' }))
    .getAllByText(/^(Shield|Alarm|Bless)$/)
    .map(node => node.textContent);
}

function selectSort(name: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Sort spells' }), {
    key: 'Enter',
  });
  fireEvent.click(screen.getByRole('option', { name }));
}

describe('player spell sorting', () => {
  it('sorts both alphabetic directions and restores manual order without changing the character', () => {
    render(<SpellManagement editing />);
    expect(names()).toEqual(['Shield', 'Alarm', 'Bless']);
    selectSort('Name (A–Z)');
    expect(names()).toEqual(['Alarm', 'Bless', 'Shield']);
    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull();
    selectSort('Name (Z–A)');
    expect(names()).toEqual(['Shield', 'Bless', 'Alarm']);
    selectSort('Manual order');
    expect(names()).toEqual(['Shield', 'Alarm', 'Bless']);
    expect(useCharacterStore.getState().character.spells).toEqual(spells);
  });

  it('puts prepared and always-prepared spells first and re-sorts when preparation changes', () => {
    render(<SpellManagement />);
    selectSort('Prepared first');
    expect(names()).toEqual(['Bless', 'Shield', 'Alarm']);
    fireEvent.click(screen.getByRole('button', { name: 'Prepare' }));
    expect(names()).toEqual(['Alarm', 'Bless', 'Shield']);
    expect(
      screen.getByRole('button', { name: 'Always prepared' })
    ).toBeDisabled();
  });
});
