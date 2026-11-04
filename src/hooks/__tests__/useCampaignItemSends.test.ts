import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

import { useCampaignItemSends } from '../useCampaignItemSends';
import type { CampaignPlayerData } from '@/types/campaign';
import type { CharacterState, MagicItem } from '@/types/character';
import type { NPCInventoryItem } from '@/types/encounter';

const players: CampaignPlayerData[] = [
  {
    playerId: 'p1',
    playerName: 'Alice',
    characterId: 'c1',
    characterName: 'Thorin',
    characterData: {} as CharacterState,
    lastSynced: '2026-11-04T12:00:00.000Z',
  },
];

const rope: NPCInventoryItem = { id: 'i1', name: 'Rope', quantity: 1 };
const cloak = { id: 'm1', name: 'Cloak of Elvenkind' } as MagicItem;

function parseBody(call: unknown[]) {
  const init = call[1] as RequestInit | undefined;
  return JSON.parse(init!.body as string);
}

describe('useCampaignItemSends', () => {
  const addToast = vi.fn();

  beforeEach(() => {
    addToast.mockReset();
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function renderSends() {
    return renderHook(() =>
      useCampaignItemSends({
        code: 'K7QX2M',
        dmId: 'dm-synth',
        players,
        addToast,
      })
    );
  }

  it('targets every player in the campaign', () => {
    const { result } = renderSends();
    expect(result.current.sendTargets).toEqual([
      {
        playerId: 'p1',
        playerName: 'Alice',
        characterName: 'Thorin',
        characterId: 'c1',
      },
    ]);
  });

  it('opens the send dialog with the NPC item as an inventory item', () => {
    const { result } = renderSends();
    act(() => result.current.openNpcItemSend(rope, 'Grimble'));
    expect(result.current.sendItemDialog.open).toBe(true);
    expect(result.current.sendItemDialog.item).toMatchObject({
      name: 'Rope',
      category: 'misc',
      location: 'Backpack',
    });
  });

  it('keeps the converted item stable across renders', () => {
    const { result, rerender } = renderSends();
    act(() => result.current.openNpcItemSend(rope, 'Grimble'));
    const first = result.current.sendItemDialog.item;
    rerender();
    expect(result.current.sendItemDialog.item).toBe(first);
  });

  it('sends the NPC item and says so', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const { result } = renderSends();
    const target = result.current.sendTargets[0];
    act(() => result.current.openNpcItemSend(rope, 'Grimble'));
    await act(() =>
      result.current.sendItemDialog.onSend(
        result.current.sendItemDialog.item!,
        target
      )
    );
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/campaign/K7QX2M/shared');
    expect(parseBody(vi.mocked(fetch).mock.calls[0])).toMatchObject({
      feature: 'item_transfer',
      dmId: 'dm-synth',
      data: {
        playerId: 'p1',
        transfer: {
          fromPlayerName: 'DM',
          fromCharacterName: 'Grimble',
          fromType: 'npc',
        },
      },
    });
    expect(addToast).toHaveBeenCalledWith({
      type: 'success',
      title: 'Item sent',
      message: 'Rope sent to Thorin.',
    });
    expect(result.current.sendItemDialog.sending).toBe(false);
  });

  it('reports sending while the NPC item request is in flight', async () => {
    let resolve: (value: Response) => void = () => {};
    vi.mocked(fetch).mockReturnValue(
      new Promise<Response>(r => {
        resolve = r;
      })
    );
    const { result } = renderSends();
    const target = result.current.sendTargets[0];
    act(() => result.current.openNpcItemSend(rope, 'Grimble'));
    expect(result.current.sendItemDialog.sending).toBe(false);
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.sendItemDialog.onSend(
        result.current.sendItemDialog.item!,
        target
      );
    });
    expect(result.current.sendItemDialog.sending).toBe(true);
    await act(async () => {
      resolve({ ok: true } as Response);
      await pending;
    });
    expect(result.current.sendItemDialog.sending).toBe(false);
  });

  it('says the NPC item was not sent', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    const { result } = renderSends();
    const target = result.current.sendTargets[0];
    act(() => result.current.openNpcItemSend(rope, 'Grimble'));
    await act(() =>
      result.current.sendItemDialog.onSend(
        result.current.sendItemDialog.item!,
        target
      )
    );
    expect(addToast).toHaveBeenCalledWith({
      type: 'error',
      title: 'Item not sent',
      message: "Rope wasn't sent to Thorin. Try again.",
    });
    expect(result.current.sendItemDialog.sending).toBe(false);
  });

  it('sends a library magic item and keeps the library copy', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const { result } = renderSends();
    const target = result.current.sendTargets[0];
    await act(() => result.current.giveLibraryMagicItem(cloak, target));
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/campaign/K7QX2M/shared');
    const body = parseBody(vi.mocked(fetch).mock.calls[0]);
    expect(body).toMatchObject({
      feature: 'item_transfer',
      dmId: 'dm-synth',
      data: { playerId: 'p1' },
    });
    expect(body.data.transfer).toMatchObject({
      itemKind: 'magic',
      fromPlayerName: 'DM',
      fromCharacterName: 'Magic Item Library',
      fromType: 'dm',
    });
    expect(addToast).toHaveBeenCalledWith({
      type: 'success',
      title: 'Magic item sent',
      message: 'Cloak of Elvenkind sent to Thorin. The library copy was kept.',
    });
  });

  it('says the magic item was not sent', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    const { result } = renderSends();
    const target = result.current.sendTargets[0];
    await act(() => result.current.giveLibraryMagicItem(cloak, target));
    expect(addToast).toHaveBeenCalledWith({
      type: 'error',
      title: 'Magic item not sent',
      message: "Cloak of Elvenkind wasn't sent to Thorin. Try again.",
    });
  });

  it('clears the pending item on close', () => {
    const { result } = renderSends();
    act(() => result.current.openNpcItemSend(rope, 'Grimble'));
    act(() => result.current.sendItemDialog.onClose());
    expect(result.current.sendItemDialog).toMatchObject({
      open: false,
      item: null,
    });
  });
});
