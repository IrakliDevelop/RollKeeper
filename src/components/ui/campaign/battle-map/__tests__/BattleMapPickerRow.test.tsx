import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { BattleMapPickerRow } from '../BattleMapPickerRow';

import type { BattleMap } from '@/types/battlemap';

afterEach(() => cleanup());

function map(linked: string[] = []): BattleMap {
  return {
    id: 'm1',
    campaignCode: 'ABC123',
    name: 'Goblin ambush',
    mapImageUrl: '',
    mapImageSize: { w: 0, h: 0 },
    canvasState: '',
    dmOnlyElements: {},
    gridEnabled: false,
    linkedEncounterIds: linked,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function renderRow(
  props: Partial<React.ComponentProps<typeof BattleMapPickerRow>> = {}
) {
  const onOpen = vi.fn();
  const onUnlink = vi.fn();
  render(
    <ul>
      <BattleMapPickerRow
        battleMap={map()}
        isCurrent={false}
        hasCurrent={false}
        onOpen={onOpen}
        onUnlink={onUnlink}
        {...props}
      />
    </ul>
  );
  return { onOpen, onUnlink };
}

describe('BattleMapPickerRow', () => {
  it('renders as a list item with the map name', () => {
    renderRow();
    expect(screen.getByRole('listitem')).toHaveTextContent('Goblin ambush');
  });

  it('shows Current, Unlink and Open for the linked map', () => {
    const { onOpen, onUnlink } = renderRow({
      battleMap: map(['e1']),
      isCurrent: true,
      hasCurrent: true,
    });
    expect(screen.getByText('Current')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));
    expect(onUnlink).toHaveBeenCalledTimes(1);
  });

  it('shows In use and Switch & open for a map linked elsewhere while one is current', () => {
    const { onOpen } = renderRow({
      battleMap: map(['e2']),
      hasCurrent: true,
    });
    expect(screen.getByText('In use')).toBeInTheDocument();
    expect(screen.queryByText('Current')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch & open' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('shows Link & open when nothing is current', () => {
    renderRow({ battleMap: map(['e2']), hasCurrent: false });
    expect(screen.getByText('In use')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Link & open' })
    ).toBeInTheDocument();
  });
});
