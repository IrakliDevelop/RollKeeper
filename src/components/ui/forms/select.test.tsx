import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SelectField, SelectItem } from './select';

describe('SelectField', () => {
  afterEach(cleanup);

  it('draws the trigger like an input and reaches 44px on coarse pointers', () => {
    render(
      <SelectField label="Class" triggerProps={{ 'aria-label': 'Class' }}>
        <SelectItem value="fighter">Fighter</SelectItem>
      </SelectField>
    );

    expect(screen.getByRole('combobox', { name: 'Class' })).toHaveClass(
      'rounded-sm',
      'border-input-border',
      'focus-visible:outline-ring',
      'pointer-coarse:min-h-11'
    );
  });

  it('marks an error on the trigger with aria and blood text', () => {
    render(
      <SelectField
        label="Class"
        error="Pick a class"
        triggerProps={{ 'aria-label': 'Class' }}
      >
        <SelectItem value="fighter">Fighter</SelectItem>
      </SelectField>
    );

    const trigger = screen.getByRole('combobox', { name: 'Class' });
    expect(trigger).toHaveClass('border-blood-border');
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAccessibleDescription('Pick a class');
    expect(screen.getByText('Pick a class')).toHaveClass('text-blood-text');
  });

  it('names the trigger from its label', () => {
    render(
      <SelectField label="Background">
        <SelectItem value="sage">Sage</SelectItem>
      </SelectField>
    );

    expect(screen.getByLabelText('Background')).toHaveAttribute(
      'role',
      'combobox'
    );
  });

  it('leaves a valid trigger unmarked', () => {
    render(
      <SelectField label="Class" helperText="Sets your hit die">
        <SelectItem value="fighter">Fighter</SelectItem>
      </SelectField>
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).not.toHaveAttribute('aria-invalid');
    expect(trigger).toHaveAccessibleDescription('Sets your hit die');
  });
});
