import { render, screen } from '@testing-library/react';
import { ArrowRight } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('makes an asChild link with an icon the full button element', () => {
    const { container } = render(
      <Button asChild rightIcon={<ArrowRight data-testid="arrow" />}>
        <a href="/player">Start as Player</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Start as Player' });

    expect(link).toHaveAttribute('href', '/player');
    expect(link).toHaveClass('cursor-pointer', 'h-10', 'px-5');
    expect(container.firstElementChild).toBe(link);
    expect(link).toContainElement(screen.getByTestId('arrow'));
  });
});
