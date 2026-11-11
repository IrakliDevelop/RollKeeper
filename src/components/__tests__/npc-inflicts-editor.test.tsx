// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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
const poisoned: CustomCondition = {
  id: 'official-poisoned',
  name: 'Poisoned',
  description: 'Canonical poisoned rules.',
  icon: 'biohazard',
  kind: 'debuff',
  origin: 'official',
  rulesSource: 'XPHB',
};

function Harness({
  initial = [],
  initialLibrary = [webbed, venom],
  officialConditions = [],
  onSnapshot = vi.fn(),
  onCreate = vi.fn(),
}: {
  initial?: CustomCondition[];
  initialLibrary?: CustomCondition[];
  officialConditions?: CustomCondition[];
  onSnapshot?: (next: CustomCondition[]) => void;
  onCreate?: (condition: CustomCondition) => void;
}) {
  const [conditions, setConditions] = useState(initial);
  const [library, setLibrary] = useState(initialLibrary);
  return (
    <NpcInflictsEditor
      conditions={conditions}
      library={library}
      officialConditions={officialConditions}
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
    expect(
      screen.getByRole('region', { name: 'Conditions it inflicts' })
    ).toBeTruthy();
    expect(
      screen.getByText(
        'No conditions yet. Conditions you add here can be applied with one tap in combat.'
      )
    ).toBeTruthy();
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

  it('offers canonical conditions separately and attaches their rules text', async () => {
    const user = userEvent.setup();
    const onSnapshot = vi.fn();
    render(<Harness officialConditions={[poisoned]} onSnapshot={onSnapshot} />);

    await pick(user, /Poisoned/);

    expect(onSnapshot).toHaveBeenLastCalledWith([poisoned]);
    expect(screen.getByText('XPHB')).toBeTruthy();
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
    const create = screen.getByRole('button', { name: 'Create and add' });
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

  it('shows the description as visible text', () => {
    const held: CustomCondition = { ...webbed, description: 'Held fast' };
    const { container } = render(
      <Harness initial={[held]} initialLibrary={[held]} />
    );
    expect(screen.getByText('Held fast')).toBeTruthy();
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('badges official conditions by source and custom ones by kind', () => {
    const buff: CustomCondition = {
      ...venom,
      id: 'cc-buff',
      name: 'Rage',
      kind: 'buff',
    };
    const neutral: CustomCondition = {
      ...venom,
      id: 'cc-neutral',
      name: 'Marked',
      kind: 'neutral',
    };
    render(
      <Harness
        initial={[poisoned, webbed, buff, neutral]}
        initialLibrary={[webbed, buff, neutral]}
        officialConditions={[poisoned]}
      />
    );
    expect(screen.getByText('XPHB')).toBeTruthy();
    expect(screen.getByText('Debuff')).toBeTruthy();
    expect(screen.getByText('Buff')).toBeTruthy();
    expect(screen.getByText('Neutral')).toBeTruthy();
  });

  it('Create and add is not primary and waits for a name', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await pick(user, /New condition/);
    const create = screen.getByRole('button', { name: 'Create and add' });
    expect(create.getAttribute('data-variant')).toBe('secondary');
    expect(
      screen
        .getByRole('button', { name: 'Cancel' })
        .getAttribute('data-variant')
    ).toBe('outline');
    expect(create).toBeDisabled();
    await user.type(screen.getByLabelText('Condition name'), 'Gaze');
    expect(create).toBeEnabled();
  });

  it('Remove is danger', () => {
    render(<Harness initial={[webbed]} />);
    expect(
      screen
        .getByRole('button', { name: 'Remove Webbed' })
        .getAttribute('data-variant')
    ).toBe('danger');
  });

  describe('focus', () => {
    const picker = () =>
      screen.getByRole('combobox', { name: 'Add inflicted condition' });

    it('New condition focuses Condition name', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await pick(user, /New condition/);
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByLabelText('Condition name')
        )
      );
    });

    it('picking a library condition leaves focus on the picker', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await pick(user, /^Webbed$/);
      expect(screen.getByText('Webbed')).toBeTruthy();
      await waitFor(() => expect(document.activeElement).toBe(picker()));
    });

    it('Cancel returns focus to the Add inflicted condition picker', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await pick(user, /New condition/);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(document.activeElement).toBe(picker()));
    });

    it('Create and add returns focus to the picker', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await pick(user, /New condition/);
      await user.type(screen.getByLabelText('Condition name'), 'Gaze');
      await user.click(screen.getByRole('button', { name: 'Create and add' }));
      await waitFor(() => expect(document.activeElement).toBe(picker()));
    });

    it("Remove focuses the next row's Remove, else the picker", async () => {
      const user = userEvent.setup();
      render(<Harness initial={[webbed, venom]} />);
      await user.click(screen.getByRole('button', { name: 'Remove Webbed' }));
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('button', { name: 'Remove Spider Venom' })
        )
      );
      await user.click(
        screen.getByRole('button', { name: 'Remove Spider Venom' })
      );
      await waitFor(() => expect(document.activeElement).toBe(picker()));
    });
  });
});
