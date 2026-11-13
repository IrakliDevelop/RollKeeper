import * as Tabs from '@radix-ui/react-tabs';
import { cleanup, render, screen } from '@testing-library/react';
import { Activity, BookOpen, Swords } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';

import { CreatureTabBar } from '../CreatureTabBar';

function renderBar() {
  render(
    <Tabs.Root value="actions">
      <CreatureTabBar
        tabs={[
          { id: 'actions', label: 'Actions', icon: Swords },
          { id: 'statblock', label: 'Stat block', icon: BookOpen },
          { id: 'effects', label: 'Effects', icon: Activity, count: 2 },
        ]}
      />
    </Tabs.Root>
  );
}

describe('CreatureTabBar', () => {
  afterEach(cleanup);

  it('keeps its sticky strip on the drawer’s elevated surface', () => {
    renderBar();

    const list = screen.getByRole('tablist');
    expect(list).toHaveClass('sticky', 'bg-surface-elevated');
    expect(list).not.toHaveClass('bg-surface-raised');
  });

  it('marks the active tab through Radix state', () => {
    renderBar();

    const active = screen.getByRole('tab', { name: 'Actions' });
    expect(active).toHaveAttribute('aria-selected', 'true');
    expect(active).toHaveAttribute('data-state', 'active');
    const inactive = screen.getByRole('tab', { name: 'Stat block' });
    expect(inactive).toHaveAttribute('aria-selected', 'false');
    expect(inactive).toHaveAttribute('data-state', 'inactive');
  });

  it('shows the effects count inline in the tab, not in a block element', () => {
    renderBar();

    const tab = screen.getByRole('tab', { name: /effects/i });
    expect(tab).toHaveTextContent('Effects2');
    expect(tab.querySelector('div')).toBeNull();
  });

  it('reaches 44px on coarse pointers', () => {
    renderBar();

    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveClass('pointer-coarse:min-h-11');
    }
  });
});
