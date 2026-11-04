import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  answerConfirmDialogs,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';
import { useCampaignSync } from '@/hooks/useCampaignSync';
import { useHydration } from '@/hooks/useHydration';
import { useDmStore } from '@/store/dmStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CampaignInfo, CampaignPlayerData } from '@/types/campaign';

import CampaignViewPage from '../page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ code: 'K7QX2M' }),
  // ConfirmDialogHost reads the pathname.
  usePathname: () => '/dm/campaign/K7QX2M',
}));

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

vi.mock('@/components/auth/HeaderTrailing', () => ({
  HeaderTrailing: () => <button>Theme</button>,
}));

vi.mock('@/hooks/useCampaignSync', () => ({ useCampaignSync: vi.fn() }));
vi.mock('@/hooks/useDmCounterSync', () => ({ useDmCounterSync: vi.fn() }));
vi.mock('@/hooks/useDmSettingsSync', () => ({ useDmSettingsSync: vi.fn() }));
vi.mock('@/hooks/useHydration', () => ({ useHydration: vi.fn(() => true) }));

vi.mock('@/components/ui/campaign/NPCSection', () => ({
  NPCSection: ({ kind }: { kind: string }) => (
    <div data-testid={`npc-section-${kind}`} />
  ),
}));
vi.mock('@/components/ui/campaign/CampaignSettingsSyncControls', () => ({
  CampaignSettingsSyncControls: () => null,
}));
vi.mock('@/components/ui/campaign/PlayerDetailDialog', () => ({
  PlayerDetailDialog: ({ player }: { player: CampaignPlayerData }) => (
    <div data-testid="player-detail" data-player={player.playerId} />
  ),
}));
vi.mock('@/components/ui/campaign/SendMessageDialog', () => ({
  SendMessageDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="send-message-dialog" /> : null,
}));
vi.mock('@/components/ui/campaign/AwardXpDialog', () => ({
  AwardXpDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="award-xp-dialog" /> : null,
}));

const NOW = '2026-11-04T12:00:00.000Z';

function makePlayer(
  playerId: string,
  characterName: string,
  playerName: string
): CampaignPlayerData {
  return {
    playerId,
    playerName,
    characterId: `char-${playerId}`,
    characterName,
    characterData: makeCharacter({
      id: `char-${playerId}`,
      name: characterName,
    }),
    lastSynced: new Date().toISOString(),
  };
}

const p1 = makePlayer('p1', 'Thorin', 'Alice');
const p2 = makePlayer('p2', 'Lyra', 'Bob');
const refresh = vi.fn<() => Promise<void>>(async () => {});

type SyncResult = ReturnType<typeof useCampaignSync>;

function mockSync(overrides: Partial<SyncResult> = {}) {
  vi.mocked(useCampaignSync).mockReturnValue({
    players: [p1, p2],
    campaignName: 'The Sunken Bell',
    loading: false,
    error: null,
    lastFetched: null,
    refresh,
    ...overrides,
  } as SyncResult);
}

function seedCampaign(extra: Partial<CampaignInfo> = {}) {
  useDmStore.setState({
    dmId: 'dm-synth',
    campaigns: [
      { code: 'K7QX2M', name: 'The Sunken Bell', createdAt: NOW, ...extra },
    ],
  });
}

const open = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  refresh.mockReset().mockResolvedValue(undefined);
  seedCampaign();
  mockSync();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

it('shows Loading campaign… until the stores hydrate', () => {
  vi.mocked(useHydration).mockReturnValueOnce(false);
  render(<CampaignViewPage />);
  expect(screen.getByText('Loading campaign…')).not.toHaveClass(
    'animate-pulse'
  );
});

it('keeps the page links out of the header', () => {
  render(<CampaignViewPage />);
  const header = screen.getByRole('banner');
  expect(
    within(header).getByRole('heading', {
      level: 1,
      name: 'The Sunken Bell',
    })
  ).toBeInTheDocument();
  expect(
    within(header).queryByRole('link', {
      name: /Encounters|Battle maps|Locations|Calendar/,
    })
  ).toBeNull();
  expect(header.innerHTML).not.toContain('min-[1100px]:flex-row'); // no wrapControls
});

it('links the four campaign pages from the rail', () => {
  render(<CampaignViewPage />);
  const navs = screen.getAllByRole('navigation', { name: 'Campaign pages' });
  expect(navs).toHaveLength(2);
  expect(navs[0]).toHaveClass('lg:hidden');
  expect(navs[1]).toHaveClass('hidden', 'lg:block');
  expect(
    within(navs[1]).getByRole('link', { name: 'Battle maps' })
  ).toHaveAttribute('href', '/dm/campaign/K7QX2M/battlemaps');
  expect(document.querySelectorAll('a[class*="accent-"]')).toHaveLength(0);
  // V156 for b1's pieces only: NPCSection (MagicItemLibrarySection's "Create
  // Magic Item", the library "Turn on cloud sync") and CampaignSettingsSyncControls
  // ("Turn on cloud sync") are mocked above; their primaries are a follow-up.
  expect(
    document.querySelectorAll(
      'main button[data-variant="primary"], main a[data-variant="primary"]'
    )
  ).toHaveLength(0);
});

