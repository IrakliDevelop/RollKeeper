import { cleanup, render, screen } from '@testing-library/react';
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
});
