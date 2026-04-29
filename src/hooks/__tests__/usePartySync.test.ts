import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePartySync } from '@/hooks/usePartySync';
import {
  mockFetchResponse,
  mockFetchSequence,
  resetFetch,
} from '@/test/mocks/fetch';
import type { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';

const CAMPAIGN_CODE = 'TEST01';
const CURRENT_CHAR_ID = 'char-self';

const defaultOptions = {
  campaignCode: CAMPAIGN_CODE,
  currentCharacterId: CURRENT_CHAR_ID,
  interval: 10000,
  enabled: true,
};

function makePartyMember(
  overrides: Partial<PartyMemberHP> = {}
): PartyMemberHP {
  return {
    characterId: 'char-other',
    characterName: 'Gandalf',
    playerName: 'Player One',
    className: 'Wizard',
    level: 10,
    armorClass: 13,
    hitPoints: { current: 60, max: 80, temporary: 0 },
    lastSynced: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('usePartySync', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetFetch();
    // Ensure document is visible by default
    Object.defineProperty(document, 'hidden', { value: false, writable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it('starts with loading=true and empty partyMembers', () => {
    mockFetchResponse(200, { members: [] });
    const { result } = renderHook(() => usePartySync(defaultOptions));
    expect(result.current.loading).toBe(true);
    expect(result.current.partyMembers).toEqual([]);
  });

  // ── Successful fetch ───────────────────────────────────────────────────────

  it('fetches party HP from the correct URL', async () => {
    const fetchFn = mockFetchResponse(200, { members: [] });

    renderHook(() => usePartySync(defaultOptions));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });

    const url = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(url).toBe(`/api/campaign/${CAMPAIGN_CODE}/party-hp`);
  });

  it('sets partyMembers and clears loading after a successful fetch', async () => {
    const member = makePartyMember();
    mockFetchResponse(200, { members: [member] });

    const { result } = renderHook(() => usePartySync(defaultOptions));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.partyMembers).toHaveLength(1);
    expect(result.current.partyMembers[0].characterId).toBe('char-other');
  });

  it('filters out the current character from the party list', async () => {
    const self = makePartyMember({
      characterId: CURRENT_CHAR_ID,
      characterName: 'Self',
    });
    const other = makePartyMember({
      characterId: 'char-other',
      characterName: 'Other',
    });
    mockFetchResponse(200, { members: [self, other] });

    const { result } = renderHook(() => usePartySync(defaultOptions));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.partyMembers).toHaveLength(1);
    expect(result.current.partyMembers[0].characterId).toBe('char-other');
  });

  it('returns empty array when members field is missing from response', async () => {
    mockFetchResponse(200, {});

    const { result } = renderHook(() => usePartySync(defaultOptions));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.partyMembers).toEqual([]);
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  it('handles non-OK HTTP response gracefully (no throw, loading=false)', async () => {
    mockFetchResponse(500, { error: 'Server error' });

    const { result } = renderHook(() => usePartySync(defaultOptions));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Non-OK → skip setPartyMembers, but loading still resolves
    expect(result.current.partyMembers).toEqual([]);
  });

  it('handles network errors gracefully (no throw, loading=false)', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network failure'))
    ) as unknown as typeof global.fetch;

    const { result } = renderHook(() => usePartySync(defaultOptions));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.partyMembers).toEqual([]);
  });

  // ── Disabled / no campaignCode ─────────────────────────────────────────────

  it('does not fetch when enabled=false', async () => {
    const fetchFn = mockFetchResponse(200, { members: [] });

    const { result } = renderHook(() =>
      usePartySync({ ...defaultOptions, enabled: false })
    );

    // Let timers settle
    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.partyMembers).toEqual([]);
  });

  it('does not fetch when campaignCode is null', async () => {
    const fetchFn = mockFetchResponse(200, { members: [] });

    const { result } = renderHook(() =>
      usePartySync({ ...defaultOptions, campaignCode: null })
    );

    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.partyMembers).toEqual([]);
  });

  // ── Polling ────────────────────────────────────────────────────────────────

  it('polls on the configured interval', async () => {
    const fetchFn = mockFetchResponse(200, { members: [] });

    renderHook(() => usePartySync({ ...defaultOptions, interval: 5000 }));

    // Initial fetch
    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    // Advance one interval
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      (fetchFn as ReturnType<typeof vi.fn>).mock.calls.length
    ).toBeGreaterThanOrEqual(2);
  });

  it('accumulates multiple poll results, using the latest data', async () => {
    const firstMember = makePartyMember({ characterName: 'First' });
    const secondMember = makePartyMember({ characterName: 'Second' });
    mockFetchSequence([
      { status: 200, body: { members: [firstMember] } },
      { status: 200, body: { members: [secondMember] } },
    ]);

    const { result } = renderHook(() =>
      usePartySync({ ...defaultOptions, interval: 5000 })
    );

    await waitFor(() => {
      expect(result.current.partyMembers[0]?.characterName).toBe('First');
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(result.current.partyMembers[0]?.characterName).toBe('Second');
    });
  });

  it('stops polling when unmounted', async () => {
    const fetchFn = mockFetchResponse(200, { members: [] });

    const { unmount } = renderHook(() =>
      usePartySync({ ...defaultOptions, interval: 5000 })
    );

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    unmount();

    const callsAtUnmount = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      .length;

    await act(async () => {
      vi.advanceTimersByTime(20000);
    });

    // No additional fetches after unmount
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callsAtUnmount
    );
  });

  // ── Visibility / idle detection ────────────────────────────────────────────

  it('pauses polling when the tab becomes hidden', async () => {
    const fetchFn = mockFetchResponse(200, { members: [] });

    renderHook(() => usePartySync({ ...defaultOptions, interval: 5000 }));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });

    const callsBeforeHide = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      .length;

    // Simulate tab hidden
    Object.defineProperty(document, 'hidden', { value: true, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    // No new fetches should have occurred while hidden
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callsBeforeHide
    );

    // Restore
    Object.defineProperty(document, 'hidden', { value: false, writable: true });
  });

  it('resumes polling with an immediate fetch when tab becomes visible', async () => {
    const fetchFn = mockFetchResponse(200, { members: [] });

    renderHook(() => usePartySync({ ...defaultOptions, interval: 5000 }));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });

    // Hide tab
    Object.defineProperty(document, 'hidden', { value: true, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    const callsWhilePaused = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      .length;

    // Show tab again
    Object.defineProperty(document, 'hidden', { value: false, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // Should trigger an immediate fetch on resume
    await waitFor(() => {
      expect(
        (fetchFn as ReturnType<typeof vi.fn>).mock.calls.length
      ).toBeGreaterThan(callsWhilePaused);
    });
  });

  it('pauses polling after the idle timeout elapses with no activity', async () => {
    const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // matches hook constant
    const fetchFn = mockFetchResponse(200, { members: [] });

    renderHook(() => usePartySync({ ...defaultOptions, interval: 5000 }));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });

    // Advance past the idle timeout
    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 1000);
    });

    const callsAfterIdle = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      .length;

    // Advance several more poll intervals — should be silent
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callsAfterIdle
    );
  });

  it('resumes polling on user activity after idle pause', async () => {
    const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
    const fetchFn = mockFetchResponse(200, { members: [] });

    renderHook(() => usePartySync({ ...defaultOptions, interval: 5000 }));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });

    // Go idle
    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 1000);
    });

    const callsAfterIdle = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      .length;

    // Simulate user activity
    window.dispatchEvent(new Event('mousemove'));

    // Should fetch immediately on resume
    await waitFor(() => {
      expect(
        (fetchFn as ReturnType<typeof vi.fn>).mock.calls.length
      ).toBeGreaterThan(callsAfterIdle);
    });
  });
});