it('shows the banner only when one is set', () => {
  render(<CampaignViewPage />);
  expect(document.querySelector('main img')).toBeNull();
  seedCampaign({ bannerUrl: '/landing/battle-map.webp' });
  cleanup();
  render(<CampaignViewPage />);
  const img = document.querySelector('main img');
  expect(img).not.toBeNull();
  expect(img).toHaveAttribute('alt', '');
  expect(img!.parentElement).toHaveClass(
    'aspect-[16/7]',
    'max-h-48',
    'lg:aspect-video'
  );
});

it('drops the rail banner when it is removed', async () => {
  seedCampaign({
    bannerUrl: '/landing/battle-map.webp',
    dmDashboardUi: { houseRulesSectionOpen: true },
  });
  renderConfirmDialogHost();
  const { titles } = answerConfirmDialogs('confirm');
  render(<CampaignViewPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
  await waitFor(() => expect(document.querySelector('main img')).toBeNull());
  expect(titles).toEqual(['Remove the banner image?']);
  expect(
    useDmStore.getState().getCampaign('K7QX2M')?.bannerUrl
  ).toBeUndefined();
});

it('keeps the rail first and the settings last in reading order', () => {
  render(<CampaignViewPage />);
  const nav = screen.getAllByRole('navigation', { name: 'Campaign pages' })[0];
  const players = screen.getByRole('heading', {
    level: 2,
    name: 'Players (2)',
  });
  const settings = screen.getByRole('heading', {
    level: 2,
    name: 'Campaign settings',
  });
  expect(
    nav.compareDocumentPosition(players) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(
    screen
      .getByTestId('npc-section-monster')
      .compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
});

it('shows Loading players… and still offers the settings', () => {
  mockSync({ loading: true, players: [] });
  render(<CampaignViewPage />);
  expect(screen.getByText('Loading players…')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Campaign settings' })
  ).toBeInTheDocument();
  expect(screen.queryByTestId('npc-section-npc')).toBeNull();
});

it('keeps the settings during a players error', async () => {
  mockSync({ error: 'Failed to fetch players', players: [] });
  render(<CampaignViewPage />);
  expect(
    screen.getByRole('heading', {
      level: 3,
      name: "Couldn't load the players",
    })
  ).toBeInTheDocument();
  expect(screen.queryByText('Failed to fetch players')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Campaign settings' })
  ).toBeInTheDocument();
  expect(screen.queryByTestId('npc-section-monster')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refresh).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
  );
});

it('keeps the retry reachable when the players section is saved as closed', () => {
  seedCampaign({ dmDashboardUi: { playersSectionOpen: false } });
  mockSync({ error: 'Failed to fetch players', players: [] });
  render(<CampaignViewPage />);
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});

it('invites players with the campaign code when nobody has joined', () => {
  mockSync({ players: [] });
  render(<CampaignViewPage />);
  expect(
    screen.getByRole('heading', { level: 3, name: 'Invite your players' })
  ).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: 'Copy code K7QX2M' })
  ).toHaveLength(2); // header + empty state
  expect(screen.queryByRole('button', { name: 'Message all' })).toBeNull();
});

it('lists the players and opens their dialogs', () => {
  render(<CampaignViewPage />);
  fireEvent.click(
    within(screen.getByTestId('player-row-p1')).getByRole('button', {
      name: 'View sheet',
    })
  );
  expect(screen.getByTestId('player-detail')).toHaveAttribute(
    'data-player',
    'p1'
  );
  open('Message all');
  expect(screen.getByTestId('send-message-dialog')).toBeInTheDocument();
  open('Award XP');
  expect(screen.getByTestId('award-xp-dialog')).toBeInTheDocument();
});

it('remembers the players section collapse', () => {
  render(<CampaignViewPage />);
  open('Players (2)');
  expect(
    useDmStore.getState().getCampaign('K7QX2M')?.dmDashboardUi
      ?.playersSectionOpen
  ).toBe(false);
  cleanup();
  render(<CampaignViewPage />);
  expect(screen.getByRole('button', { name: 'Players (2)' })).toHaveAttribute(
    'aria-expanded',
    'false'
  );
  expect(screen.queryByTestId('player-row-p1')).toBeNull();
});

