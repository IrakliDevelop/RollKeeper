import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clickConfirmDialogButton,
  findConfirmDialog,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';
import type { BattleMap } from '@/types/battlemap';

import { BattleMapListCard } from '../BattleMapListCard';

const BATTLE_MAP: BattleMap = {
  id: 'bm-1',
  campaignCode: 'K7QX2M',
  name: 'Goblin ambush',
  mapImageUrl: '/maps/ambush.png',
  mapImageSize: { w: 1200, h: 800 },
  canvasState: '',
  dmOnlyElements: {},
  gridEnabled: false,
  linkedEncounterIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function renderCard(battleMap: BattleMap = BATTLE_MAP) {
  const onDelete = vi.fn();
  renderConfirmDialogHost();
  const view = render(
    <BattleMapListCard
      battleMap={battleMap}
      campaignCode="K7QX2M"
      onDelete={onDelete}
    />
  );
  return { onDelete, ...view };
}

describe('BattleMapListCard', () => {
  afterEach(cleanup);

  it('renders the map name as the link to the editor', () => {
    const { container } = renderCard();
    const link = screen.getByRole('link', { name: 'Goblin ambush' });
    expect(link).toHaveAttribute('href', '/dm/campaign/K7QX2M/battlemaps/bm-1');
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('shows "No image" when the map has no image', () => {
    const { container } = renderCard({ ...BATTLE_MAP, mapImageUrl: '' });
    expect(screen.getByText('No image')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the linked encounter count', () => {
    renderCard({ ...BATTLE_MAP, linkedEncounterIds: ['e1', 'e2'] });
    expect(screen.getByText('2 encounters')).toBeInTheDocument();
    cleanup();
    renderCard({ ...BATTLE_MAP, linkedEncounterIds: ['e1'] });
    expect(screen.getByText('1 encounter')).toBeInTheDocument();
    cleanup();
    renderCard();
    expect(screen.queryByText(/encounter/)).toBeNull();
  });

  it('names the delete button and keeps it outside the link', () => {
    renderCard();
    const link = screen.getByRole('link', { name: 'Goblin ambush' });
    const button = screen.getByRole('button', {
      name: 'Delete Goblin ambush',
    });
    expect(link.contains(button)).toBe(false);
    expect(button).not.toHaveAttribute('title');
  });

  it('keeps the map when the confirm is cancelled', async () => {
    const { onDelete } = renderCard();
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Goblin ambush' })
    );
    const dialog = await findConfirmDialog();
    expect(dialog.querySelector('h2')).toHaveTextContent(
      'Delete Goblin ambush?'
    );
    expect(dialog).toHaveTextContent(
      'The map and everything on it are removed from this campaign and from your players.'
    );
    await clickConfirmDialogButton('Cancel');
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('deletes once when the confirm is accepted', async () => {
    const { onDelete } = renderCard();
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Goblin ambush' })
    );
    await findConfirmDialog();
    expect(onDelete).not.toHaveBeenCalled();
    await clickConfirmDialogButton('Delete battle map');
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('bm-1');
  });

  it('draws the link focus ring on the card root so overflow cannot clip it', () => {
    const { container } = renderCard();
    const root = container.firstElementChild as HTMLElement;
    const link = screen.getByRole('link', { name: 'Goblin ambush' });
    expect(root).toHaveClass(
      'has-[a:focus-visible]:ring-2',
      'has-[a:focus-visible]:ring-brass-fill'
    );
    expect(link).toHaveClass('focus-visible:outline-none');
  });

  it('uses no retired styles', () => {
    const { container } = renderCard({
      ...BATTLE_MAP,
      linkedEncounterIds: ['e1'],
    });
    const root = container.firstElementChild as HTMLElement;
    const offenders = [root, ...root.querySelectorAll('*')].filter(el =>
      /shadow|backdrop-blur|scale-|rounded-lg|accent-/.test(
        el.getAttribute('class') ?? ''
      )
    );
    expect(offenders).toEqual([]);
  });
});
