import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  Select,
  SelectContent,
  SelectField,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

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

describe('Select menu', () => {
  afterEach(cleanup);

  function renderOpenMenu() {
    render(
      <Select defaultOpen defaultValue="medium">
        <SelectTrigger aria-label="Size">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="small">Small</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  it('floats on the elevated surface with a 1px divider, 6px radius and the overlay shadow', () => {
    renderOpenMenu();

    const menu = screen.getByRole('listbox');
    expect(menu).toHaveClass(
      'bg-surface-elevated',
      'border',
      'border-divider',
      'rounded-md',
      'shadow-overlay',
      'duration-180',
      'ease-out'
    );
    expect(menu.className).not.toMatch(/border-2|shadow-lg|rounded-lg/);
  });

  it('gives the highlighted option a brass inset outline instead of none', () => {
    renderOpenMenu();

    const option = screen.getByRole('option', { name: 'Small' });
    expect(option).toHaveClass(
      'outline-hidden',
      'data-[highlighted]:bg-surface-hover',
      'data-[highlighted]:outline-2',
      'data-[highlighted]:-outline-offset-2',
      'data-[highlighted]:outline-ring',
      'data-[highlighted]:outline-solid'
    );
  });

  it('marks the chosen option with a brass check', () => {
    renderOpenMenu();

    const check = screen
      .getByRole('option', { name: 'Medium' })
      .querySelector('svg');
    expect(check).toHaveClass('text-brass-text');
    expect(check?.getAttribute('class')).not.toMatch(/emerald/);
  });
});
