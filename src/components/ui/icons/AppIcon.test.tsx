import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppIcon } from './AppIcon';
import { ICONS } from './iconRegistry';

describe('AppIcon', () => {
  it('renders every registered semantic icon', () => {
    for (const name of Object.keys(ICONS) as (keyof typeof ICONS)[]) {
      const { unmount } = render(<AppIcon name={name} data-testid={name} />);
      expect(screen.getByTestId(name).tagName).toBe('svg');
      unmount();
    }
  });

  it('is decorative by default and can be labelled', () => {
    const { rerender } = render(<AppIcon name="spell" data-testid="icon" />);
    expect(screen.getByTestId('icon')).toHaveAttribute('aria-hidden', 'true');

    rerender(<AppIcon name="spell" label="Spell" data-testid="icon" />);
    expect(screen.getByRole('img', { name: 'Spell' })).toBeInTheDocument();
  });
});
