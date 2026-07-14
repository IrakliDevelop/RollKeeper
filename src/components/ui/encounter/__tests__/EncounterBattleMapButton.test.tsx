import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { EncounterBattleMapButton } from '../EncounterBattleMapButton';
import { useBattleMapStore } from '@/store/battleMapStore';

import type { BattleMap } from '@/types/battlemap';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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

describe('EncounterBattleMapButton', () => {
  beforeEach(() => {
    const state = useBattleMapStore.getState();
    for (const m of state.getBattleMaps('ABC123')) {
      state.removeBattleMap('ABC123', m.id);
    }
  });

  afterEach(() => cleanup());

  it('shows the picker-opening button when unlinked', () => {
    render(<EncounterBattleMapButton campaignCode="ABC123" encounterId="e1" />);
    expect(
      screen.getByRole('button', { name: /battle map/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/open battle map/i)).not.toBeInTheDocument();
  });

  it('shows a direct open link plus change chevron when linked', () => {
    useBattleMapStore.getState().addBattleMap('ABC123', map('m1', ['e1']));
    render(<EncounterBattleMapButton campaignCode="ABC123" encounterId="e1" />);
    const link = screen.getByRole('link', { name: /open battle map/i });
    expect(link).toHaveAttribute('href', '/dm/campaign/ABC123/battlemaps/m1');
    expect(
      screen.getByRole('button', { name: /change battle map/i })
    ).toBeInTheDocument();
  });
});
