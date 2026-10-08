import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TableRepository } from '@/lib/table/repository';
import { runRosterCommand, type TableCampaignPlayer } from '@/lib/table/roster';
import { runSceneCommand } from '@/lib/table/sceneCommands';

import { useTablePartyArrival } from './useTablePartyArrival';
import type { TableRosterCanvas } from './useTableRosterState';

const AT = '2026-10-08T00:00:00.000Z';
const PLAYERS: TableCampaignPlayer[] = [
  { playerId: 'p-aria', characterId: 'p-aria', name: 'Aria' },
  { playerId: 'p-bran', characterId: 'c-bran', name: 'Bran' },
  { playerId: 'p-cora', characterId: 'p-cora', name: 'Cora' },
];

let repository: TableRepository;

function fakeCanvas(options: { refuse?: Set<string> } = {}) {
  const elements: Record<string, unknown>[] = [];
  const listeners = new Set<() => void>();
  const stamps: Array<{ tokenId: string; name: string; slot: number }> = [];
  const canvas: TableRosterCanvas & {
    elements(): readonly Record<string, unknown>[];
  } = {
    elements: () => elements,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    select: vi.fn(),
    armPlacement: vi.fn(),
    applyTokenPatch: vi.fn(() => true),
    ensurePlayerBand: vi.fn(),
    stampAt: vi.fn((request, _point, slot) => {
      if (options.refuse?.has(request.name)) return false;
      stamps.push({ tokenId: request.tokenId, name: request.name, slot });
      elements.push({ id: request.tokenId, ...request.fields });
      listeners.forEach(listener => listener());
      return true;
    }),
  };
  return { canvas, elements, stamps };
}

const snapshot = () => {
  const current = repository.getCurrent();
  if (current?.status !== 'ready') throw new Error('not ready');
  return current.snapshot;
};
const revision = () => snapshot().campaign?.revision ?? 0;

beforeEach(async () => {
  repository = new TableRepository({
    factory: new IDBFactory(),
    selection: {
      account: { kind: 'guest' },
      workspace: { localWorkspaceId: 'w1', sourceCampaignCode: 'CAMP' },
    },
    broadcastChannel: null,
    events: null,
  });
  await repository.start();
  await runSceneCommand(repository, {
    expectedRevision: 0,
    operationId: 'create',
    command: {
      type: 'scene.create',
      sceneId: 'scene-forest',
      name: 'Forest',
      mapImageUrl: '',
      mapImageSize: { w: 0, h: 0 },
      at: AT,
    },
  });
});
afterEach(() => {
  cleanup();
  repository.dispose();
});

async function addMember(player: TableCampaignPlayer) {
  await runRosterCommand(repository, {
    expectedRevision: revision(),
    operationId: `add-${player.playerId}`,
    command: {
      type: 'roster.addPartyMember',
      sceneId: 'scene-forest',
      campaignId: 'CAMP',
      legacyPlayerId: player.playerId,
      characterId: player.characterId,
      name: player.name,
      actorId: `actor-${player.playerId}`,
      sceneMemberId: `member-${player.playerId}`,
      at: AT,
    },
    players: PLAYERS,
  });
}

function mount(canvas: TableRosterCanvas | null, live = true) {
  return renderHook(
    ({ live: isLive }: { live: boolean }) =>
      useTablePartyArrival({
        repository,
        sceneId: 'scene-forest',
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        canvas,
        live: isLive,
        players: PLAYERS,
      }),
    { initialProps: { live } }
  );
}

async function setArrival() {
  await runSceneCommand(repository, {
    expectedRevision: revision(),
    operationId: 'arrive',
    command: {
      type: 'scene.setArrivalPoint',
      sceneId: 'scene-forest',
      point: { x: 300, y: 200 },
      at: AT,
    },
  });
}

