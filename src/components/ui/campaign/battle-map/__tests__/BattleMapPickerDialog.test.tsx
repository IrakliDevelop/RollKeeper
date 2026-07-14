import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { BattleMapPickerDialog } from '../BattleMapPickerDialog';
import { useBattleMapStore } from '@/store/battleMapStore';

import type { BattleMap } from '@/types/battlemap';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

function map(id: string, linked: string[] = []): BattleMap {
  return {
    id,
    campaignCode: 'ABC123',
    name: `Map ${id}`,
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

function seed(maps: BattleMap[]) {
  for (const m of maps) {
    useBattleMapStore.getState().addBattleMap('ABC123', m);
  }
}

function renderDialog() {
  return render(
    <BattleMapPickerDialog
      open
      onOpenChange={() => {}}
      campaignCode="ABC123"
      encounterId="e1"
    />
  );
}

describe('BattleMapPickerDialog', () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
    // Reset the persisted store between tests: remove every seeded map.
    const state = useBattleMapStore.getState();
    for (const m of state.getBattleMaps('ABC123')) {
      state.removeBattleMap('ABC123', m.id);
    }
  });

  afterEach(() => cleanup());

  it('lists maps with a Current badge on the linked one', () => {
    seed([map('m1'), map('m2', ['e1'])]);
    renderDialog();
    expect(screen.getByText('Map m1')).toBeInTheDocument();
    expect(screen.getByText('Map m2')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('links the selected map, unlinks the previous, and navigates', () => {
    seed([map('m1', ['e1']), map('m2')]);
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /switch & open/i }));
    const maps = useBattleMapStore.getState().getBattleMaps('ABC123');
    expect(maps.find(m => m.id === 'm2')?.linkedEncounterIds).toContain('e1');
    expect(maps.find(m => m.id === 'm1')?.linkedEncounterIds).not.toContain(
      'e1'
    );
    expect(pushMock).toHaveBeenCalledWith('/dm/campaign/ABC123/battlemaps/m2');
  });

  it('unlinks the current map without navigating', () => {
    seed([map('m1', ['e1'])]);
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /unlink/i }));
    const maps = useBattleMapStore.getState().getBattleMaps('ABC123');
    expect(maps.find(m => m.id === 'm1')?.linkedEncounterIds).toEqual([]);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('creates a named blank map, links it, stamps setup mode, navigates', () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText('New battle map name'), {
      target: { value: 'Cave of Chaos' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create & open/i }));
    const created = useBattleMapStore
      .getState()
      .getBattleMaps('ABC123')
      .find(m => m.name === 'Cave of Chaos');
    expect(created).toBeDefined();
    expect(created?.linkedEncounterIds).toContain('e1');
    expect(created?.mapImageUrl).toBe('');
    expect(
      localStorage.getItem(`rollkeeper-battlemap-mode:${created?.id}`)
    ).toBe('setup');
    expect(pushMock).toHaveBeenCalledWith(
      `/dm/campaign/ABC123/battlemaps/${created?.id}`
    );
  });
});
