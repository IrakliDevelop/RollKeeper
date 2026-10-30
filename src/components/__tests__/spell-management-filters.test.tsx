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

describe('SpellManagement filters', () => {
  it('keeps active filters visible after closing the filter dialog', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
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
    useCharacterStore.setState({ character: makeWizard({ spells: [spell] }) });
    render(<SpellManagement />);

    const filters = screen.getByRole('button', { name: 'Filters' });
    fireEvent.click(filters);
    expect(filters).toHaveAttribute('aria-expanded', 'true');
    const dialog = screen.getByRole('dialog', { name: 'Advanced Filters' });
    fireEvent.click(
      dialog.querySelector('button[role="checkbox"]') as HTMLElement
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(
      screen.queryByRole('dialog', { name: 'Advanced Filters' })
    ).toBeNull();
    expect(filters).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: 'Add Spell' })).toHaveAttribute(
      'data-variant',
      'primary'
    );
    expect(
      screen.getByRole('button', { name: 'Clear All Filters' })
    ).not.toHaveAttribute('data-variant', 'primary');
  });
});
