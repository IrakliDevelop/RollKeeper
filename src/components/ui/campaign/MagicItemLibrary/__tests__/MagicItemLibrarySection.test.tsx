import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDmStore } from '@/store/dmStore';
import { useMagicItemLibraryStore } from '@/store/magicItemLibraryStore';
import { useNPCStore } from '@/store/npcStore';
import { MagicItemLibrarySection } from '../MagicItemLibrarySection';

vi.mock('../MagicItemLibraryDialog', () => ({
  MagicItemLibraryDialog: () => null,
}));

describe('MagicItemLibrarySection', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    useMagicItemLibraryStore.setState({ itemsByCampaign: {} });
    useNPCStore.setState({ npcsByCampaign: {} });
    useDmStore.setState({
      campaigns: [
        {
          code: 'empty-campaign',
          name: 'Empty campaign',
          createdAt: '2026-08-08T00:00:00.000Z',
        },
      ],
    });
  });

  it('renders an empty campaign without an external-store snapshot loop', () => {
    render(
      <MagicItemLibrarySection
        campaignCode="empty-campaign"
        players={[]}
        onGiveToPlayer={async () => {}}
      />
    );

    expect(screen.getByText('Magic Item Library (0)')).toBeInTheDocument();
    expect(screen.getByText(/No custom magic items yet/)).toBeInTheDocument();
  });

  it('keeps the default-off cloud sync card and its network work out of the section', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(
      <MagicItemLibrarySection
        campaignCode="empty-campaign"
        players={[]}
        onGiveToPlayer={async () => {}}
      />
    );

    // The campaign exists, so the missing card is attributable to the flag.
    expect(useDmStore.getState().getCampaign('empty-campaign')).toBeDefined();
    expect(screen.queryByText('Magic item library cloud sync')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('mounts the cloud sync card while the section is collapsed', () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    useDmStore.setState({
      campaigns: [
        {
          code: 'empty-campaign',
          name: 'Empty campaign',
          createdAt: '2026-08-08T00:00:00.000Z',
          dmDashboardUi: { magicItemLibrarySectionOpen: false },
        },
      ],
    });
    render(
      <MagicItemLibrarySection
        campaignCode="empty-campaign"
        players={[]}
        onGiveToPlayer={async () => {}}
      />
    );

    // Edits made from the always-visible header must still reach the sync
    // effect, so the controls cannot live inside the collapsible block.
    expect(
      screen.queryByText(/No custom magic items yet/)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create Magic Item' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Magic item library cloud sync')
    ).toBeInTheDocument();
  });

  it('collapses independently while keeping creation available', async () => {
    const user = userEvent.setup();
    render(
      <MagicItemLibrarySection
        campaignCode="empty-campaign"
        players={[]}
        onGiveToPlayer={async () => {}}
      />
    );

    await user.click(
      screen.getByRole('button', { name: 'Collapse magic item library' })
    );

    expect(
      screen.queryByText(/No custom magic items yet/)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create Magic Item' })
    ).toBeInTheDocument();
    expect(
      useDmStore.getState().getCampaign('empty-campaign')?.dmDashboardUi
        ?.magicItemLibrarySectionOpen
    ).toBe(false);
  });

  it('groups give recipients into players and NPCs', async () => {
    const now = '2026-08-08T00:00:00.000Z';
    useMagicItemLibraryStore.setState({
      itemsByCampaign: {
        'empty-campaign': [
          {
            id: 'healing-potion',
            campaignCode: 'empty-campaign',
            name: 'Potion of Healing',
            category: 'potion',
            rarity: 'common',
            description: 'Restores hit points.',
            properties: [],
            requiresAttunement: false,
            isAttuned: false,
            tags: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    });
    useNPCStore.setState({
      npcsByCampaign: {
        'empty-campaign': [
          {
            id: 'npc-1',
            campaignCode: 'empty-campaign',
            name: 'Sildar',
            armorClass: '16',
            maxHp: 27,
            speed: '30 ft.',
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    });
    const user = userEvent.setup();
    render(
      <MagicItemLibrarySection
        campaignCode="empty-campaign"
        players={[
          {
            playerId: 'player-1',
            playerName: 'Alice',
            characterId: 'character-1',
            characterName: 'Aria',
          },
        ]}
        onGiveToPlayer={async () => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Give copy' }));
    await user.click(screen.getByRole('combobox'));

    expect(screen.getByText('Players')).toBeInTheDocument();
    expect(screen.getByText('Aria')).toBeInTheDocument();
    expect(screen.getByText('NPCs')).toBeInTheDocument();
    expect(screen.getByText('Sildar')).toBeInTheDocument();
  });
});