describe('W11 party arrival', () => {
  it('is disabled with a reason until an arrival point exists and the scene is live', async () => {
    const { canvas } = fakeCanvas();
    const { result, rerender } = mount(canvas, false);
    expect(result.current.canBring).toBe(false);
    expect(result.current.disabledReason).toBe('Set an arrival point first.');
    await act(async () => setArrival());
    await waitFor(() =>
      expect(result.current.arrivalPoint).toEqual({ x: 300, y: 200 })
    );
    expect(result.current.disabledReason).toBe(
      'Waiting for a live connection before placing tokens.'
    );
    rerender({ live: true });
    expect(result.current.canBring).toBe(true);
    expect(result.current.disabledReason).toBeNull();
  });

  it('adds missing party members and places only members without a live token', async () => {
    await addMember(PLAYERS[0]!);
    await addMember(PLAYERS[1]!);
    await setArrival();
    const { canvas, elements, stamps } = fakeCanvas();
    // Aria already has a placed, bound token: it must not move or duplicate.
    await runRosterCommand(repository, {
      expectedRevision: revision(),
      operationId: 'bind-aria',
      command: {
        type: 'roster.bindToken',
        sceneId: 'scene-forest',
        sceneMemberId: 'member-p-aria',
        tokenId: 'token-aria',
        at: AT,
      },
    });
    elements.push({ id: 'token-aria', position: { x: 9, y: 9 } });
    const { result } = mount(canvas);
    await waitFor(() => expect(result.current.canBring).toBe(true));
    await act(async () => {
      await result.current.bringParty();
    });
    expect(stamps.map(stamp => stamp.name).sort()).toEqual(['Bran', 'Cora']);
    expect(stamps.map(stamp => stamp.slot)).toEqual([0, 1]);
    expect(elements.find(element => element.id === 'token-aria')).toEqual({
      id: 'token-aria',
      position: { x: 9, y: 9 },
    });
    const members = snapshot().scenes[0]!.members;
    expect(members).toHaveLength(3);
    for (const stamp of stamps)
      expect(
        members.some(member => member.tokenIds.includes(stamp.tokenId))
      ).toBe(true);
    expect(result.current.notice).toMatchObject({ tone: 'success' });

    // Re-running is a no-op: every party member now has a live token.
    const before = revision();
    await act(async () => {
      await result.current.bringParty();
    });
    expect(stamps).toHaveLength(2);
    expect(revision()).toBe(before);
  });

  it('reports a partial failure per member with a working Retry', async () => {
    await setArrival();
    const refuse = new Set(['Cora']);
    const { canvas, stamps } = fakeCanvas({ refuse });
    const { result } = mount(canvas);
    await waitFor(() => expect(result.current.canBring).toBe(true));
    await act(async () => {
      await result.current.bringParty();
    });
    expect(result.current.notice).toMatchObject({
      tone: 'error',
      message: 'Not placed: Cora. The others arrived.',
    });
    expect(stamps.map(stamp => stamp.name).sort()).toEqual(['Aria', 'Bran']);
    refuse.clear();
    await act(async () => {
      result.current.notice?.retry?.();
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    await waitFor(() =>
      expect(stamps.map(stamp => stamp.name).sort()).toEqual([
        'Aria',
        'Bran',
        'Cora',
      ])
    );
  });

  it('places nothing when not live', async () => {
    await setArrival();
    const { canvas, stamps } = fakeCanvas();
    const { result } = mount(canvas, false);
    await act(async () => {
      await result.current.bringParty();
    });
    expect(stamps).toEqual([]);
    expect(snapshot().scenes[0]!.members).toEqual([]);
  });

  it('refreshes a stale players snapshot before bringing the party (acceptance A1)', async () => {
    await setArrival();
    const { canvas, stamps } = fakeCanvas();
    const mira = { playerId: 'p-mira', characterId: 'p-mira', name: 'Mira' };
    const reloadPlayers = vi.fn(async () => [mira]);
    const { result } = renderHook(() =>
      useTablePartyArrival({
        repository,
        sceneId: 'scene-forest',
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        canvas,
        live: true,
        // Loaded before anyone joined.
        players: [],
        reloadPlayers,
      })
    );
    await waitFor(() => expect(result.current.canBring).toBe(true));
    await act(async () => {
      await result.current.bringParty();
    });
    expect(reloadPlayers).toHaveBeenCalledTimes(1);
    expect(stamps.map(stamp => stamp.name)).toEqual(['Mira']);
    expect(snapshot().scenes[0]!.members).toHaveLength(1);
    expect(result.current.notice).toMatchObject({ tone: 'success' });
  });

  it('says no players have joined instead of "whole party is already here" (A1)', async () => {
    await setArrival();
    const { canvas, stamps } = fakeCanvas();
    const { result } = renderHook(() =>
      useTablePartyArrival({
        repository,
        sceneId: 'scene-forest',
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        canvas,
        live: true,
        players: [],
        reloadPlayers: async () => [],
      })
    );
    await waitFor(() => expect(result.current.canBring).toBe(true));
    await act(async () => {
      await result.current.bringParty();
    });
    expect(stamps).toEqual([]);
    expect(result.current.notice).toMatchObject({
      tone: 'info',
      message: 'No players have joined this campaign yet.',
    });
  });

  it('reports unavailable players without placing anything (A1)', async () => {
    await setArrival();
    const { canvas, stamps } = fakeCanvas();
    const { result } = renderHook(() =>
      useTablePartyArrival({
        repository,
        sceneId: 'scene-forest',
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        canvas,
        live: true,
        players: undefined,
        reloadPlayers: async () => null,
      })
    );
    await waitFor(() => expect(result.current.canBring).toBe(true));
    await act(async () => {
      await result.current.bringParty();
    });
    expect(stamps).toEqual([]);
    expect(result.current.notice).toMatchObject({
      tone: 'error',
      message:
        'Campaign players are unavailable. Nothing was placed — try again.',
    });
  });

  it('says the whole party is already here only when members exist and all have tokens (N2)', async () => {
    await addMember(PLAYERS[0]!);
    await setArrival();
    const { canvas, elements, stamps } = fakeCanvas();
    await runRosterCommand(repository, {
      expectedRevision: revision(),
      operationId: 'bind-aria-2',
      command: {
        type: 'roster.bindToken',
        sceneId: 'scene-forest',
        sceneMemberId: 'member-p-aria',
        tokenId: 'token-aria',
        at: AT,
      },
    });
    elements.push({ id: 'token-aria' });
    const { result } = renderHook(() =>
      useTablePartyArrival({
        repository,
        sceneId: 'scene-forest',
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        canvas,
        live: true,
        players: [],
        reloadPlayers: async () => [PLAYERS[0]!],
      })
    );
    await waitFor(() => expect(result.current.canBring).toBe(true));
    await act(async () => {
      await result.current.bringParty();
    });
    expect(stamps).toEqual([]);
    expect(result.current.notice).toMatchObject({
      tone: 'success',
      message: 'The whole party is already here.',
    });
  });
});
