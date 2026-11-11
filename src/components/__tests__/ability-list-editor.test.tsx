// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
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
        section="actions"
        items={items}
        onChange={setItems}
        resources={resources}
      />
      <button
        onClick={() =>
          setItems([
            { name: 'A', text: '' },
            { name: 'B', text: '' },
            { name: 'C', text: '' },
          ])
        }
      >
        Replace from outside
      </button>
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
      const option = screen.getByRole('option', { name: 'Wild Shape' });
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

const BITE_CLAW: StatBlockEntry[] = [
  { name: 'Bite', text: '<p>Bite text</p>' },
  { name: 'Claw', text: '<p>Claw text</p>' },
];

const region = () => screen.getByRole('region', { name: 'Actions' });
const nameInputs = () =>
  within(region()).getAllByRole('textbox', { name: 'Name' });
const stateOf = () =>
  JSON.parse(screen.getByTestId('state').textContent ?? '[]') as Record<
    string,
    unknown
  >[];

describe('AbilityListEditor — section and rows', () => {
  it('renders the section heading, Add action button and empty line', () => {
    render(<Harness initial={[]} />);
    expect(
      within(region()).getByRole('button', { name: 'Add action' })
    ).toBeInTheDocument();
    expect(screen.getByText('No actions yet.')).toBeInTheDocument();
  });

  it("keeps each row's DOM nodes when moving an entry (bug 10)", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness initial={BITE_CLAW} />);
    await waitFor(() =>
      expect(container.querySelectorAll('.ProseMirror')).toHaveLength(2)
    );
    const input = nameInputs()[0];
    const editor = container.querySelectorAll('.ProseMirror')[0];
    const rows = container.querySelectorAll('li');

    await user.click(screen.getByRole('button', { name: 'Move Bite down' }));

    expect(nameInputs()[1]).toBe(input);
    expect(input).toHaveValue('Bite');
    const secondRow = container.querySelectorAll('li')[1];
    expect(secondRow).toBe(rows[0]);
    expect(secondRow.contains(editor)).toBe(true);
    expect(editor).toHaveTextContent('Bite text');
    expect(stateOf().map(e => e.name)).toEqual(['Claw', 'Bite']);
    expect(screen.getByRole('button', { name: 'Move Bite up' })).toHaveFocus();
  });

  it('keeps nodes when removing', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          { name: 'One', text: '' },
          { name: 'Two', text: '' },
          { name: 'Three', text: '' },
        ]}
      />
    );
    const third = nameInputs()[2];
    await user.click(screen.getByRole('button', { name: 'Remove One' }));
    expect(third).toBeInTheDocument();
    expect(third).toHaveValue('Three');
    expect(nameInputs()).toHaveLength(2);
  });

  it('renders a longer list replaced from outside without duplicate keys', async () => {
    const user = userEvent.setup();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Harness initial={[{ name: 'Bite', text: '' }]} />);
    try {
      await user.click(
        screen.getByRole('button', { name: 'Replace from outside' })
      );
      expect(nameInputs()).toHaveLength(3);
      expect(
        errors.mock.calls.filter(call => /key/.test(String(call[0])))
      ).toHaveLength(0);
    } finally {
      errors.mockRestore();
    }
  });

  it('new entries carry no id', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[]} />);
    await user.click(screen.getByRole('button', { name: 'Add action' }));
    await user.type(nameInputs()[0], 'Bite');
    const [entry] = stateOf();
    expect(entry.name).toBe('Bite');
    expect('id' in entry).toBe(false);
  });

  it('Add focuses the new Name', async () => {
    const user = userEvent.setup();
    render(<Harness initial={BITE_CLAW} />);
    await user.click(screen.getByRole('button', { name: 'Add action' }));
    await waitFor(() => expect(nameInputs()[2]).toHaveFocus());
  });

  it('Remove focuses the next Name, else the previous, else Add action', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          { name: 'One', text: '' },
          { name: 'Two', text: '' },
          { name: 'Three', text: '' },
        ]}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Remove Two' }));
    await waitFor(() => expect(nameInputs()[1]).toHaveFocus());
    expect(nameInputs()[1]).toHaveValue('Three');
    await user.click(screen.getByRole('button', { name: 'Remove Three' }));
    await waitFor(() => expect(nameInputs()[0]).toHaveFocus());
    expect(nameInputs()[0]).toHaveValue('One');
    await user.click(screen.getByRole('button', { name: 'Remove One' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add action' })).toHaveFocus()
    );
  });

  it('Move up on the second of two focuses Move down on the same row', async () => {
    const user = userEvent.setup();
    render(<Harness initial={BITE_CLAW} />);
    await user.click(screen.getByRole('button', { name: 'Move Claw up' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Move Claw down' })
      ).toHaveFocus()
    );
  });

  it('names row controls', () => {
    render(
      <Harness
        initial={[
          { name: 'Bite', text: '' },
          { name: ' ', text: '' },
        ]}
      />
    );
    expect(screen.getByRole('button', { name: 'Move Bite up' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Move Bite down' })
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove Bite' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Remove unnamed action' })
    ).toBeEnabled();
  });

  it('labels uses and cost', async () => {
    const user = userEvent.setup();
    render(
      <Harness initial={[{ name: 'Bite', text: '' }]} resources={RESOURCES} />
    );
    expect(
      screen.getByRole('textbox', { name: 'Uses per day' })
    ).toHaveAccessibleDescription('Leave empty for unlimited.');
    const cost = screen.getByRole('combobox', { name: 'Resource cost' });
    expect(cost).toHaveTextContent('No resource cost');
    await user.click(cost);
    fireEvent.click(await screen.findByRole('option', { name: 'Wild Shape' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Uses spent' })).toBeVisible()
    );
    expect(stateOf()[0].resourceCost).toEqual({
      resourceId: 'res-1',
      amount: 1,
    });
  });

  it('keeps a sensible keyboard order in a row', async () => {
    // Tab skips disabled buttons, so the first and last rows cannot show the
    // full order; the middle row can.
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          { name: 'One', text: '' },
          {
            name: 'Two',
            text: '',
            resourceCost: { resourceId: 'res-1', amount: 1 },
          },
          { name: 'Three', text: '' },
        ]}
        resources={RESOURCES}
      />
    );
    await user.click(nameInputs()[1]);
    const expected = [
      'Uses per day',
      'Move Two up',
      'Move Two down',
      'Remove Two',
      'Resource cost',
      'Uses spent',
    ];
    for (const name of expected) {
      await user.tab();
      expect(document.activeElement).toHaveAccessibleName(name);
    }
  });

  it('names the editor Description', () => {
    const { container } = render(<Harness initial={BITE_CLAW} />);
    expect(
      container.querySelectorAll('[aria-label="Description"]')
    ).toHaveLength(2);
  });
});
