import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Autocomplete } from './Autocomplete';

describe('Autocomplete', () => {
  afterEach(cleanup);

  it('draws its field with the input chrome and keeps room for the chevron', () => {
    render(
      <Autocomplete
        options={[{ value: 'longsword', label: 'Longsword' }]}
        value=""
        onChange={() => {}}
      />
    );

    expect(screen.getByRole('textbox')).toHaveClass(
      'rounded-sm',
      'border-input-border',
      'focus-visible:outline-ring',
      'pointer-coarse:min-h-11',
      'pr-10'
    );
  });

  function renderOpenList() {
    render(
      <Autocomplete
        options={[
          { value: 'longsword', label: 'Longsword' },
          { value: 'dagger', label: 'Dagger' },
        ]}
        value="longsword"
        onChange={() => {}}
      />
    );
    fireEvent.focus(screen.getByRole('textbox'));
  }

  it('names its chevron button and says whether the list is open', () => {
    render(
      <Autocomplete
        options={[{ value: 'longsword', label: 'Longsword' }]}
        value=""
        onChange={() => {}}
      />
    );

    const chevron = screen.getByRole('button', { name: 'Show options' });
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(chevron);
    expect(chevron).toHaveAttribute('aria-expanded', 'true');
  });

  it('lists options on the elevated surface with the overlay shadow', () => {
    renderOpenList();

    const list = screen.getByRole('list').parentElement;
    expect(list).toHaveClass(
      'bg-surface-elevated',
      'border',
      'border-divider',
      'rounded-md',
      'shadow-overlay'
    );
    expect(list?.className).not.toMatch(/border-2|shadow-lg|rounded-lg/);
  });

  it('marks the chosen option with a brass check and no fill', () => {
    renderOpenList();

    const chosen = screen.getByRole('button', { name: 'Longsword' });
    expect(chosen.className).not.toMatch(/accent-|emerald/);
    expect(chosen.querySelector('svg')).toHaveClass('text-brass-text');
    expect(
      screen.getByRole('button', { name: 'Dagger' }).querySelector('svg')
    ).toBeNull();
  });

  it('shows the brass focus outline on options', () => {
    renderOpenList();

    expect(screen.getByRole('button', { name: 'Dagger' })).toHaveClass(
      'focus-visible:outline-2',
      'focus-visible:-outline-offset-2',
      'focus-visible:outline-ring'
    );
  });
});
