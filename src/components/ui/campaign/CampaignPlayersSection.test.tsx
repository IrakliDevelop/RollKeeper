import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clickConfirmDialogButton,
  findConfirmDialog,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CampaignPlayerData } from '@/types/campaign';

import {
  CampaignPlayersSection,
  type CampaignPlayersSectionProps,
} from './CampaignPlayersSection';

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

const players = [
  makePlayer('p1', 'Thorin', 'Alice'),
  makePlayer('p2', 'Lyra', 'Bob'),
];

const onRefresh = vi.fn<() => Promise<void>>();
const onOpenChange = vi.fn();
const onAdjustCounter = vi.fn();
const onViewPlayer = vi.fn();
const onRemovePlayer = vi.fn();
const onMessageAll = vi.fn();
const onAwardXp = vi.fn();

function renderSection(overrides: Partial<CampaignPlayersSectionProps> = {}) {
  return render(
    <CampaignPlayersSection
      code="K7QX2M"
      players={players}
      loading={false}
      error={null}
      lastFetched={null}
      onRefresh={onRefresh}
      open
      onOpenChange={onOpenChange}
      onAdjustCounter={onAdjustCounter}
      onViewPlayer={onViewPlayer}
      onRemovePlayer={onRemovePlayer}
      onMessageAll={onMessageAll}
      onAwardXp={onAwardXp}
      {...overrides}
    />
  );
}

describe('CampaignPlayersSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onRefresh.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('counts the players and offers Message all and Award XP', () => {
    renderSection();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Players (2)' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Players (2)' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Message all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Award XP' }));
    expect(onMessageAll).toHaveBeenCalledTimes(1);
    expect(onAwardXp).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Message all' })).toHaveAttribute(
      'data-variant',
      'secondary'
    );
    expect(screen.getByTestId('player-row-p1')).toBeInTheDocument();
    expect(screen.getByTestId('player-row-p2')).toBeInTheDocument();
  });

  it('says when the players were last checked', () => {
    const at = new Date(2026, 10, 4, 19, 4);
    renderSection({ lastFetched: at });
    expect(
      screen.getByText(
        `Players update every 10 seconds · Last checked ${at.toLocaleTimeString(
          [],
          { hour: 'numeric', minute: '2-digit' }
        )}`
      )
    ).toBeInTheDocument();
  });

  it('omits the time before the first check', () => {
    renderSection({ lastFetched: null });
    expect(
      screen.getByText('Players update every 10 seconds')
    ).toBeInTheDocument();
  });

  it('disables Refresh and spins its icon only while refreshing', async () => {
    let resolve: () => void = () => {};
    onRefresh.mockImplementation(
      () =>
        new Promise<void>(r => {
          resolve = r;
        })
    );
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Refresh' }).querySelector('svg')
    ).toHaveClass('motion-safe:animate-spin');
    resolve();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
    );
    expect(
      screen.getByRole('button', { name: 'Refresh' }).querySelector('svg')
    ).not.toHaveClass('motion-safe:animate-spin');
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('collapses from the heading', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Players (2)' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('hides the rows while collapsed', () => {
    renderSection({ open: false });
    expect(screen.queryByTestId('player-row-p1')).toBeNull();
  });

  it('shows Loading players… while the first fetch runs', () => {
    renderSection({ loading: true, players: [] });
    expect(
      screen.getByRole('heading', { level: 2, name: 'Players' })
    ).toBeInTheDocument();
    expect(screen.getByText('Loading players…')).not.toHaveClass(
      'animate-pulse'
    );
    expect(screen.queryByRole('button', { name: 'Message all' })).toBeNull();
  });

  it('shows a fixed error and retries', () => {
    renderSection({ error: 'TypeError: Failed to fetch', players: [] });
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: "Couldn't load the players",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Check your connection, then try again.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables Try again while the retry runs', async () => {
    let resolve: () => void = () => {};
    onRefresh.mockImplementation(
      () =>
        new Promise<void>(r => {
          resolve = r;
        })
    );
    renderSection({ error: 'boom', players: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled();
    resolve();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
    );
  });

  it('hides a stale roster while the players fail to load', () => {
    renderSection({ error: 'boom' });
    expect(
      screen.getByRole('heading', { level: 2, name: 'Players' })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('player-row-p1')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Award XP' })).toBeNull();
  });

  it('invites players with the code when nobody has joined', () => {
    renderSection({ players: [] });
    expect(
      screen.getByRole('heading', { level: 3, name: 'Invite your players' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Give them this code. They enter it under Join campaign on their Characters page, and their characters appear here.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy code K7QX2M' })
    ).toHaveClass('type-num-lg');
    expect(screen.queryByRole('button', { name: 'Message all' })).toBeNull();
    expect(screen.queryByText(/Players update every/)).toBeNull();
  });

  it('asks before removing a player and only removes on confirm', async () => {
    renderConfirmDialogHost();
    renderSection();
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Thorin from campaign' })
    );
    const dialog = await findConfirmDialog();
    expect(dialog).toHaveTextContent('Remove Thorin?');
    expect(dialog).toHaveTextContent(
      'Their synced character data is removed from this campaign. They can rejoin with the campaign code.'
    );
    await clickConfirmDialogButton('Cancel');
    expect(onRemovePlayer).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Thorin from campaign' })
    );
    await clickConfirmDialogButton('Remove player');
    await waitFor(() =>
      expect(onRemovePlayer).toHaveBeenCalledWith(
        expect.objectContaining({ playerId: 'p1' })
      )
    );
    expect(onRemovePlayer).toHaveBeenCalledTimes(1);
  });

  it('passes each player their counter', () => {
    renderSection({
      customCounterLabel: 'Desperation',
      playerCounters: { p1: 2 },
    });
    const row = within(screen.getByTestId('player-row-p1'));
    const counterValue = (r: ReturnType<typeof within>) =>
      r
        .getByRole('group', { name: 'Desperation' })
        .querySelector('span.tabular-nums')?.textContent;
    expect(counterValue(row)).toBe('2');
    expect(counterValue(within(screen.getByTestId('player-row-p2')))).toBe('0');
    fireEvent.click(
      row.getByRole('button', { name: 'Add 1 Desperation to Thorin' })
    );
    expect(onAdjustCounter).toHaveBeenCalledWith('p1', 1);
  });
});
