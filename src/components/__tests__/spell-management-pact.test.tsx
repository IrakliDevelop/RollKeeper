import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SpellManagement } from '../SpellManagement';
import { useCharacterStore } from '@/store/characterStore';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import type { Spell } from '@/types/character';

const hex: Spell = {
  id: 'hex',
  name: 'Hex',
  level: 1,
  school: 'Enchantment',
  castingTime: '1 action',
  range: '90 feet',
  components: { verbal: true, somatic: true, material: false },
  duration: 'Concentration, up to 1 hour',
  description: 'A synthetic pact spell.',
  concentration: true,
  isPrepared: true,
  createdAt: '2026-10-30T00:00:00.000Z',
  updatedAt: '2026-10-30T00:00:00.000Z',
};

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  useCharacterStore.setState({
    character: {
      ...DEFAULT_CHARACTER_STATE,
      id: 'pact-character',
      spells: [hex],
      pactMagic: { level: 1, slots: { max: 1, used: 0 } },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SpellManagement pact casting', () => {
  it('offers a pact slot and spends only that slot when casting', () => {
    render(<SpellManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'Cast spell' }));
    fireEvent.click(
      screen.getByRole('radio', { name: /Pact slot \(level 1\)/ })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cast Hex' }));

    const character = useCharacterStore.getState().character;
    expect(character.pactMagic?.slots.used).toBe(1);
    expect(character.spellSlots[1].used).toBe(0);
    expect(character.concentration.spellName).toBe('Hex');
  });
});
