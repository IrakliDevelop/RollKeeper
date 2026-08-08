import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMagicItemLibraryStore } from '@/store/magicItemLibraryStore';
import { useNPCStore } from '@/store/npcStore';
import { MagicItemLibrarySection } from '../MagicItemLibrarySection';

vi.mock('../MagicItemLibraryDialog', () => ({
  MagicItemLibraryDialog: () => null,
}));

describe('MagicItemLibrarySection', () => {
  beforeEach(() => {
    useMagicItemLibraryStore.setState({ itemsByCampaign: {} });
    useNPCStore.setState({ npcsByCampaign: {} });
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
});
