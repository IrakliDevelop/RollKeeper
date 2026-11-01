import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ClassPickerStep from './ClassPickerStep';

afterEach(cleanup);

it('renders repeated class names without duplicate React keys', () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const fighter = {
    className: 'Fighter',
    level: 2,
    isCustom: false,
    hitDie: 10,
  };
  render(
    <ClassPickerStep
      classes={[fighter, { ...fighter, level: 3 }]}
      selectedIndex={0}
      onSelect={vi.fn()}
    />
  );
  expect(errors.mock.calls.map(call => call.join(' ')).join(' ')).not.toMatch(
    /same key/
  );
  errors.mockRestore();
});
