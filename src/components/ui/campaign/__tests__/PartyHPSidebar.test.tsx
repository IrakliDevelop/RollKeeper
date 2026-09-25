import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { PartyHPSidebar } from '../PartyHPSidebar';
import type { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';

const MEMBER: PartyMemberHP = {
  characterId: 'char-1',
  characterName: 'Thorn',
  playerName: 'Alice',
  className: 'Fighter',
  level: 3,
  armorClass: 16,
  hitPoints: { current: 20, max: 30, temporary: 0 },
  lastSynced: '2025-01-01T00:00:00.000Z',
};

describe('PartyHPSidebar', () => {
  afterEach(() => cleanup());

  it('renders nothing when not in a campaign', () => {
    const { container } = render(
      <PartyHPSidebar campaignCode={null} partyMembers={[]} loading={false} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders members passed in as props — no data fetching of its own', () => {
    render(
      <PartyHPSidebar
        campaignCode="ABCD"
        partyMembers={[MEMBER]}
        loading={false}
      />
    );
    expect(screen.getByText('Thorn')).toBeInTheDocument();
    expect(screen.getByText(/20\/30/)).toBeInTheDocument();
  });

  it('shows a loading state when loading is true, regardless of partyMembers', () => {
    render(
      <PartyHPSidebar campaignCode="ABCD" partyMembers={[]} loading={true} />
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an empty state once loaded with no synced members', () => {
    render(
      <PartyHPSidebar campaignCode="ABCD" partyMembers={[]} loading={false} />
    );
    expect(screen.getByText(/no party members synced/i)).toBeInTheDocument();
  });
});
