import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clickConfirmDialogButton,
  findConfirmDialog,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';
import type { LocationMap } from '@/types/location';

import { LocationListCard } from '../LocationListCard';

const LOCATION: LocationMap = {
  id: 'loc-1',
  campaignCode: 'K7QX2M',
  name: 'The Yawning Portal',
  mapImageUrl: '/maps/portal.png',
  mapImageSize: { w: 1200, h: 800 },
  canvasState: '',
  dmOnlyElements: {},
  gridEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function renderCard(location: LocationMap = LOCATION) {
  const onDelete = vi.fn();
  renderConfirmDialogHost();
  const view = render(
    <LocationListCard
      location={location}
      campaignCode="K7QX2M"
      onDelete={onDelete}
    />
  );
  return { onDelete, ...view };
}

describe('LocationListCard', () => {
  afterEach(cleanup);

  it('links the map and name to the location', () => {
    const { container } = renderCard();
    const link = screen.getByRole('link', { name: 'The Yawning Portal' });
    expect(link).toHaveAttribute('href', '/dm/campaign/K7QX2M/locations/loc-1');
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    expect(link.querySelector('button')).toBeNull();
  });

  it('names the delete button and keeps it outside the link', () => {
    renderCard();
    const link = screen.getByRole('link', { name: 'The Yawning Portal' });
    const button = screen.getByRole('button', {
      name: 'Delete The Yawning Portal',
    });
    expect(button).toHaveAttribute('data-variant', 'danger');
    expect(link.contains(button)).toBe(false);
    expect(button).not.toHaveAttribute('title');
  });

  it('asks before deleting and deletes on confirm', async () => {
    const { onDelete } = renderCard();
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete The Yawning Portal' })
    );
    const dialog = await findConfirmDialog();
    expect(dialog.querySelector('h2')).toHaveTextContent(
      'Delete The Yawning Portal?'
    );
    expect(dialog).toHaveTextContent(
      'The map and everything drawn on it are removed from this campaign and from your players.'
    );
    expect(dialog).toHaveTextContent('Delete location');
    expect(onDelete).not.toHaveBeenCalled();
    await clickConfirmDialogButton('Delete location');
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('loc-1');
  });

  it('keeps the location when the confirm is cancelled', async () => {
    const { onDelete } = renderCard();
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete The Yawning Portal' })
    );
    await clickConfirmDialogButton('Cancel');
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('shows "No image" without a map', () => {
    const { container } = renderCard({ ...LOCATION, mapImageUrl: '' });
    expect(screen.getByText('No image')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('uses no retired styles', () => {
    const { container } = renderCard();
    const root = container.firstElementChild as HTMLElement;
    const offenders = [root, ...root.querySelectorAll('*')].filter(el =>
      /shadow|backdrop-blur|scale-|rounded-lg|accent-/.test(
        el.getAttribute('class') ?? ''
      )
    );
    expect(offenders).toEqual([]);
  });
});
