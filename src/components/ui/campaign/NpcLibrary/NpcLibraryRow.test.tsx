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
  it('names the row with a heading', () => {
    const { onView, onEdit, onDuplicate, onMove, onDelete, unmount } =
      renderRow();
    const heading = screen.getByRole('heading', {
      level: 3,
      name: 'Brenn Ironhand',
    });
    expect(heading).toHaveClass(
      'type-label-heading',
      'text-heading',
      'break-words'
    );
    fireEvent.click(screen.getByText('Runs the Rusty Anchor.'));
    for (const fn of [onView, onEdit, onDuplicate, onMove, onDelete]) {
      expect(fn).not.toHaveBeenCalled();
    }
    unmount();
    renderRow(brenn, { headingLevel: 4 });
    expect(
      screen.getByRole('heading', { level: 4, name: 'Brenn Ironhand' })
    ).toBeInTheDocument();
  });

  it('shows the meta, description, vitals and passives as text', () => {
    const { unmount } = renderRow();
    const meta = screen.getByText('Medium humanoid · CR 2 · Caster level 5');
    expect(meta).toHaveClass('type-small', 'text-muted');
    const description = screen.getByText('Runs the Rusty Anchor.');
    expect(description).toHaveClass('line-clamp-2');
    expect(description).not.toHaveAttribute('title');
    const vitals = screen.getByText('AC 15 (+2) · 44 HP · Speed 30 ft.');
    expect(vitals).toHaveClass('type-ui', 'text-heading', 'tabular-nums');
    const passives = screen.getByText(/^Passive Perception/).closest('p');
    expect(passives).toHaveClass('type-small', 'text-muted');
    expect(passives?.textContent).toBe(
      'Passive Perception 14 · Insight 12 · Investigation 11'
    );
    const later = passives?.querySelectorAll('.hidden.md\\:inline');
    expect(later).toHaveLength(2);
    expect(later?.[0].textContent).toBe(' · Insight 12');
    expect(later?.[1].textContent).toBe(' · Investigation 11');
    unmount();

    renderRow({
      ...brenn,
      passivePerception: undefined,
      passiveInvestigation: undefined,
    });
    const single = screen.getByText(/^Passive Insight/).closest('p');
    expect(single?.textContent).toBe('Passive Insight 12');
    expect(single?.querySelector('.hidden')).toBeNull();
  });

  it('prints nothing dangling when optional parts are missing', () => {
    const { container } = renderRow({
      ...brenn,
      monsterStatBlock: undefined,
      description: undefined,
      spellcasting: undefined,
      tempAc: undefined,
      speed: '',
      passivePerception: undefined,
      passiveInsight: undefined,
      passiveInvestigation: undefined,
      tags: undefined,
    });
    expect(screen.getByText('AC 15 · 44 HP')).toBeInTheDocument();
    expect(screen.queryByText(/·\s*$/)).toBeNull();
    expect(screen.queryByText(/^Passive/)).toBeNull();
    expect(screen.queryByText('Runs the Rusty Anchor.')).toBeNull();
    expect(container.querySelector('p.text-muted')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('lists tags only when there are some', () => {
    const { unmount } = renderRow();
    const list = screen.getByRole('list', { name: 'Tags' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.firstElementChild).toHaveAttribute('data-variant', 'neutral');
    }
    unmount();
    renderRow({ ...brenn, tags: [] });
    expect(screen.queryByRole('list', { name: 'Tags' })).toBeNull();
  });

  it('opens the creature from View, described by the name', () => {
    const { onView } = renderRow();
    const view = screen.getByRole('button', { name: 'View' });
    expect(view).toHaveAttribute('data-variant', 'secondary');
    expect(view).toHaveAccessibleDescription('Brenn Ironhand');
    fireEvent.click(view);
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('names each row action', () => {
    const h = renderRow();
    const buttons = screen.getAllByRole('button');
    expect(
      buttons.map(b => b.getAttribute('aria-label') ?? b.textContent)
    ).toEqual([
      'View',
      'Edit Brenn Ironhand',
      'Duplicate Brenn Ironhand',
      'Move Brenn Ironhand to custom monsters',
      'Delete Brenn Ironhand',
    ]);
    expect(buttons.map(b => b.getAttribute('data-variant'))).toEqual([
      'secondary',
      'ghost',
      'ghost',
      'ghost',
      'danger',
    ]);
    for (const b of buttons) expect(b).not.toHaveAttribute('title');
    const pairs: Array<[string, () => void]> = [
      ['Edit Brenn Ironhand', h.onEdit],
      ['Duplicate Brenn Ironhand', h.onDuplicate],
      ['Move Brenn Ironhand to custom monsters', h.onMove],
      ['Delete Brenn Ironhand', h.onDelete],
    ];
    for (const [name, fn] of pairs) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it('lists a repeated tag once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderRow({ ...brenn, tags: ['merchant', 'quest', 'merchant'] });
    const items = within(
      screen.getByRole('list', { name: 'Tags' })
    ).getAllByRole('listitem');
    expect(items.map(item => item.textContent)).toEqual(['merchant', 'quest']);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('hands the View button to viewRef', () => {
    const viewRef = vi.fn();
    const { unmount } = renderRow(brenn, { viewRef });
    expect(viewRef.mock.calls[0]?.[0]).toBe(
      screen.getByRole('button', { name: 'View' })
    );
    unmount();
    expect(viewRef.mock.lastCall?.[0]).toBeNull();
  });

  it('keeps a blank portrait out of the row', () => {
    const { container } = renderRow({ ...brenn, avatarUrl: '   ' });
    expect(container.querySelector('img')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /image full size/ })
    ).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('opens the portrait full size from the row', () => {
    const { onView, container } = renderRow({
      ...brenn,
      avatarUrl: 'data:image/png;base64,cG9ydHJhaXQ=',
    });
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'View Brenn Ironhand image full size',
      })
    );
    expect(
      screen.getByRole('dialog', { name: /brenn ironhand full-size image/i })
    ).toBeInTheDocument();
    expect(onView).not.toHaveBeenCalled();
  });

  it('shows Move up and Move down under the row while reordering', () => {
    const onMove = vi.fn();
    const { unmount } = renderRow(brenn, {
      reorder: { index: 0, count: 2, onMove },
    });
    expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled();
    const down = screen.getByRole('button', { name: 'Move down' });
    expect(down).toHaveAccessibleDescription('Brenn Ironhand');
    fireEvent.click(down);
    expect(onMove).toHaveBeenCalledWith(1);
    expect(screen.getAllByRole('button')).toHaveLength(7);
    unmount();
    renderRow();
    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull();
  });
});
