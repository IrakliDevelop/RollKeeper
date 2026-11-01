import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Textarea } from './textarea';

describe('Textarea', () => {
  afterEach(cleanup);

  it('shares the input chrome', () => {
    render(<Textarea aria-label="Notes" />);

    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveClass(
      'rounded-sm',
      'border',
      'border-input-border',
      'focus-visible:outline-ring'
    );
  });

  it('marks an error with a blood border, blood text and aria', () => {
    render(<Textarea label="Backstory" error="Backstory is required" />);

    const textarea = screen.getByLabelText('Backstory');
    expect(textarea).toHaveClass('border-blood-border');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAccessibleDescription('Backstory is required');
    expect(screen.getByText('Backstory is required')).toHaveClass(
      'text-blood-text'
    );
  });

  it.each([
    ['nearly full', 'a'.repeat(19), 'text-ember-text'],
    ['full', 'a'.repeat(20), 'text-blood-text'],
  ])('colours a %s character count by role', (_, value, colour) => {
    render(
      <Textarea
        aria-label="Motto"
        value={value}
        onChange={() => {}}
        maxLength={20}
        showCharacterCount
      />
    );

    expect(screen.getByText(`${value.length} / 20`)).toHaveClass(colour);
  });
});
