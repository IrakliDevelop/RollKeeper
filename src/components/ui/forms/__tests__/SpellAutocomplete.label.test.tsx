// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpellAutocomplete } from '@/components/ui/forms/SpellAutocomplete';

afterEach(cleanup);

describe('SpellAutocomplete label', () => {
  it('binds a visible label to the input when label is set', () => {
    render(
      <SpellAutocomplete spells={[]} onSelect={vi.fn()} label="Search spells" />
    );
    const input = screen.getByLabelText('Search spells');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('id');
  });

  it('renders no label and no input id without label', () => {
    const { container } = render(
      <SpellAutocomplete spells={[]} onSelect={vi.fn()} />
    );
    expect(container.querySelector('label')).toBeNull();
    expect(container.querySelector('input')).not.toHaveAttribute('id');
  });
});
