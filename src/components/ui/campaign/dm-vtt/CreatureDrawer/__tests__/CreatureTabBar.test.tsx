import * as Tabs from '@radix-ui/react-tabs';
import { cleanup, render, screen } from '@testing-library/react';
import { BookOpen, Swords } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';

import { CreatureTabBar } from '../CreatureTabBar';

function renderBar() {
  render(
    <Tabs.Root value="actions">
      <CreatureTabBar
        activeTab="actions"
        tabs={[
          { id: 'actions', label: 'Actions', icon: Swords },
          { id: 'statblock', label: 'Stat block', icon: BookOpen },
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
});
