import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  cleanup,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { XpAwardControl } from '@/components/ui/campaign/XpAwardControl';
import { AwardXpDialog } from '@/components/ui/campaign/AwardXpDialog';
import type { CampaignPlayerData } from '@/types/campaign';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function lastPostedAward() {
  const [, init] = fetchMock.mock.calls.at(-1)!;
  return JSON.parse(init.body as string);
}

function makePlayer(id: string, name: string): CampaignPlayerData {
  return {
    playerId: id,
    playerName: name,
    characterName: `${name}'s hero`,
  } as CampaignPlayerData;
}

describe('XpAwardControl', () => {
  it('posts an add award with the correct payload', async () => {
    const user = userEvent.setup();
    render(
      <XpAwardControl
        campaignCode="ABC"
        dmId="dm-1"
        playerId="p-1"
        lastSyncedXp={1200}
        currentLevel={3}
      />
    );
    expect(screen.getByText('1,200')).toBeTruthy();
    expect(screen.getByText('1,500 XP')).toBeTruthy();
    expect(screen.getByText('16.7% to level 4')).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: /xp progress to level 4/i })
    ).toHaveAttribute('aria-valuenow', '16.7');

    await user.type(screen.getByLabelText('XP to add'), '300');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastPostedAward();
    expect(body.feature).toBe('xp');
    expect(body.dmId).toBe('dm-1');
    expect(body.data.playerId).toBe('p-1');
    expect(body.data.award).toMatchObject({ mode: 'add', amount: 300 });
    expect(body.data.award.id).toBeTruthy();
    expect(screen.getByText('1,500')).toBeTruthy();
    expect(screen.getByText(/projected · 1 pending/i)).toBeTruthy();
  });

  it('starts from the persisted projection and applies set awards immediately', async () => {
    const user = userEvent.setup();
    render(
      <XpAwardControl
        campaignCode="ABC"
        dmId="dm-1"
        playerId="p-1"
        lastSyncedXp={1200}
        projectedXp={1500}
        pendingAwardCount={1}
        currentLevel={3}
      />
    );

    expect(screen.getByText('1,500')).toBeTruthy();
    await user.click(screen.getByLabelText(/toggle between add and set xp/i));
    await user.type(screen.getByLabelText('Total XP'), '900');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText('900')).toBeTruthy();
    expect(screen.getByText(/projected · 2 pending/i)).toBeTruthy();
  });

  it('retry re-posts the ORIGINAL award with the same id', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    });
    render(
      <XpAwardControl
        campaignCode="ABC"
        dmId="dm-1"
        playerId="p-1"
        lastSyncedXp={0}
        currentLevel={1}
      />
    );
    await user.type(screen.getByLabelText('XP to add'), '100');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await screen.findByText('boom');
    const firstAward = lastPostedAward().data.award;

    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const retriedAward = lastPostedAward().data.award;
    expect(retriedAward).toEqual(firstAward); // same id — no fresh UUID
  });

  it('locks and describes the original payload while a retry is pending', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    });
    render(
      <XpAwardControl
        campaignCode="ABC"
        dmId="dm-1"
        playerId="p-1"
        lastSyncedXp={0}
        currentLevel={1}
      />
    );

    const amountInput = screen.getByLabelText('XP to add');
    const modeSwitch = screen.getByLabelText(/toggle between add and set xp/i);
    await user.type(amountInput, '100');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await screen.findByText('boom');

    expect(amountInput).toBeDisabled();
    expect(modeSwitch).toBeDisabled();
    expect(
      screen.getByText(/retry will resend the original add award of 100 xp/i)
    ).toBeTruthy();
  });
});

