import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QuickSpells } from '../QuickSpells';
import { SpellManagement } from '../SpellManagement';
import { useCharacterStore } from '@/store/characterStore';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import type { Spell } from '@/types/character';

const spell: Spell = {
  id: 'shield',
  name: 'Shield',
  level: 1,
  school: 'Abjuration',
  castingTime: '1 reaction',
  range: 'Self',
  components: { verbal: true, somatic: false, material: false },
  duration: '1 round',
  description: 'Shield',
  isPrepared: true,
  createdAt: '2026-10-29T00:00:00.000Z',
  updatedAt: '2026-10-29T00:00:00.000Z',
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
      id: 'test-character',
      spells: [spell],
      spellSlots: {
        ...DEFAULT_CHARACTER_STATE.spellSlots,
        1: { max: 4, used: 1 },
      },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('spell level headers', () => {
  it('shows static slot pips in QuickSpells', () => {
    render(
      <QuickSpells
        showAttackRoll={vi.fn()}
        showSavingThrow={vi.fn()}
        showDamageRoll={vi.fn()}
      />
    );
    expect(
      screen.getByRole('img', { name: '3 of 4 level 1 slots available' })
    ).toBeInTheDocument();
  });

  it('shows static slot pips in SpellManagement', () => {
    render(<SpellManagement />);
    expect(
      screen.getByRole('img', { name: '3 of 4 level 1 slots available' })
    ).toBeInTheDocument();
  });
});
