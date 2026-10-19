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
import { useNPCStore } from '@/store/npcStore';
import {
  clickConfirmDialogButton,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';
import type { CampaignNPC } from '@/types/encounter';

const npc = (id: string, name: string): CampaignNPC => ({
  id,
  campaignCode: 'CAMP1',
  name,
  armorClass: '12',
  maxHp: 20,
  speed: '30 ft.',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
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
