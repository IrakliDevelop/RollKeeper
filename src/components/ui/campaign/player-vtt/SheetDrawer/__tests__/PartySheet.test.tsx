import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import type { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';

import { PartySheet } from '../PartySheet';

const SHARED_MEMBER: PartyMemberHP = {
  characterId: 'char-1',
  characterName: 'Thorn',
  playerName: 'Alice',
  className: 'Fighter',
  level: 3,
  armorClass: 16,
  hitPoints: { current: 20, max: 30, temporary: 0 },
  lastSynced: '2025-01-01T00:00:00.000Z',
  publicSheet: {
    subtitle: 'Fighter 3',
    hpState: 'Injured',
    speed: 30,
    passivePerception: 13,
    conditions: ['Prone'],
    concentration: "Hunter's Mark",
    equippedGear: ['Longsword', 'Chain Mail'],
  },
};

afterEach(() => cleanup());

describe('PartySheet', () => {
  it('renders the header, condition, stats and gear from the public sheet', () => {
    render(<PartySheet member={SHARED_MEMBER} onClose={vi.fn()} />);

    expect(screen.getByText('Thorn')).toBeInTheDocument();
    expect(screen.getByText('Fighter 3')).toBeInTheDocument();
    expect(
      screen.getByText(/limited view.*played by alice/i)
    ).toBeInTheDocument();

    expect(screen.getByText('Injured')).toBeInTheDocument();
    expect(screen.getByText('20/30')).toBeInTheDocument();
    expect(screen.getByText("Hunter's Mark")).toBeInTheDocument();
    expect(screen.getByText('Prone')).toBeInTheDocument();

    expect(screen.getByText('16')).toBeInTheDocument();
    expect(screen.getByText(/30 ft/)).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();

    expect(screen.getByText('Longsword')).toBeInTheDocument();
    expect(screen.getByText('Chain Mail')).toBeInTheDocument();

    expect(screen.getByText(/alice controls this sheet/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /close sheet/i })
    ).toBeInTheDocument();
  });

  it('hides exact HP and shows only the HP word when hitPoints is not shared', () => {
    const member: PartyMemberHP = {
      ...SHARED_MEMBER,
      hitPoints: null,
    };
    render(<PartySheet member={member} onClose={vi.fn()} />);

    expect(screen.getByText('Injured')).toBeInTheDocument();
    expect(screen.queryByText('20/30')).toBeNull();
    expect(screen.queryByText(/\d+\/\d+/)).toBeNull();
  });

  it('treats an undefined publicSheet like null (server skew)', () => {
    const member: PartyMemberHP = {
      ...SHARED_MEMBER,
      publicSheet: undefined as unknown as PartyMemberHP['publicSheet'],
    };
    render(<PartySheet member={member} onClose={vi.fn()} />);

    expect(
      screen.getByText(/thorn hasn't shared their sheet/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Injured')).toBeNull();
  });

  it('shows a not-shared state and a fallback subtitle when publicSheet is null', () => {
    const member: PartyMemberHP = { ...SHARED_MEMBER, publicSheet: null };
    render(<PartySheet member={member} onClose={vi.fn()} />);

    expect(screen.getByText('Thorn')).toBeInTheDocument();
    // Fallback subtitle: className + level, since publicSheet.subtitle is
    // unavailable.
    expect(screen.getByText('Fighter 3')).toBeInTheDocument();
    expect(
      screen.getByText(/thorn hasn't shared their sheet/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Injured')).toBeNull();
    expect(
      screen.getByRole('button', { name: /close sheet/i })
    ).toBeInTheDocument();
  });

  it('shows a missing-member state when the character is not in the party list', () => {
    const onClose = vi.fn();
    render(<PartySheet member={undefined} onClose={onClose} />);

    expect(
      screen.getByText(/isn't in the party list yet/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /close sheet/i })
    ).toBeInTheDocument();
  });

  it('calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(<PartySheet member={SHARED_MEMBER} onClose={onClose} />);
    screen.getByRole('button', { name: /close sheet/i }).click();
    expect(onClose).toHaveBeenCalled();
  });
});
