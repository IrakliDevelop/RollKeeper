import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Badge } from './badge';

describe('Badge', () => {
  afterEach(cleanup);

  it('defaults to the neutral variant', () => {
    render(<Badge>Level 3</Badge>);

    const badge = screen.getByText('Level 3');
    expect(badge).toHaveAttribute('data-variant', 'neutral');
    expect(badge).toHaveClass('border-input-border', 'text-heading');
  });

  it('draws a role-coloured outline with no fill', () => {
    render(
      <>
        <Badge variant="primary">Inspired</Badge>
        <Badge variant="success">Healed</Badge>
        <Badge variant="warning">Poisoned</Badge>
        <Badge variant="danger">Dying</Badge>
        <Badge variant="magic">Concentrating</Badge>
      </>
    );

    const roles = [
      ['Inspired', 'brass'],
      ['Healed', 'verdigris'],
      ['Poisoned', 'ember'],
      ['Dying', 'blood'],
      ['Concentrating', 'lapis'],
    ];
    for (const [text, role] of roles) {
      const badge = screen.getByText(text);
      expect(badge).toHaveClass(`border-${role}-border`, `text-${role}-text`);
      expect(badge.className).not.toMatch(/\bbg-/);
      expect(badge).toHaveClass('rounded-[3px]', 'border');
    }
  });

  it('renders info, secondary and outline as neutral', () => {
    render(
      <>
        <Badge variant="neutral">Neutral</Badge>
        <Badge variant="info">Info</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
      </>
    );

    const neutral = screen.getByText('Neutral').className;
    expect(screen.getByText('Info').className).toBe(neutral);
    expect(screen.getByText('Secondary').className).toBe(neutral);
    expect(screen.getByText('Outline').className).toBe(neutral);
    expect(screen.getByText('Info')).toHaveAttribute('data-variant', 'info');
  });
});
