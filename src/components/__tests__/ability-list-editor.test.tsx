// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AbilityListEditor } from '@/components/ui/campaign/AbilityListEditor';
import type { NpcResourceDraft } from '@/utils/npcResources';
import type { StatBlockEntry } from '@/types/encounter';

afterEach(() => {
  cleanup();
});

const RESOURCES: NpcResourceDraft[] = [
  {
    id: 'res-1',
    name: 'Wild Shape',
    icon: 'paw-print',
    color: 'emerald',
    displayStyle: 'pips',
    maxUses: 4,
    usesExpended: 0,
    shortRestReset: 1,
  },
];

function Harness({
  initial,
  resources,
}: {
  initial: StatBlockEntry[];
  resources?: NpcResourceDraft[];
}) {
  const [items, setItems] = useState(initial);
  return (
    <div>
      <AbilityListEditor
        label="Actions"
        items={items}
        onChange={setItems}
        resources={resources}
      />
      <pre data-testid="state">{JSON.stringify(items)}</pre>
    </div>
  );
}

describe('AbilityListEditor — resource cost link', () => {
  it('hides cost controls when no resources exist', () => {
    render(<Harness initial={[{ name: 'Bite', text: 'chomp' }]} />);
    expect(screen.queryByText('No resource cost')).not.toBeInTheDocument();
  });

  it('renders cost controls when resources exist', () => {
    render(
      <Harness
        initial={[{ name: 'Bite', text: 'chomp' }]}
        resources={RESOURCES}
      />
    );
    expect(screen.getByText('No resource cost')).toBeInTheDocument();
  });

  it('entry keeps its own uses field independent of the cost link', () => {
    render(
      <Harness
        initial={[
          {
            name: 'Bite',
            text: 'chomp',
            uses: 3,
            resourceCost: { resourceId: 'res-1', amount: 2 },
          },
        ]}
        resources={RESOURCES}
      />
    );
    const state = JSON.parse(
      screen.getByTestId('state').textContent ?? '[]'
    ) as StatBlockEntry[];
    expect(state[0].uses).toBe(3);
    expect(state[0].resourceCost?.amount).toBe(2);
  });

  it('selecting a resource via Costs select sets resourceCost with default amount 1', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[{ name: 'Bite', text: 'chomp' }]}
        resources={RESOURCES}
      />
    );

    // Open the cost select
    const costSelectButtons = screen.getAllByRole('combobox');
    const costSelect = costSelectButtons[costSelectButtons.length - 1];
    await user.click(costSelect);

    // Find and click the resource option
    await waitFor(() => {
      const option = screen.getByRole('option', { name: /Costs: Wild Shape/ });
      expect(option).toBeInTheDocument();
      fireEvent.click(option);
    });

    // Verify the state was updated with the resource cost
    await waitFor(() => {
      const state = JSON.parse(
        screen.getByTestId('state').textContent ?? '[]'
      ) as StatBlockEntry[];
      expect(state[0].resourceCost).toEqual({ resourceId: 'res-1', amount: 1 });
    });
  });
});
