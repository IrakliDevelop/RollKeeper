import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Brand } from './Brand';
afterEach(cleanup);
it('links the brass single-path keyhole and responsive wordmark home', () => {
  render(<Brand />);
  const link = screen.getByRole('link', { name: 'RollKeeper home' });
  expect(link).toHaveAttribute('href', '/');
  expect(link.querySelectorAll('path')).toHaveLength(1);
  expect(link.querySelector('svg')).toHaveClass('fill-brass-fill');
  expect(screen.getByText('RollKeeper')).toHaveClass('hidden', 'sm:inline');
});
