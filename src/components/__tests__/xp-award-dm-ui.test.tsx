import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
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
      />
    );
    expect(screen.getByText(/last synced: 1,200 xp/i)).toBeTruthy();

    await user.type(screen.getByLabelText('XP to add'), '300');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastPostedAward();
    expect(body.feature).toBe('xp');
    expect(body.dmId).toBe('dm-1');
    expect(body.data.playerId).toBe('p-1');
    expect(body.data.award).toMatchObject({ mode: 'add', amount: 300 });
    expect(body.data.award.id).toBeTruthy();
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

  it('posts one add award per selected player', async () => {
    const user = userEvent.setup();
    render(
      <AwardXpDialog
        open
        onClose={() => {}}
        players={players}
        campaignCode="ABC"
        dmId="dm-1"
      />
    );
    await user.type(screen.getByLabelText(/xp to add/i), '250');
    await user.click(screen.getByRole('button', { name: /award to 2/i }));

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

  it('shows per-player failure and retries with the original award', async () => {
    const user = userEvent.setup();
    // First wave: p-1 ok, p-2 fails
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.data.playerId === 'p-2') {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({}) };
    });
    render(
      <AwardXpDialog
        open
        onClose={() => {}}
        players={players}
        campaignCode="ABC"
        dmId="dm-1"
      />
    );
    await user.type(screen.getByLabelText(/xp to add/i), '100');
    await user.click(screen.getByRole('button', { name: /award to 2/i }));
    await screen.findByText(/failed for/i);

    const failedBody = fetchMock.mock.calls
      .map(([, init]) => JSON.parse((init as RequestInit).body as string))
      .find(b => b.data.playerId === 'p-2')!;

    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await user.click(screen.getByRole('button', { name: /retry failed/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const retried = lastPostedAward();
    expect(retried.data.playerId).toBe('p-2');
    expect(retried.data.award).toEqual(failedBody.data.award); // verbatim, same id
  });

  it('after fully successful send, amount is cleared and award button is disabled', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(
      <AwardXpDialog
        open
        onClose={() => {}}
        players={players}
        campaignCode="ABC"
        dmId="dm-1"
      />
    );

    const amountInput = screen.getByLabelText(/xp to add/i) as HTMLInputElement;
    const awardButton = screen.getByRole('button', { name: /award to 2/i });

    await user.type(amountInput, '250');
    expect(awardButton).not.toBeDisabled();

    await user.click(awardButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // After success, amount should be cleared
    expect(amountInput.value).toBe('');
    // Button should be disabled since amount is now required and empty
    expect(awardButton).toBeDisabled();
  });
});
