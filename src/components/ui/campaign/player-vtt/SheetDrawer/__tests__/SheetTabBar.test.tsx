import * as Tabs from '@radix-ui/react-tabs';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SheetTabBar } from '../SheetTabBar';

describe('SheetTabBar', () => {
  afterEach(cleanup);

  it('marks the tab matching the Tabs root as selected', () => {
    render(
      <Tabs.Root value="overview">
        <SheetTabBar
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'spells', label: 'Spells' },
          ]}
        />
      </Tabs.Root>
    );

    const overview = screen.getByRole('tab', { name: 'Overview' });
    expect(overview).toHaveAttribute('aria-selected', 'true');
    expect(overview).toHaveAttribute('data-state', 'active');
    const spells = screen.getByRole('tab', { name: 'Spells' });
    expect(spells).toHaveAttribute('aria-selected', 'false');
    expect(spells).toHaveAttribute('data-state', 'inactive');
  });

  it('reaches 44px on coarse pointers', () => {
    render(
      <Tabs.Root value="overview">
        <SheetTabBar tabs={[{ id: 'overview', label: 'Overview' }]} />
      </Tabs.Root>
    );

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveClass(
      'pointer-coarse:min-h-11'
    );
  });
});
