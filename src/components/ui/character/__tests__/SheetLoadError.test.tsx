import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { SheetLoadError } from '../SheetLoadError';
afterEach(cleanup);
it('names the player-facing section and provides a reload action in a plain fallback', () => {
  const { container } = render(<SheetLoadError thing="Hit points" />);
  expect(screen.getByText("Hit points didn't load.")).toBeVisible();
  expect(screen.getByRole('button', { name: 'Reload page' })).toHaveAttribute(
    'type',
    'button'
  );
  expect(container.firstElementChild?.className).not.toMatch(
    /shadow|rounded|bg-|border/
  );
});