it('keeps Campaign settings closed by default and remembers opening it', () => {
  render(<CampaignViewPage />);
  expect(
    screen.getByRole('button', { name: 'Campaign settings' })
  ).toHaveAttribute('aria-expanded', 'false');
  open('Campaign settings');
  expect(
    useDmStore.getState().getCampaign('K7QX2M')?.dmDashboardUi
      ?.houseRulesSectionOpen
  ).toBe(true);
});

it('saves the player counter label on blur and shows the stepper', async () => {
  const user = userEvent.setup();
  render(<CampaignViewPage />);
  open('Campaign settings');
  await user.type(
    screen.getByRole('textbox', { name: 'Player counter' }),
    'Desperation'
  );
  await user.tab();
  expect(useDmStore.getState().getCampaign('K7QX2M')?.customCounterLabel).toBe(
    'Desperation'
  );
  expect(
    screen.getByRole('button', { name: 'Add 1 Desperation to Thorin' })
  ).toBeInTheDocument();
});

it('turns on stackable heroic inspiration', () => {
  render(<CampaignViewPage />);
  open('Campaign settings');
  fireEvent.click(
    screen.getByRole('switch', { name: 'Stackable heroic inspiration' })
  );
  expect(
    useDmStore.getState().getCampaign('K7QX2M')?.stackableInspiration
  ).toBe(true);
});

it('announces a player who joins', async () => {
  mockSync({ players: [p1] });
  const { rerender } = render(<CampaignViewPage />);
  // Players already there on the first load are not announced.
  expect(
    screen.queryByRole('heading', { level: 4, name: 'Player joined' })
  ).toBeNull();
  // Stale synced name: the toast uses the sheet name (playerDisplayName), Q2.
  mockSync({ players: [p1, { ...p2, characterName: 'Old Lyra' }] });
  rerender(<CampaignViewPage />);
  expect(
    await screen.findByRole('heading', { level: 4, name: 'Player joined' })
  ).toBeInTheDocument();
  expect(
    (await screen.findAllByText('Lyra (Bob) joined the campaign.')).length
  ).toBeGreaterThan(0);
});

it('renders a campaign this device does not know', () => {
  useDmStore.setState({ campaigns: [] });
  expect(() => render(<CampaignViewPage />)).not.toThrow();
  expect(() => open('Players (2)')).not.toThrow();
  expect(
    screen.getByRole('heading', { level: 1, name: 'The Sunken Bell' })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Campaign settings' })
  ).toBeNull(); // Q4
});

describe('removing a player', () => {
  // The synced characterName is stale; the sheet name is "Thorin". The confirm
  // and both toasts must use the sheet name (playerDisplayName).
  const stale = { ...p1, characterName: 'Old Thorin' };
  beforeEach(() => {
    mockSync({ players: [stale, p2] });
    renderConfirmDialogHost();
    vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => vi.restoreAllMocks());

  it('keeps the player when the DM cancels', async () => {
    const { titles } = answerConfirmDialogs('cancel');
    render(<CampaignViewPage />);
    open('Remove Thorin from campaign');
    await waitFor(() => expect(titles).toEqual(['Remove Thorin?']));
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('player-row-p1')).toBeInTheDocument();
  });

  it('removes the player after confirming and says so', async () => {
    answerConfirmDialogs('confirm');
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    render(<CampaignViewPage />);
    open('Remove Thorin from campaign');
    expect(
      await screen.findByRole('heading', { level: 4, name: 'Player removed' })
    ).toBeInTheDocument();
    expect(
      (await screen.findAllByText('Thorin was removed from the campaign.'))
        .length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/Old Thorin/)).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      '/api/campaign/K7QX2M/players/p1',
      expect.objectContaining({
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dmId: 'dm-synth' }),
      })
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('says the player is still there when removal fails', async () => {
    answerConfirmDialogs('confirm');
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CampaignViewPage />);
    open('Remove Thorin from campaign');
    expect(
      await screen.findByRole('heading', {
        level: 4,
        name: 'Player not removed',
      })
    ).toBeInTheDocument();
    expect(
      (
        await screen.findAllByText(
          'Thorin is still in the campaign. Try again.'
        )
      ).length
    ).toBeGreaterThan(0);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('says the player is still there when the request throws', async () => {
    answerConfirmDialogs('confirm');
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CampaignViewPage />);
    open('Remove Thorin from campaign');
    expect(
      await screen.findByRole('heading', {
        level: 4,
        name: 'Player not removed',
      })
    ).toBeInTheDocument();
  });

  it('reports only the removal when the refresh after it fails', async () => {
    answerConfirmDialogs('confirm');
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    refresh.mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CampaignViewPage />);
    open('Remove Thorin from campaign');
    expect(
      await screen.findByRole('heading', { level: 4, name: 'Player removed' })
    ).toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        'Failed to refresh players:',
        expect.any(Error)
      )
    );
    expect(
      screen.queryByRole('heading', { level: 4, name: 'Player not removed' })
    ).toBeNull();
  });
});
