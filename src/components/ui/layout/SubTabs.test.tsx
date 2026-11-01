import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { SubTabs } from './SubTabs';
afterEach(cleanup);
it('uses caller values and ids with arrow-key activation and associated panels', async () => {
  const user = userEvent.setup();
  render(
    <SubTabs
      defaultValue="weapons"
      label="Inventory"
      tabs={[
        {
          value: 'weapons',
          id: 'kept-weapons',
          label: 'Weapons',
          content: <p>Longsword</p>,
        },
        {
          value: 'items',
          id: 'kept-items',
          label: 'Items',
          content: <p>Rope</p>,
        },
      ]}
    />
  );
  const weapons = screen.getByRole('tab', { name: 'Weapons' });
  expect(weapons).toHaveAttribute('id', 'kept-weapons');
  expect(weapons).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Weapons');
  weapons.focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Items' })).toHaveFocus();
  expect(screen.getByRole('tab', { name: 'Items' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Rope');
});

it('hides vertical overflow on the tab strip so no scrollbar shows beside it', () => {
  render(
    <SubTabs
      defaultValue="a"
      label="Strip"
      tabs={[{ value: 'a', id: 'strip-a', label: 'A', content: <p>A</p> }]}
    />
  );
  expect(screen.getByRole('tablist')).toHaveClass(
    'overflow-x-auto',
    'overflow-y-hidden'
  );
});
