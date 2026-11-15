import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CampaignNPC, MonsterStatBlock } from '@/types/encounter';

import { NpcLibraryRow, type NpcLibraryRowProps } from './NpcLibraryRow';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const rest = { ...props };
    delete rest.fill;
    delete rest.priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

const brenn: CampaignNPC = {
  id: 'npc-1',
  campaignCode: 'ABC123',
  name: 'Brenn Ironhand',
  description: 'Runs the Rusty Anchor.',
  armorClass: '15',
  tempAc: '2 (shield)',
  maxHp: 44,
  speed: '30 ft.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  monsterStatBlock: {
    size: 'Medium',
    type: 'humanoid',
    cr: '2',
  } as unknown as MonsterStatBlock,
  spellcasting: {
    casterLevel: 5,
  } as unknown as CampaignNPC['spellcasting'],
  passivePerception: 14,
  passiveInsight: 12,
  passiveInvestigation: 11,
  tags: ['merchant', 'quest'],
};

const handlers = () => ({
  onView: vi.fn(),
  onEdit: vi.fn(),
  onDuplicate: vi.fn(),
  onMove: vi.fn(),
  onDelete: vi.fn(),
});

function renderRow(
  npc: CampaignNPC = brenn,
  props: Partial<NpcLibraryRowProps> = {}
) {
  const h = handlers();
  const view = render(
    <ul>
      <li>
        <NpcLibraryRow
          npc={npc}
          headingLevel={3}
          moveLabel="Move Brenn Ironhand to custom monsters"
          {...h}
          {...props}
        />
      </li>
    </ul>
  );
  return { ...view, ...h };
}

afterEach(cleanup);

describe('NpcLibraryRow', () => {
  it('names the card with a heading at the section level', () => {
    const { unmount } = renderRow();
    expect(
      screen.getByRole('heading', { level: 3, name: brenn.name })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'View' })
    ).toHaveAccessibleDescription(brenn.name);
    unmount();
    renderRow(brenn, { headingLevel: 4 });
    expect(
      screen.getByRole('heading', { level: 4, name: brenn.name })
    ).toBeInTheDocument();
  });

  it('opens the sheet when the card body is clicked', () => {
    const { onView } = renderRow();
    fireEvent.click(screen.getByText('Runs the Rusty Anchor.'));
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('opens the card with Enter or Space without handling keys from nested controls', () => {
    const { onView } = renderRow();
    const card = screen.getByRole('button', { name: 'View' });
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    expect(onView).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(
      screen.getByRole('button', { name: `Edit ${brenn.name}` }),
      { key: 'Enter' }
    );
    expect(onView).toHaveBeenCalledTimes(2);
  });

  it('shows the stored creature details and all three passive scores', () => {
    renderRow();
    expect(screen.getByText('Medium humanoid')).toBeInTheDocument();
    expect(screen.getByText('Runs the Rusty Anchor.')).toBeInTheDocument();
    expect(screen.getByText('CR 2')).toBeInTheDocument();
    expect(screen.getByText('Caster Lv5')).toBeInTheDocument();
    expect(screen.getByText('44 HP')).toBeInTheDocument();
    expect(screen.getByText('AC 15 (+2)')).toBeInTheDocument();
    expect(screen.getByText('30 ft.')).toBeInTheDocument();
    for (const [label, value] of [
      ['Passive Perception', '14'],
      ['Passive Insight', '12'],
      ['Passive Investigation', '11'],
    ]) {
      expect(screen.getByTitle(label)).toHaveTextContent(value);
    }
  });

  it('handles missing optional details and blank portraits', () => {
    const { container } = renderRow({
      ...brenn,
      avatarUrl: '  ',
      monsterStatBlock: undefined,
      description: undefined,
      spellcasting: undefined,
      tempAc: undefined,
      passivePerception: undefined,
      passiveInsight: undefined,
      passiveInvestigation: undefined,
      tags: undefined,
    });
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByText('Runs the Rusty Anchor.')).toBeNull();
    expect(screen.queryByTitle('Passive Perception')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Tags' })).toBeNull();
    expect(screen.getByText('AC 15')).toBeInTheDocument();
  });

  it('names each action and keeps action clicks from opening the sheet', () => {
    const h = renderRow();
    for (const [name, handler] of [
      [`Duplicate ${brenn.name}`, h.onDuplicate],
      [`Move ${brenn.name} to custom monsters`, h.onMove],
      [`Edit ${brenn.name}`, h.onEdit],
      [`Delete ${brenn.name}`, h.onDelete],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(handler).toHaveBeenCalledTimes(1);
    }
    expect(h.onView).not.toHaveBeenCalled();
  });

  it('lists repeated tags once and omits an empty tag list', () => {
    const { unmount } = renderRow({
      ...brenn,
      tags: ['merchant', 'quest', 'merchant'],
    });
    const tags = within(
      screen.getByRole('list', { name: 'Tags' })
    ).getAllByRole('listitem');
    expect(tags.map(tag => tag.textContent)).toEqual(['merchant', 'quest']);
    unmount();
    renderRow({ ...brenn, tags: [] });
    expect(screen.queryByRole('list', { name: 'Tags' })).toBeNull();
  });

  it('registers and releases the card as the focus target', () => {
    const viewRef = vi.fn();
    const { unmount } = renderRow(brenn, { viewRef });
    expect(viewRef.mock.calls[0]?.[0]).toBe(
      screen.getByRole('button', { name: 'View' })
    );
    unmount();
    expect(viewRef.mock.lastCall?.[0]).toBeNull();
  });

  it('opens the sheet from the original full-height portrait', () => {
    const { onView } = renderRow({
      ...brenn,
      avatarUrl: 'data:image/png;base64,cG9ydHJhaXQ=',
    });
    fireEvent.click(screen.getByRole('img', { name: brenn.name }));
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('keeps keyboard reordering outside the clickable card', () => {
    const onMove = vi.fn();
    const { onView } = renderRow(brenn, {
      reorder: { index: 0, count: 2, onMove },
    });
    expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move down' }));
    expect(onMove).toHaveBeenCalledWith(1);
    expect(onView).not.toHaveBeenCalled();
  });
});
