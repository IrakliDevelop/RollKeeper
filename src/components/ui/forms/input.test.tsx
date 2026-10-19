import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Input } from './input';
import { NumberInput } from './NumberInput';

describe('Input', () => {
  afterEach(cleanup);

  it('draws a 4px well with a 1px input-border and a brass focus outline', () => {
    render(<Input aria-label="Name" />);

    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveClass(
      'rounded-sm',
      'border',
      'border-input-border',
      'bg-input-bg',
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-ring'
    );
    expect(input.className).not.toMatch(/ring-offset|emerald|border-2/);
  });

  it('reaches 44px on coarse pointers', () => {
    render(<Input aria-label="Name" />);

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveClass(
      'pointer-coarse:min-h-11'
    );
  });

  it('links its label without an explicit id', () => {
    render(<Input label="Character name" />);

    expect(screen.getByLabelText('Character name')).toHaveAttribute(
      'type',
      'text'
    );
  });

  it('marks an error with a blood border, blood text and aria', () => {
    render(<Input label="Level" error="Level must be 1 to 20" />);

    const input = screen.getByLabelText('Level');
    const message = screen.getByText('Level must be 1 to 20');
    expect(input).toHaveClass('border-blood-border');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Level must be 1 to 20');
    expect(message).toHaveClass('text-blood-text');
  });

  it('describes the field with its helper text and keeps a caller description', () => {
    render(
      <>
        <p id="hint">Shown on the sheet</p>
        <Input
          label="Title"
          helperText="Up to 40 letters"
          aria-describedby="hint"
        />
      </>
    );

    const input = screen.getByLabelText('Title');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveAccessibleDescription(
      'Shown on the sheet Up to 40 letters'
    );
    expect(screen.getByText('Up to 40 letters')).toHaveClass('text-body');
  });

  it('treats the success variant as the default field', () => {
    render(
      <>
        <Input aria-label="Plain" />
        <Input aria-label="Success" variant="success" />
      </>
    );

    expect(screen.getByRole('textbox', { name: 'Success' }).className).toBe(
      screen.getByRole('textbox', { name: 'Plain' }).className
    );
  });

  it('marks the required asterisk in blood', () => {
    render(<Input label="Name" required />);

    expect(screen.getByLabelText('required')).toHaveClass('text-blood-text');
  });

  it('passes the same chrome to NumberInput', () => {
    render(<NumberInput aria-label="HP" value={7} onChange={() => {}} />);

    expect(screen.getByRole('textbox', { name: 'HP' })).toHaveClass(
      'rounded-sm',
      'border-input-border'
    );
  });
});
