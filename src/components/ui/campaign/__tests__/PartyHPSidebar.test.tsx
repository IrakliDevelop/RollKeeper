import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PartyHPSidebar } from '../PartyHPSidebar';
import type { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // `fill` and `priority` are next/image-only props that are not valid
    // native <img> attributes; drop them before spreading onto the stub.
    const rest = { ...props };
    delete rest.fill;
    delete rest.priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

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
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    cleanup();
    localStorage.removeItem('rollkeeper-party-hp-sidebar');
    vi.unstubAllGlobals();
  });

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
    expect(screen.getByText('Loading party…')).toBeInTheDocument();
  });

  it('shows an empty state once loaded with no synced members', () => {
    render(
      <PartyHPSidebar campaignCode="ABCD" partyMembers={[]} loading={false} />
    );
    expect(screen.getByText('No party members synced')).toBeInTheDocument();
  });

  it('names the handle, reports aria-expanded and shows the party size when closed', async () => {
    const user = userEvent.setup();
    render(
      <PartyHPSidebar
        campaignCode="ABCD"
        partyMembers={[MEMBER, { ...MEMBER, characterId: 'char-2' }]}
        loading={false}
      />
    );
    const handle = screen.getByRole('button', { name: 'Show party HP' });
    expect(handle).toHaveAttribute('aria-expanded', 'false');
    expect(handle).toHaveTextContent('2');

    await user.click(handle);

    const open = screen.getByRole('button', { name: 'Hide party HP' });
    expect(open).toHaveAttribute('aria-expanded', 'true');
  });

  it('gives the avatar an empty alt next to the visible name', () => {
    const { container } = render(
      <PartyHPSidebar
        campaignCode="ABCD"
        partyMembers={[
          { ...MEMBER, avatar: 'data:image/png;base64,cG9ydHJhaXQ=' },
        ]}
        loading={false}
      />
    );
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Thorn')).toBeInTheDocument();
  });
});
