// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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

  it('shows validation message when maxUses is empty', () => {
    render(<Harness initial={[draft({ maxUses: undefined })]} />);
    expect(
      screen.getByText('Max uses is required (positive whole number).')
    ).toBeInTheDocument();
  });

  it('renders prefilled resource with name and settings', () => {
    render(<Harness initial={[draft()]} />);
    expect(screen.getByRole('textbox', { name: 'Resource name' })).toHaveValue(
      'Wild Shape'
    );
    expect(
      screen.getByRole('textbox', { name: 'Resource max uses' })
    ).toHaveValue('4');
  });

  it('delete button calls onDeleteResource with the instance id', () => {
    const onDelete = vi.fn();
    render(<Harness initial={[draft()]} onDeleteResource={onDelete} />);
    screen.getByRole('button', { name: 'Delete resource Wild Shape' }).click();
    expect(onDelete).toHaveBeenCalledWith('res-1');
  });
});
