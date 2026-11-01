import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RadioGroup, RadioGroupField, RadioGroupItem } from './radio-group';

describe('RadioGroup', () => {
  afterEach(cleanup);

  it('fills the chosen radio brass with an on-brass dot', () => {
    render(
      <RadioGroup aria-label="Rest" defaultValue="short">
        <RadioGroupItem value="short" aria-label="Short rest" />
        <RadioGroupItem value="long" aria-label="Long rest" />
      </RadioGroup>
    );

    const short = screen.getByRole('radio', { name: 'Short rest' });
    expect(short).toHaveAttribute('data-state', 'checked');
    expect(short).toHaveClass(
      'border-input-border',
      'data-[state=checked]:bg-brass-fill',
      'focus-visible:outline-ring',
      'pointer-coarse:after:size-11'
    );
    expect(short.querySelector('.text-on-brass')).not.toBeNull();
    expect(short.className).not.toMatch(/emerald|ring-offset/);
  });

  it('marks the chosen card option from data-state, outside a form', () => {
    render(
      <RadioGroup aria-label="Rest" defaultValue="short">
        <RadioGroupItem value="short" label="Short rest" variant="card" />
        <RadioGroupItem value="long" label="Long rest" variant="card" />
      </RadioGroup>
    );

    const card = screen.getByText('Short rest').closest('label');
    expect(card).toHaveClass(
      'rounded-md',
      'border',
      'has-data-[state=checked]:border-brass-border'
    );
    expect(card?.className).not.toMatch(/has-\[:checked\]|shadow/);

    fireEvent.click(screen.getByRole('radio', { name: 'Long rest' }));
    expect(screen.getByRole('radio', { name: 'Long rest' })).toHaveAttribute(
      'data-state',
      'checked'
    );
  });

  it('names each radio from its label and the group from the field label', () => {
    render(
      <RadioGroupField label="Rest" defaultValue="short">
        <RadioGroupItem
          value="short"
          label="Short rest"
          description="One hour"
        />
      </RadioGroupField>
    );

    expect(screen.getByRole('radiogroup', { name: 'Rest' })).toBeTruthy();
    const short = screen.getByRole('radio', { name: 'Short rest' });
    expect(short).toHaveAccessibleDescription('One hour');
    expect(short.closest('label')).toHaveClass(
      'pointer-coarse:min-h-11',
      'pointer-coarse:pt-3'
    );
  });

  it('describes the group and marks an error', () => {
    render(
      <RadioGroupField label="Rest" error="Pick a rest" required>
        <RadioGroupItem value="short" aria-label="Short rest" />
      </RadioGroupField>
    );

    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAccessibleDescription('Pick a rest');
    expect(screen.getByText('Pick a rest')).toHaveClass('text-blood-text');
    expect(screen.getByLabelText('required')).toHaveClass('text-blood-text');
  });
});
