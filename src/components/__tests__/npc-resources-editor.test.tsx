// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NpcResourcesEditor } from '@/components/ui/campaign/NpcResourcesEditor';
import type { NpcResourceDraft } from '@/utils/npcResources';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function draft(overrides: Partial<NpcResourceDraft> = {}): NpcResourceDraft {
  return {
    id: 'res-1',
    name: 'Wild Shape',
    icon: 'paw-print',
    color: 'emerald',
    displayStyle: 'pips',
    maxUses: 4,
    usesExpended: 0,
    shortRestReset: 1,
    ...overrides,
  };
}

function Harness({
  initial,
  onDeleteResource = vi.fn(),
}: {
  initial: NpcResourceDraft[];
  onDeleteResource?: (id: string) => void;
}) {
  const [resources, setResources] = useState(initial);
  return (
    <NpcResourcesEditor
      resources={resources}
      onChange={setResources}
      onDeleteResource={onDeleteResource}
    />
  );
}

describe('NpcResourcesEditor', () => {
  it('renders with an empty resource list', () => {
    render(<Harness initial={[]} />);
    expect(screen.getByText('Class Resources')).toBeInTheDocument();
    expect(screen.getByText(/No class resources/)).toBeInTheDocument();
  });

  it('registry pick prefills name and defaults; Bardic Inspiration defaults to no short-rest recovery', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[]} />);

    // Open the add dropdown and pick Bardic Inspiration
    const addButton = screen.getByRole('combobox');
    await user.click(addButton);

    // Find and click the Bardic Inspiration option
    await waitFor(() => {
      const bardic = screen.getByRole('option', {
        name: /Bardic Inspiration \(Bard\)/,
      });
      expect(bardic).toBeInTheDocument();
      fireEvent.click(bardic);
    });

    // Verify the resource was added with correct defaults
    await waitFor(() => {
      expect(
        screen.getByRole('textbox', { name: 'Resource name' })
      ).toHaveValue('Bardic Inspiration');
      expect(
        screen.getByRole('textbox', { name: 'Resource max uses' })
      ).toHaveValue('');
      expect(screen.getByText('None')).toBeInTheDocument();
    });
  });

  it('two instances of the same registry definition coexist with distinct ids', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[]} />);

    const addButton = screen.getByRole('combobox');

    // First pick of Wild Shape
    await user.click(addButton);
    await waitFor(() => {
      const wildShape = screen.getByRole('option', {
        name: /Wild Shape \(Druid\)/,
      });
      expect(wildShape).toBeInTheDocument();
      fireEvent.click(wildShape);
    });

    // Second pick of Wild Shape
    await waitFor(() => {
      // The button should be available again
      expect(addButton).toBeInTheDocument();
    });

    await user.click(addButton);
    await waitFor(() => {
      const wildShapes = screen.getAllByRole('option', {
        name: /Wild Shape \(Druid\)/,
      });
      expect(wildShapes.length).toBeGreaterThan(0);
      fireEvent.click(wildShapes[0]);
    });

    // Verify two instances exist
    await waitFor(() => {
      const nameInputs = screen.getAllByRole('textbox', {
        name: 'Resource name',
      });
      expect(nameInputs.length).toBe(2);
      expect(nameInputs[0]).toHaveValue('Wild Shape');
      expect(nameInputs[1]).toHaveValue('Wild Shape');
    });
  });

  it('shows validation message when maxUses is empty', () => {
    render(<Harness initial={[draft({ maxUses: undefined })]} />);
    expect(
      screen.getByText('Max uses is required (positive whole number).')
    ).toBeInTheDocument();
  });

  it('delete button calls onDeleteResource with the instance id', () => {
    const onDelete = vi.fn();
    render(<Harness initial={[draft()]} onDeleteResource={onDelete} />);
    screen.getByRole('button', { name: 'Delete resource Wild Shape' }).click();
    expect(onDelete).toHaveBeenCalledWith('res-1');
  });
});
