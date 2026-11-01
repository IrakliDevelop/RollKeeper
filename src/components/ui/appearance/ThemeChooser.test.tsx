import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ThemeChooser } from './ThemeChooser';
import type { Theme } from '@/types/theme';

afterEach(cleanup);
function Harness({ character = false }: { character?: boolean }) {
  const [value, setValue] = useState<Theme | undefined>(
    character ? undefined : 'dark'
  );
  return (
    <ThemeChooser character={character} value={value} onChange={setValue} />
  );
}
it('selects every app theme without offering character inheritance', () => {
  render(<Harness />);
  expect(screen.queryByRole('radio', { name: 'Use app theme' })).toBeNull();
  for (const name of ['Light', 'Dark', 'Blue dark', 'Use system theme']) {
    fireEvent.click(screen.getByRole('radio', { name }));
    expect(screen.getByRole('radio', { name })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  }
});
it('clears an explicit character choice by following the app', () => {
  render(<Harness character />);
  expect(screen.getByRole('radio', { name: 'Use app theme' })).toHaveAttribute(
    'aria-checked',
    'true'
  );
  fireEvent.click(screen.getByRole('radio', { name: 'Blue dark' }));
  expect(screen.getByRole('radio', { name: 'Blue dark' })).toHaveAttribute(
    'aria-checked',
    'true'
  );
  fireEvent.click(screen.getByRole('radio', { name: 'Use app theme' }));
  expect(screen.getByRole('radio', { name: 'Use app theme' })).toHaveAttribute(
    'aria-checked',
    'true'
  );
});
