import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBattleMapStore } from '@/store/battleMapStore';
import { useEncounterStore } from '@/store/encounterStore';
import type { BattleMap } from '@/types/battlemap';

vi.mock('@/hooks/useDmInitiativeSync', () => ({
  useDmInitiativeSync: () => ({
    pushInitiative: vi.fn(async () => {}),
    pushInitiativeRequest: vi.fn(async () => {}),
    control: { status: 'not-broadcasting' },
  }),
}));
vi.mock('@/hooks/useDmEffectsSync', () => ({
  useDmEffectsSync: () => ({ syncPlayerEffects: vi.fn() }),
}));
vi.mock('@/hooks/useDmCounterSync', () => ({ useDmCounterSync: () => {} }));
vi.mock('@/hooks/useTurnRequestSync', () => ({ useTurnRequestSync: () => {} }));
vi.mock('@/hooks/useInitiativeSubmissionSync', () => ({
  useInitiativeSubmissionSync: () => {},
}));
vi.mock('@/hooks/useCampaignSync', () => ({
  useCampaignSync: () => ({ players: [], refresh: vi.fn() }),
}));
vi.mock('@/hooks/useActiveBattleMapId', () => ({
  useActiveBattleMapId: () => null,
}));
vi.mock('@/hooks/useBattleMapPokes', () => ({ useBattleMapPokes: () => {} }));
vi.mock('@/components/ui/encounter/TablePublicationControls', () => ({
  TablePublicationControls: () => null,
}));
vi.mock('@/components/ui/encounter/combat-screen/CombatScreen', () => ({
  CombatScreen: (props: { onStartCombat: () => void }) => (
    <button onClick={props.onStartCombat}>Start combat</button>
  ),
}));
vi.mock('@/components/ui/encounter/combat-screen/AddCombatantDialog', () => ({
  AddCombatantDialog: () => null,
}));
vi.mock('@/components/ui/encounter/CombatConfigDialog', () => ({
  CombatConfigDialog: () => null,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { EncounterView } from '../EncounterView';

const MAP = {
  id: 'map-a',
  campaignCode: 'CAMP',
  name: 'Cave',
  mapImageUrl: '',
  mapImageSize: { w: 0, h: 0 },
  canvasState: '',
  dmOnlyElements: {},
  gridEnabled: false,
  linkedEncounterIds: ['enc-1'],
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
} as BattleMap;

const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  useBattleMapStore.getState().addBattleMap('CAMP', MAP);
  useEncounterStore.setState({
    encounters: [
      {
        id: 'enc-1',
        name: 'Cave fight',
        campaignCode: 'CAMP',
        entities: [],
        currentTurn: 0,
        round: 0,
        isActive: false,
        sortOrder: 'initiative',
        createdAt: '2026-10-07T00:00:00.000Z',
        updatedAt: '2026-10-07T00:00:00.000Z',
      },
    ],
  });
});
afterEach(() => {
  cleanup();
  useBattleMapStore.getState().removeBattleMap('CAMP', 'map-a');
  vi.unstubAllGlobals();
});

describe('EncounterView start combat auto-share wiring (D9)', () => {
  it('never pushes the linked map live through the legacy shared writer', () => {
    render(<EncounterView encounterId="enc-1" campaignCode="CAMP" />);
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
    expect(useEncounterStore.getState().encounters[0]?.isActive).toBe(true);
    const legacyBattleMapWrites = fetchMock.mock.calls.filter(call => {
      const [url, init] = call as unknown as [string, RequestInit | undefined];
      return (
        String(url).includes('/shared') &&
        String(init?.body ?? '').includes('"battlemap"')
      );
    });
    expect(legacyBattleMapWrites).toHaveLength(0);
  });
});
