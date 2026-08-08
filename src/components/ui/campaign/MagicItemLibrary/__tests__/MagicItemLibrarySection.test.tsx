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
  afterEach(cleanup);

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
});
