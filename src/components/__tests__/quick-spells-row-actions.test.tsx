import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QuickSpells } from '@/components/QuickSpells';
import { useCharacterStore } from '@/store/characterStore';
import { makeWizard } from '@/utils/__tests__/test-utils';
import type { Spell } from '@/types/character';

afterEach(cleanup);

const spell: Spell = {
  id: 'fire-bolt',
  name: 'Fire Bolt',
  level: 0,
  school: 'Evocation',
  castingTime: '1 action',
  range: '120 feet',
  components: { verbal: true, somatic: true, material: false },
  duration: 'Instantaneous',
  description: 'A bolt of fire.',
  isPrepared: true,
  actionType: 'attack',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('QuickSpells rows', () => {
  it('keeps cast, favorite, and attack actions with secondary row controls', () => {
    useCharacterStore.setState({
      character: makeWizard({
        spells: [spell],
        spellbook: { ...makeWizard().spellbook, favoriteSpells: [] },
      }),
    });
    const { container } = render(
      <QuickSpells
        showAttackRoll={vi.fn()}
        showSavingThrow={vi.fn()}
        showDamageRoll={vi.fn()}
      />
    );

    const favorite = screen.getByRole('button', { name: 'Favorite' });
    expect(container.querySelector('.lucide-sparkles')).toBeNull();
    expect(favorite).toHaveClass('pointer-coarse:min-h-11');
    expect(screen.getByTitle('Cast spell')).toHaveAttribute(
      'data-variant',
      'secondary'
    );
    fireEvent.click(screen.getByTitle('Cast spell'));
    expect(
      screen.getByRole('dialog', { name: 'Cast Fire Bolt' })
    ).toBeInTheDocument();
  });

  it('announces the view toggle by its label alone, without a pressed state', () => {
    useCharacterStore.setState({
      character: makeWizard({
        spells: [spell],
        spellbook: { ...makeWizard().spellbook, favoriteSpells: [] },
      }),
    });
    render(
      <QuickSpells
        showAttackRoll={vi.fn()}
        showSavingThrow={vi.fn()}
        showDamageRoll={vi.fn()}
      />
    );

    const toggle = screen.getByRole('button', { name: 'Detailed' });
    expect(toggle).not.toHaveAttribute('aria-pressed');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Compact' })).not.toHaveAttribute(
      'aria-pressed'
    );
  });
});
