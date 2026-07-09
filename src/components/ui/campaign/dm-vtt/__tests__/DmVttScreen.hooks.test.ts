import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useBattleMapStore } from '@/store/battleMapStore';
import { useEncounterStore } from '@/store/encounterStore';
import { useNPCStore } from '@/store/npcStore';
import { createMockEncounter, createMockEncounterEntity } from '@/test/helpers';
import { useDmVttScreen } from '../DmVttScreen.hooks';

import type { Viewport } from '@fieldnotes/core';
import type { BattleMap } from '@/types/battlemap';
import type { CampaignNPC } from '@/types/encounter';

function makeBattleMap(overrides: Partial<BattleMap> = {}): BattleMap {
  return {
    id: 'bm-1',
    campaignCode: 'ABC',
    name: 'The Ruins',
    mapImageUrl: '',
    mapImageSize: { w: 100, h: 100 },
    canvasState: '',
    dmOnlyElements: {},
    gridEnabled: false,
    linkedEncounterIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Fake canvas store: `getAll`/`on` satisfy `useCombatantTokens`, `getById`
 * resolves the ids seeded in `tokensById` to combatant-token elements. */
function makeFakeViewport(tokensById: Record<string, string>): Viewport {
  const store = {
    getAll: () => [],
    on: () => () => {},
    getById: (id: string) => {
      const entityId = tokensById[id];
      return entityId ? { id, tokenKind: 'combatant', entityId } : undefined;
    },
  };
  return { store } as unknown as Viewport;
}

function makeNPC(overrides: Partial<CampaignNPC> = {}): CampaignNPC {
  return {
    id: 'npc-1',
    campaignCode: 'ABC',
    name: 'Grizzlebeard',
    armorClass: 14,
    maxHp: 22,
    speed: '30 ft.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function resetStores() {
  useBattleMapStore.setState({ battleMaps: {} });
  useEncounterStore.setState({ encounters: [], activeEncounterId: null });
  useNPCStore.setState({ npcsByCampaign: {} });
}

describe('useDmVttScreen', () => {
  beforeEach(() => {
    resetStores();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true }))
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  function seed() {
    useBattleMapStore.setState({
      battleMaps: {
        ABC: { 'bm-1': makeBattleMap({ linkedEncounterIds: ['enc-1'] }) },
      },
    });
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          campaignCode: 'ABC',
          isActive: true,
          entities: [
            createMockEncounterEntity({
              id: 'known-1',
              name: 'Aria',
              type: 'player',
            }),
          ],
        }),
      ],
    });
  }

  it('armPlacement sets pending with the correct config/color once live', () => {
    seed();
    const { result } = renderHook(() =>
      useDmVttScreen({ campaignCode: 'ABC', battleMapId: 'bm-1', dmId: 'dm-1' })
    );

    act(() => result.current.onStatus('live'));
    act(() =>
      result.current.armPlacement(
        createMockEncounterEntity({
          id: 'known-1',
          name: 'Aria',
          type: 'player',
        })
      )
    );

    expect(result.current.pendingPlacement?.entityName).toBe('Aria');
    expect(result.current.pendingPlacement?.config).toMatchObject({
      entityId: 'known-1',
      name: 'Aria',
      color: '#12855C',
    });
  });

  it('config.onPlaced clears pending SYNCHRONOUSLY and selects the entity', () => {
    seed();
    const { result } = renderHook(() =>
      useDmVttScreen({ campaignCode: 'ABC', battleMapId: 'bm-1', dmId: 'dm-1' })
    );
    act(() => result.current.onStatus('live'));
    act(() =>
      result.current.armPlacement(
        createMockEncounterEntity({
          id: 'known-1',
          name: 'Aria',
          type: 'player',
        })
      )
    );
    const { config } = result.current.pendingPlacement!;

    act(() => config.onPlaced());

    expect(result.current.pendingPlacement).toBeNull();
    expect(result.current.selectedEntityId).toBe('known-1');
    expect(result.current.studioTab).toBe('selected');
  });

  it('cancelPlacement clears pending', () => {
    seed();
    const { result } = renderHook(() =>
      useDmVttScreen({ campaignCode: 'ABC', battleMapId: 'bm-1', dmId: 'dm-1' })
    );
    act(() => result.current.onStatus('live'));
    act(() =>
      result.current.armPlacement(
        createMockEncounterEntity({
          id: 'known-1',
          name: 'Aria',
          type: 'player',
        })
      )
    );

    act(() => result.current.cancelPlacement());

    expect(result.current.pendingPlacement).toBeNull();
  });

  it('onSelectionChange maps a known combatant token to its entity and flips the tab', () => {
    seed();
    const { result } = renderHook(() =>
      useDmVttScreen({ campaignCode: 'ABC', battleMapId: 'bm-1', dmId: 'dm-1' })
    );
    act(() =>
      result.current.onViewportReady(makeFakeViewport({ tokenElId: 'known-1' }))
    );

    act(() => result.current.onSelectionChange(['tokenElId']));

    expect(result.current.selectedEntityId).toBe('known-1');
    expect(result.current.studioTab).toBe('selected');
  });

  it('onSelectionChange fires an info toast and leaves selection unset for an unlinked token', () => {
    seed();
    const { result } = renderHook(() =>
      useDmVttScreen({ campaignCode: 'ABC', battleMapId: 'bm-1', dmId: 'dm-1' })
    );
    act(() =>
      result.current.onViewportReady(
        makeFakeViewport({ tokenElId: 'known-1', staleTokenEl: 'ghost-1' })
      )
    );
    // First select the known entity so we can prove the stale selection
    // actually clears it back to null, rather than merely starting null.
    act(() => result.current.onSelectionChange(['tokenElId']));
    expect(result.current.selectedEntityId).toBe('known-1');

    act(() => result.current.onSelectionChange(['staleTokenEl']));

    expect(result.current.selectedEntityId).toBeNull();
    expect(
      result.current.toasts.some(
        t =>
          t.type === 'info' &&
          t.title === 'Unlinked token' &&
          t.message.includes('no longer in the encounter')
      )
    ).toBe(true);
  });

  it('actions.onViewNPC opens npcDialog with the matching NPC and entityId; onClose resets it', () => {
    seed();
    useNPCStore.setState({ npcsByCampaign: { ABC: [makeNPC()] } });
    const { result } = renderHook(() =>
      useDmVttScreen({ campaignCode: 'ABC', battleMapId: 'bm-1', dmId: 'dm-1' })
    );

    expect(result.current.npcDialog.npc).toBeNull();

    act(() => result.current.actions?.onViewNPC?.('npc-1', 'known-1'));

    expect(result.current.npcDialog.npc?.id).toBe('npc-1');
    expect(result.current.npcDialog.entityId).toBe('known-1');

    act(() => result.current.npcDialog.onClose());

    expect(result.current.npcDialog.npc).toBeNull();
    expect(result.current.npcDialog.entityId).toBeNull();
  });

  it('actions.onViewNPC is a no-op for an npcSourceId with no matching NPC', () => {
    seed();
    const { result } = renderHook(() =>
      useDmVttScreen({ campaignCode: 'ABC', battleMapId: 'bm-1', dmId: 'dm-1' })
    );

    act(() => result.current.actions?.onViewNPC?.('does-not-exist', 'known-1'));

    expect(result.current.npcDialog.npc).toBeNull();
  });
});
