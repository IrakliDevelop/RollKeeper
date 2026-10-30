import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SpellAutocomplete } from '@/components/ui/forms/SpellAutocomplete';
import type { ProcessedSpell } from '@/types/spells';

afterEach(cleanup);

describe('SpellAutocomplete', () => {
  it('keeps keyboard selection and gives results and clear controls touch targets', () => {
    const onSelect = vi.fn();
    render(
      <SpellAutocomplete
        spells={[
          {
            id: 'fireball',
            name: 'Fireball',
            schoolName: 'Evocation',
            level: 3,
            source: 'PHB',
          } as ProcessedSpell,
        ]}
        onSelect={onSelect}
      />
    );
    const input = screen.getByPlaceholderText(
      'Search spells from spellbook...'
    );
    fireEvent.change(input, { target: { value: 'fire' } });
    const result = screen.getByRole('button', { name: /Fireball/ });
    expect(result).toHaveClass('pointer-coarse:min-h-11');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(input).toHaveClass('pointer-coarse:text-base');
  });
});
