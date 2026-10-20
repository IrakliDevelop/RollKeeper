import * as Tabs from '@radix-ui/react-tabs';
import { cleanup, render, screen } from '@testing-library/react';
import { LayoutGrid, Wand2 } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';

import { SheetTabBar } from '../SheetTabBar';

describe('SheetTabBar', () => {
  afterEach(cleanup);

  it('underlines the active tab in brass', () => {
    render(
      <Tabs.Root value="overview">
        <SheetTabBar
          activeTab="overview"
          tabs={[
            { id: 'overview', label: 'Overview', icon: LayoutGrid },
            { id: 'spells', label: 'Spells', icon: Wand2 },
          ]}
        />
      </Tabs.Root>
    );

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveClass(
      'border-brass-fill',
      'text-heading'
    );
    expect(screen.getByRole('tab', { name: 'Spells' })).toHaveClass(
      'border-transparent'
    );
    expect(screen.getByRole('tablist').innerHTML).not.toMatch(/accent-emerald/);
  });
});
