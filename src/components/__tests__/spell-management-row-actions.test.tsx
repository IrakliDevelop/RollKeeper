import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SpellManagement } from '@/components/SpellManagement';
import { useCharacterStore } from '@/store/characterStore';
import { makeWizard } from '@/utils/__tests__/test-utils';
import type { Spell } from '@/types/character';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const spell: Spell = {
  id: 'shield',
  name: 'Shield',
  level: 1,
  school: 'Abjuration',
  castingTime: '1 reaction',
  range: 'Self',
  components: { verbal: true, somatic: true, material: false },
  duration: '1 round',
  description: 'A protective barrier.',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('SpellManagement row actions', () => {
  it('keeps favorite and preparation actions accessible beside a secondary Cast', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
    useCharacterStore.setState({
      character: makeWizard({
        spells: [spell],
        spellbook: {
          ...makeWizard().spellbook,
          favoriteSpells: [],
        },
      }),
    });
    render(<SpellManagement />);

    const favorite = screen.getByRole('button', { name: 'Favorite' });
    expect(favorite).toHaveAttribute('aria-pressed', 'false');
    expect(favorite).toHaveClass('pointer-coarse:min-h-11');
    fireEvent.click(favorite);
    expect(favorite).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Prepare' }));
    expect(
      screen.getByRole('button', { name: 'Prepared' })
    ).toBeInTheDocument();
    expect(screen.getByTitle('Cast spell')).toHaveAttribute(
      'data-variant',
      'secondary'
    );
  });
});
