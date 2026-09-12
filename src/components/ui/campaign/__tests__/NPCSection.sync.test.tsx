import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDmStore } from '@/store/dmStore';
import { useNPCStore } from '@/store/npcStore';

import { NpcSyncProvider } from '../NpcSyncControls';
import { NPCSection } from '../NPCSection';

// The NPC editor dialogs load reference compendium data on mount, so they are
// stubbed to keep the network assertion attributable to the sync controls.
vi.mock('../NPCFormDialog', () => ({ NPCFormDialog: () => null }));
vi.mock('../NPCDetailDialog', () => ({ NPCDetailDialog: () => null }));

describe('NPCSection cloud sync mount', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
    useNPCStore.setState({ npcsByCampaign: {} });
    useDmStore.setState({
      campaigns: [
        {
          code: 'empty-campaign',
          name: 'Empty campaign',
          createdAt: '2026-08-23T00:00:00.000Z',
        },
      ],
    });
  });

  it('keeps the default-off cloud sync card and its network work out of the section', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<NPCSection campaignCode="empty-campaign" players={[]} />);

    // The campaign exists, so the missing card is attributable to the flag.
    expect(useDmStore.getState().getCampaign('empty-campaign')).toBeDefined();
    expect(screen.queryByText('NPC cloud sync')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('mounts the cloud sync card while the NPC section is collapsed', () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    useDmStore.setState({
      campaigns: [
        {
          code: 'empty-campaign',
          name: 'Empty campaign',
          createdAt: '2026-08-23T00:00:00.000Z',
          dmDashboardUi: { npcSectionOpen: false },
        },
      ],
    });
    render(
      <NpcSyncProvider campaignCode="empty-campaign">
        <NPCSection campaignCode="empty-campaign" players={[]} />
      </NpcSyncProvider>
    );

    // Edits made from the always-visible header must still reach the sync
    // effect, so the controls cannot live inside the collapsible block.
    expect(screen.queryByText(/No NPCs yet/)).not.toBeInTheDocument();
    expect(screen.getByText('NPC cloud sync')).toBeInTheDocument();
  });

  it('renders no card and does not throw when the route owner is absent', () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');

    // The owner lives in app/dm/campaign/[code]/layout.tsx, so a section
    // rendered outside that group simply has no card to read.
    expect(() =>
      render(<NPCSection campaignCode="empty-campaign" players={[]} />)
    ).not.toThrow();
    expect(screen.queryByText('NPC cloud sync')).toBeNull();
  });

  it('moves a creature between the NPC and custom monster sections in one click', () => {
    useNPCStore.setState({
      npcsByCampaign: {
        'empty-campaign': [
          {
            id: 'npc-legacy',
            campaignCode: 'empty-campaign',
            name: 'Shapechanger',
            armorClass: '15',
            maxHp: 44,
            speed: '30 ft.',
            inventory: [{ id: 'key', name: 'Vault Key', quantity: 1 }],
            createdAt: '2026-09-12T00:00:00.000Z',
            updatedAt: '2026-09-12T00:00:00.000Z',
          },
        ],
      },
    });

    render(
      <>
        <NPCSection
          campaignCode="empty-campaign"
          kind="npc"
          showLibraryExtras={false}
        />
        <NPCSection
          campaignCode="empty-campaign"
          kind="monster"
          showSpellSlotSettings={false}
          showLibraryExtras={false}
        />
      </>
    );

    expect(screen.getByText('NPCs (1)')).toBeInTheDocument();
    expect(screen.getByText('Custom Monsters (0)')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: /move shapechanger to custom monsters/i,
      })
    );
    expect(screen.getByText('NPCs (0)')).toBeInTheDocument();
    expect(screen.getByText('Custom Monsters (1)')).toBeInTheDocument();
    expect(
      useNPCStore.getState().getNPC('empty-campaign', 'npc-legacy')
    ).toMatchObject({
      kind: 'monster',
      inventory: [{ id: 'key', name: 'Vault Key', quantity: 1 }],
    });
  });
});
