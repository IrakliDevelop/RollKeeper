import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SpellManagement } from '@/components/SpellManagement';
import { useCharacterStore } from '@/store/characterStore';
import { makeWizard } from '@/utils/__tests__/test-utils';

afterEach(cleanup);

describe('SpellManagement filters', () => {
  it('keeps active filters visible after closing the filter dialog', () => {
    useCharacterStore.setState({ character: makeWizard() });
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
  });
});
