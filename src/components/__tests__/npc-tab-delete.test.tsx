// @vitest-environment jsdom
import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NpcTab } from '@/components/ui/encounter/combat-screen/AddCombatantDialog/NpcTab';
import { useDmStore } from '@/store/dmStore';
import { useNPCStore } from '@/store/npcStore';
import {
  clickConfirmDialogButton,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';
import { mockFetchResponse, resetFetch } from '@/test/mocks/fetch';
import type { CampaignNPC } from '@/types/encounter';

const npc = (
  id: string,
  name: string,
  extra: Partial<CampaignNPC> = {}
): CampaignNPC => ({
  id,
  campaignCode: 'CAMP1',
  name,
  armorClass: '12',
  maxHp: 20,
  speed: '30 ft.',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  ...extra,
});

// Passes `npcs` the way EncounterView does: read from the store on render.
function NpcTabInEncounter() {
  const { getNPCsForCampaign } = useNPCStore();
  return (
    <NpcTab
      npcs={getNPCsForCampaign('CAMP1')}
      campaignCode="CAMP1"
      onAdd={vi.fn()}
    />
  );
}

describe('NpcTab — deleting a saved NPC', () => {
  beforeEach(() => {
    useNPCStore.setState({
      npcsByCampaign: {
        CAMP1: [npc('npc1', 'Town Guard'), npc('npc2', 'Forest Scout')],
      },
    });
  });

  afterEach(() => {
    cleanup();
    resetFetch();
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  it('drops the NPC from the list while the tab stays open', async () => {
    renderConfirmDialogHost();
    render(<NpcTabInEncounter />);
    expect(screen.getByText('Town Guard')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Town Guard' }));
    await clickConfirmDialogButton('Delete NPC');

    expect(screen.queryByText('Town Guard')).not.toBeInTheDocument();
    expect(screen.getByText('Forest Scout')).toBeInTheDocument();
  });

  it('closes the published shop when the deleted NPC has an open shop', async () => {
    const fetchFn = mockFetchResponse(200, { success: true, shop: null });
    useNPCStore.setState({
      npcsByCampaign: {
        CAMP1: [
          npc('npc1', 'Town Guard', {
            shop: {
              open: true,
              updatedAt: '2026-09-12T00:00:00.000Z',
              description: 'Ironmonger of the Low Market',
            },
          }),
        ],
      },
    });
    renderConfirmDialogHost();
    render(<NpcTabInEncounter />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Town Guard' }));
    await clickConfirmDialogButton('Delete NPC');

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/campaign/CAMP1/shops/npc1');
    expect(init.method).toBe('PUT');
    const body = JSON.parse(init.body as string);
    expect(body.npc.shop).toEqual(
      expect.objectContaining({
        open: false,
        description: 'Ironmonger of the Low Market',
      })
    );
    expect(body.entityIds).toEqual([]);
    expect(body.dmId).toBe(useDmStore.getState().dmId);
    expect(screen.queryByText('Town Guard')).not.toBeInTheDocument();
  });

  it.each([
    [
      'a closed shop',
      { shop: { open: false, updatedAt: '2026-09-12T00:00:00.000Z' } },
    ],
    ['no shop', {}],
  ])('sends nothing when the deleted NPC has %s', async (_label, extra) => {
    const fetchFn = mockFetchResponse(200, { success: true, shop: null });
    useNPCStore.setState({
      npcsByCampaign: { CAMP1: [npc('npc1', 'Town Guard', extra)] },
    });
    renderConfirmDialogHost();
    render(<NpcTabInEncounter />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Town Guard' }));
    await clickConfirmDialogButton('Delete NPC');

    expect(fetchFn).not.toHaveBeenCalled();
    expect(screen.queryByText('Town Guard')).not.toBeInTheDocument();
  });

  it('uses the current store version when props still hold an older NPC', () => {
    render(
      <NpcTab
        npcs={[npc('npc1', 'Old Guard')]}
        campaignCode="CAMP1"
        onAdd={vi.fn()}
      />
    );
    expect(screen.getByText('Town Guard')).toBeInTheDocument();
    expect(screen.queryByText('Old Guard')).not.toBeInTheDocument();
  });

  it('returns focus to saved-creature search after a confirmed deletion', async () => {
    renderConfirmDialogHost();
    render(<NpcTabInEncounter />);
    const deleteButton = screen.getByRole('button', {
      name: 'Delete Town Guard',
    });
    deleteButton.focus();
    fireEvent.click(deleteButton);
    await clickConfirmDialogButton('Delete NPC');
    expect(
      screen.getByRole('textbox', { name: /search saved creatures/i })
    ).toHaveFocus();
  });

  it('focuses Create NPC after deleting the last saved NPC', async () => {
    useNPCStore.setState({
      npcsByCampaign: { CAMP1: [npc('npc1', 'Town Guard')] },
    });
    renderConfirmDialogHost();
    render(<NpcTabInEncounter />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Town Guard' }));
    await clickConfirmDialogButton('Delete NPC');
    expect(screen.getByRole('button', { name: 'Create NPC' })).toHaveFocus();
  });

  it('shows an NPC created elsewhere while the tab is open', () => {
    render(<NpcTab npcs={[]} campaignCode="CAMP1" onAdd={vi.fn()} />);

    expect(screen.queryByText('Hill Watcher')).not.toBeInTheDocument();

    act(() => {
      useNPCStore.setState(state => ({
        npcsByCampaign: {
          CAMP1: [...state.npcsByCampaign.CAMP1, npc('npc3', 'Hill Watcher')],
        },
      }));
    });

    expect(screen.getByText('Hill Watcher')).toBeInTheDocument();
  });
});