describe('AwardXpDialog', () => {
  const players = [makePlayer('p-1', 'Alice'), makePlayer('p-2', 'Bob')];

  function renderDialog() {
    return render(
      <AwardXpDialog
        open
        onClose={() => {}}
        players={players}
        campaignCode="ABC"
        dmId="dm-1"
      />
    );
  }

  function failBob() {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.data.playerId === 'p-2') {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({}) };
    });
  }

  const row = (name: string) =>
    screen.getByRole('checkbox', { name }).closest('label') as HTMLElement;

  it('posts one add award per selected player', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/xp to add/i), '250');
    await user.click(
      screen.getByRole('button', { name: 'Award XP to 2 players' })
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const bodies = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(init.body as string)
    );
    expect(bodies.map(b => b.data.playerId).sort()).toEqual(['p-1', 'p-2']);
    for (const b of bodies) {
      expect(b.data.award).toMatchObject({ mode: 'add', amount: 250 });
    }
    const ids = bodies.map(b => b.data.award.id);
    expect(new Set(ids).size).toBe(2); // distinct ids per player
  });

  it('titles the dialog and labels the amount', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Award XP' })).toBeTruthy();
    expect(screen.getByLabelText('XP to add')).toHaveAttribute(
      'placeholder',
      '300'
    );
    const group = screen.getByRole('group', { name: 'Players' });
    for (const name of ["Alice's hero", "Bob's hero"]) {
      const box = within(group).getByRole('checkbox', { name });
      expect(box).toHaveAttribute('aria-checked', 'true');
    }
    const close = screen
      .getAllByRole('button', { name: 'Close' })
      .find(b => b.dataset.variant === 'outline');
    expect(close).toBeTruthy();
  });

  it('counts the selected players in the award button', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText('XP to add'), '100');

    await user.click(screen.getByRole('checkbox', { name: "Bob's hero" }));
    const one = screen.getByRole('button', { name: 'Award XP to 1 player' });
    expect(one).toBeEnabled();

    await user.click(screen.getByRole('checkbox', { name: "Alice's hero" }));
    const none = screen.getByRole('button', { name: 'Award XP to 0 players' });
    expect(none).toBeDisabled();
  });

  it('marks each player sent or not sent and resends the original award', async () => {
    const user = userEvent.setup();
    failBob();
    renderDialog();
    await user.type(screen.getByLabelText('XP to add'), '100');
    await user.click(
      screen.getByRole('button', { name: 'Award XP to 2 players' })
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      "Not sent to Bob's hero. Resending gives them the same award."
    );
    expect(alert).toHaveClass('text-blood-text');
    const sent = within(row("Alice's hero")).getByText('Sent');
    const notSent = within(row("Bob's hero")).getByText('Not sent');
    expect(sent).toHaveClass('text-muted');
    expect(notSent).toHaveClass('text-muted');

    const failedBody = fetchMock.mock.calls
      .map(([, init]) => JSON.parse((init as RequestInit).body as string))
      .find(b => b.data.playerId === 'p-2')!;

    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const resend = screen.getByRole('button', { name: 'Resend to 1' });
    expect(resend).toHaveAttribute('data-variant', 'secondary');
    await user.click(resend);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const retried = lastPostedAward();
    expect(retried.data.playerId).toBe('p-2');
    expect(retried.data.award).toEqual(failedBody.data.award); // verbatim, same id

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(within(row("Bob's hero")).getByText('Sent')).toBeTruthy();
  });

  it('shows Sending… only on the button that was pressed', async () => {
    const user = userEvent.setup();
    failBob();
    renderDialog();
    await user.type(screen.getByLabelText('XP to add'), '100');
    await user.click(
      screen.getByRole('button', { name: 'Award XP to 2 players' })
    );
    await screen.findByRole('alert');

    let release!: (v: unknown) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise(r => {
          release = r;
        })
    );
    await user.click(screen.getByRole('button', { name: 'Resend to 1' }));

    expect(screen.getByRole('button', { name: 'Sending…' })).toHaveAttribute(
      'data-variant',
      'secondary'
    );
    expect(
      screen.getByRole('button', { name: 'Award XP to 2 players' })
    ).toBeDisabled();

    release({ ok: true, json: async () => ({}) });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Sending…' })).toBeNull()
    );
    expect(screen.queryByRole('button', { name: /^Resend/ })).toBeNull();
  });

  it('after fully successful send, amount is cleared and award button is disabled', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    renderDialog();

    const amountInput = screen.getByLabelText(/xp to add/i) as HTMLInputElement;
    const awardButton = screen.getByRole('button', {
      name: 'Award XP to 2 players',
    });

    await user.type(amountInput, '250');
    expect(awardButton).not.toBeDisabled();

    await user.click(awardButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // After success, amount should be cleared
    await waitFor(() => expect(amountInput.value).toBe(''));
    // Button should be disabled since amount is now required and empty
    expect(awardButton).toBeDisabled();
  });
});
