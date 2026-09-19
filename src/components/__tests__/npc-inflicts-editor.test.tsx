// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NpcInflictsEditor } from '@/components/ui/campaign/NpcInflictsEditor';
import type { CustomCondition } from '@/types/encounter';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const webbed: CustomCondition = {
  id: 'cc-web',
  name: 'Webbed',
  description: 'Restrained by sticky webbing.',
  icon: 'link',
  kind: 'debuff',
};
const venom: CustomCondition = {
  id: 'cc-venom',
  name: 'Spider Venom',
  description: 'Poison damage each turn.',
  icon: 'droplet',
  kind: 'debuff',
};

function Harness({
  initial = [],
  initialLibrary = [webbed, venom],
  onSnapshot = vi.fn(),
  onCreate = vi.fn(),
}: {
  initial?: CustomCondition[];
  initialLibrary?: CustomCondition[];
  onSnapshot?: (next: CustomCondition[]) => void;
  onCreate?: (condition: CustomCondition) => void;
}) {
  const [conditions, setConditions] = useState(initial);
  const [library, setLibrary] = useState(initialLibrary);
  return (
    <NpcInflictsEditor
      conditions={conditions}
      library={library}
      onChange={next => {
        setConditions(next);
        onSnapshot(next);
      }}
      onCreateInLibrary={condition => {
        setLibrary(prev => [...prev, condition]);
        onCreate(condition);
      }}
    />
  );
}

async function pick(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(
    screen.getByRole('combobox', { name: 'Add inflicted condition' })
  );
  fireEvent.click(await screen.findByRole('option', { name }));
}

describe('NpcInflictsEditor', () => {
  it('renders an empty state', () => {
    render(<Harness />);
    expect(screen.getByText('Inflicts')).toBeTruthy();
    expect(screen.getByText(/No inflicted conditions/i)).toBeTruthy();
  });

  it('attaches full copies from the library; consecutive picks both fire (sentinel value)', async () => {
    const user = userEvent.setup();
    const onSnapshot = vi.fn();
    render(<Harness onSnapshot={onSnapshot} />);

    await pick(user, /^Webbed$/);
    await pick(user, /^Spider Venom$/);

    expect(onSnapshot).toHaveBeenLastCalledWith([webbed, venom]);
    expect(screen.getByText('Webbed')).toBeTruthy();
    expect(screen.getByText('Spider Venom')).toBeTruthy();
  });

  it('can re-add a condition after removing it and hides already-attached options', async () => {
    const user = userEvent.setup();
    const onSnapshot = vi.fn();
    render(<Harness initial={[webbed]} onSnapshot={onSnapshot} />);

    await user.click(
      screen.getByRole('combobox', { name: 'Add inflicted condition' })
    );
    const venomOption = await screen.findByRole('option', {
      name: /^Spider Venom$/,
    });
    // Already attached → not offered again.
    expect(screen.queryByRole('option', { name: /^Webbed$/ })).toBeNull();
    fireEvent.click(venomOption);
    expect(onSnapshot).toHaveBeenLastCalledWith([webbed, venom]);

    await user.click(screen.getByRole('button', { name: 'Remove Webbed' }));
    expect(onSnapshot).toHaveBeenLastCalledWith([venom]);
    await pick(user, /^Webbed$/);
    expect(onSnapshot).toHaveBeenLastCalledWith([venom, webbed]);
  });

  it('shows the LIBRARY version of an attached copy (library wins by id)', () => {
    render(
      <Harness
        initial={[{ ...webbed, name: 'Old Web Name' }]}
        initialLibrary={[webbed]}
      />
    );
    expect(screen.getByText('Webbed')).toBeTruthy();
    expect(screen.queryByText('Old Web Name')).toBeNull();
  });

  it('creates a condition inline, adds it to the library AND attaches it', async () => {
    const user = userEvent.setup();
    const onSnapshot = vi.fn();
    const onCreate = vi.fn();
    render(
      <Harness
        initialLibrary={[]}
        onSnapshot={onSnapshot}
        onCreate={onCreate}
      />
    );

    await pick(user, /New condition/);
    const create = screen.getByRole('button', { name: 'Create & attach' });
    expect(create).toBeDisabled();

    await user.type(screen.getByLabelText('Condition name'), 'Petrifying Gaze');
    await user.type(
      screen.getByLabelText('Condition description'),
      'Turn to stone on a failed save.'
    );
    await user.click(create);

    const created = onCreate.mock.calls[0][0] as CustomCondition;
    expect(created).toMatchObject({
      name: 'Petrifying Gaze',
      description: 'Turn to stone on a failed save.',
      icon: 'trending-down',
      kind: 'debuff',
    });
    expect(onSnapshot).toHaveBeenLastCalledWith([created]);
    expect(screen.queryByLabelText('Condition name')).toBeNull();
  });
});
