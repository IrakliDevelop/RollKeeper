import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDmStore } from '@/store/dmStore';
import { useNPCStore } from '@/store/npcStore';

import { NPCSection } from '../NPCSection';

// The NPC editor dialogs load reference compendium data on mount, so they are
// stubbed to keep the network assertion attributable to the sync controls.
vi.mock('../NPCFormDialog', () => ({ NPCFormDialog: () => null }));
vi.mock('../NPCDetailDialog', () => ({ NPCDetailDialog: () => null }));

describe('NPCSection cloud sync mount', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
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
    render(<NPCSection campaignCode="empty-campaign" players={[]} />);

    // Edits made from the always-visible header must still reach the sync
    // effect, so the controls cannot live inside the collapsible block.
    expect(screen.queryByText(/No NPCs yet/)).not.toBeInTheDocument();
    expect(screen.getByText('NPC cloud sync')).toBeInTheDocument();
  });
});
