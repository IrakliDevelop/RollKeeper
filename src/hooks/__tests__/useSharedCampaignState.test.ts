import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSharedCampaignState } from '@/hooks/useSharedCampaignState';
import {
  mockFetchResponse,
  mockFetchSequence,
  resetFetch,
} from '@/test/mocks/fetch';
import type { SharedCampaignState, ItemTransfer } from '@/types/sharedState';

const makeSharedState = (
  overrides: Partial<SharedCampaignState> = {}
): SharedCampaignState => ({
  calendar: null,
  messages: [],
  dmEffects: [],
  customCounter: null,
  transfers: [],
  initiative: null,
  battleMap: null,
  ...overrides,
});

const makeTransfer = (id: string): ItemTransfer => ({
  id,
  item: {
    id: `item-${id}`,
    name: 'Healing Potion',
    category: 'consumable',
    quantity: 1,
    weight: 0.5,
    description: '',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  fromPlayerName: 'Alice',
  fromCharacterName: 'Elara',
  fromType: 'player',
  sentAt: '2026-04-28T10:00:00.000Z',
});

describe('useSharedCampaignState', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetFetch();
    // Ensure document is visible at the start of each test
    Object.defineProperty(document, 'hidden', { value: false, writable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Initial fetch
  // -----------------------------------------------------------------------

  it('returns loading=true immediately after mount when campaignCode is provided', () => {
    mockFetchResponse(200, makeSharedState());
    const { result } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-1')
    );
    expect(result.current.loading).toBe(true);
  });

  it('sets loading=false and populates sharedState after successful fetch', async () => {
    const state = makeSharedState({
      messages: [
        {
          id: 'msg-1',
          title: 'Welcome',
          content: '<p>Hello</p>',
          sentAt: '2026-04-28T09:00:00.000Z',
        },
      ],
      customCounter: { label: 'Desperation', value: 3 },
    });
    mockFetchResponse(200, state);

    const { result } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-1')
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sharedState).not.toBeNull();
    expect(result.current.sharedState!.messages).toHaveLength(1);
    expect(result.current.sharedState!.messages[0].id).toBe('msg-1');
    expect(result.current.sharedState!.customCounter?.label).toBe(
      'Desperation'
    );
    expect(result.current.error).toBeNull();
    expect(result.current.lastFetched).toBeInstanceOf(Date);
  });

  it('returns calendar from shared state', async () => {
    const state = makeSharedState({
      calendar: {
        config: {
          name: 'Gregorian',
          months: [],
          daysPerWeek: 7,
          weekdays: [],
          moons: [],
          hoursPerDay: 24,
          minutesPerHour: 60,
          leapYear: null,
          epochs: [],
        } as unknown as import('@/types/calendar').CalendarConfig,
        currentTime: 1000,
        startTime: 0,
        updatedAt: '2026-04-28T00:00:00.000Z',
      },
    });
    mockFetchResponse(200, state);

    const { result } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-1')
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sharedState!.calendar).not.toBeNull();
    expect(result.current.sharedState!.calendar!.currentTime).toBe(1000);
  });

  it('returns dmEffects from shared state', async () => {
    const state = makeSharedState({
      dmEffects: [
        {
          id: 'effect-1',
          name: 'Frightened',
          action: 'add',
          appliedAt: '2026-04-28T08:00:00.000Z',
        },
      ],
    });
    mockFetchResponse(200, state);

    const { result } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-1')
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sharedState!.dmEffects).toHaveLength(1);
    expect(result.current.sharedState!.dmEffects[0].name).toBe('Frightened');
  });

  // -----------------------------------------------------------------------
  // No campaignCode — should be a no-op
  // -----------------------------------------------------------------------

  it('does not fetch when campaignCode is null', async () => {
    const fetchFn = mockFetchResponse(200, makeSharedState());

    renderHook(() => useSharedCampaignState(null, 'player-1'));

    // Flush microtasks and any pending promises
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('does not fetch when campaignCode is undefined', async () => {
    const fetchFn = mockFetchResponse(200, makeSharedState());

    renderHook(() => useSharedCampaignState(undefined, 'player-1'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('resets sharedState to null when campaignCode becomes null', async () => {
    mockFetchResponse(200, makeSharedState({ messages: [] }));

    const { result, rerender } = renderHook(
      ({ code }: { code: string | null }) =>
        useSharedCampaignState(code, 'player-1'),
      { initialProps: { code: 'CAMP01' as string | null } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sharedState).not.toBeNull();

    rerender({ code: null });

    expect(result.current.sharedState).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Fetch URL construction
  // -----------------------------------------------------------------------

  it('fetches from correct URL with role=player param', async () => {
    const fetchFn = mockFetchResponse(200, makeSharedState());

    const { result } = renderHook(() => useSharedCampaignState('CAMP01'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const url = (fetchFn as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(url).toContain('/api/campaign/CAMP01/shared');
    expect(url).toContain('role=player');
  });

  it('includes playerId in query params when provided', async () => {
    const fetchFn = mockFetchResponse(200, makeSharedState());

    const { result } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-42')
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const url = (fetchFn as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(url).toContain('playerId=player-42');
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  it('sets error when fetch returns non-ok status', async () => {
    mockFetchResponse(500, { error: 'Internal Server Error' });

    const { result } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-1')
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
    expect(result.current.sharedState).toBeNull();
  });

  it('sets error when fetch throws a network error', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error'))
    ) as unknown as typeof global.fetch;

    const { result } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-1')
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network error');
  });

  it('clears error after a successful fetch following a failed one', async () => {
    mockFetchSequence([
      { status: 500, body: {} },
      { status: 200, body: makeSharedState() },
    ]);

    const { result } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-1')
    );

    await waitFor(() => expect(result.current.error).toBeTruthy());

    // Advance to trigger the next poll
    await act(async () => {
      vi.advanceTimersByTime(15000);
    });

    await waitFor(() => expect(result.current.error).toBeNull());
  });

  // -----------------------------------------------------------------------
  // Item transfers
  // -----------------------------------------------------------------------

  it('adds new transfers to pendingTransfers on fetch', async () => {
    const transfer = makeTransfer('t-1');
    mockFetchResponse(200, makeSharedState({ transfers: [transfer] }));

    const { result } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-1')
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.pendingTransfers).toHaveLength(1);
    expect(result.current.pendingTransfers[0].id).toBe('t-1');
  });

  it('does not duplicate pending transfers already in state', async () => {
    const transfer = makeTransfer('t-1');

    mockFetchSequence([
      { status: 200, body: makeSharedState({ transfers: [transfer] }) },
      { status: 200, body: makeSharedState({ transfers: [transfer] }) },
    ]);

    const { result } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-1')
    );

    await waitFor(() =>
      expect(result.current.pendingTransfers).toHaveLength(1)
    );

    // Trigger second poll
    await act(async () => {
      vi.advanceTimersByTime(15000);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.pendingTransfers).toHaveLength(1);
  });

  it('clearPendingTransfer removes the transfer from pendingTransfers', async () => {
    const transfer = makeTransfer('t-1');
    mockFetchResponse(200, makeSharedState({ transfers: [transfer] }));

    const { result } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-1')
    );

    await waitFor(() =>
      expect(result.current.pendingTransfers).toHaveLength(1)
    );

    act(() => {
      result.current.clearPendingTransfer('t-1');
    });

    expect(result.current.pendingTransfers).toHaveLength(0);
  });

  it('accumulates transfers from multiple polls', async () => {
    mockFetchSequence([
      {
        status: 200,
        body: makeSharedState({ transfers: [makeTransfer('t-1')] }),
      },
      {
        status: 200,
        body: makeSharedState({
          transfers: [makeTransfer('t-1'), makeTransfer('t-2')],
        }),
      },
    ]);

    const { result } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-1')
    );

    await waitFor(() =>
      expect(result.current.pendingTransfers).toHaveLength(1)
    );

    // Trigger second poll
    await act(async () => {
      vi.advanceTimersByTime(15000);
    });

    await waitFor(() =>
      expect(result.current.pendingTransfers).toHaveLength(2)
    );
  });

  // -----------------------------------------------------------------------
  // Acknowledge message
  // -----------------------------------------------------------------------

  it('acknowledgeMessage sends DELETE request and removes message from state', async () => {
    const state = makeSharedState({
      messages: [
        {
          id: 'msg-1',
          title: 'Hello',
          content: '<p>Hi</p>',
          sentAt: '2026-04-28T09:00:00.000Z',
        },
      ],
    });

    mockFetchSequence([
      { status: 200, body: state },
      { status: 200, body: {} }, // DELETE response
    ]);

    const { result } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-1')
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sharedState!.messages).toHaveLength(1);

    await act(async () => {
      await result.current.acknowledgeMessage('msg-1');
    });

    const calls = vi.mocked(globalThis.fetch).mock.calls as unknown as [
      string,
      RequestInit,
    ][];
    const deleteCall = calls.find(([, opts]) => opts?.method === 'DELETE');
    expect(deleteCall).toBeDefined();
    expect(deleteCall![0]).toContain('/api/campaign/CAMP01/shared');
    expect(JSON.parse(deleteCall![1].body as string)).toMatchObject({
      playerId: 'player-1',
      messageId: 'msg-1',
    });

    expect(result.current.sharedState!.messages).toHaveLength(0);
  });

  it('acknowledgeMessage is a no-op when playerId is not set', async () => {
    const state = makeSharedState({
      messages: [
        {
          id: 'msg-1',
          title: 'Hello',
          content: '<p>Hi</p>',
          sentAt: '2026-04-28T09:00:00.000Z',
        },
      ],
    });

    mockFetchResponse(200, state);

    const { result } = renderHook(
      () => useSharedCampaignState('CAMP01') // no playerId
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
      .length;

    await act(async () => {
      await result.current.acknowledgeMessage('msg-1');
    });

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callsBefore
    );
  });

  // -----------------------------------------------------------------------
  // Acknowledge DM effects
  // -----------------------------------------------------------------------

  it('acknowledgeDmEffects sends DELETE with type=effects and clears dmEffects', async () => {
    const state = makeSharedState({
      dmEffects: [
        {
          id: 'eff-1',
          name: 'Stunned',
          action: 'add',
          appliedAt: '2026-04-28T09:00:00.000Z',
        },
      ],
    });

    mockFetchSequence([
      { status: 200, body: state },
      { status: 200, body: {} },
    ]);

    const { result } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-1')
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sharedState!.dmEffects).toHaveLength(1);

    await act(async () => {
      await result.current.acknowledgeDmEffects();
    });

    const calls = vi.mocked(globalThis.fetch).mock.calls as unknown as [
      string,
      RequestInit,
    ][];
    const deleteCall = calls.find(([, opts]) => opts?.method === 'DELETE');
    expect(JSON.parse(deleteCall![1].body as string)).toMatchObject({
      playerId: 'player-1',
      type: 'effects',
    });

    expect(result.current.sharedState!.dmEffects).toHaveLength(0);
  });

  it('acknowledgeDmEffects is a no-op when playerId is not set', async () => {
    mockFetchResponse(200, makeSharedState());

    const { result } = renderHook(() => useSharedCampaignState('CAMP01'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
      .length;

    await act(async () => {
      await result.current.acknowledgeDmEffects();
    });

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callsBefore
    );
  });

  // -----------------------------------------------------------------------
  // Acknowledge transfers
  // -----------------------------------------------------------------------

  it('acknowledgeTransfers sends DELETE with type=transfers and clears transfers', async () => {
    const state = makeSharedState({ transfers: [makeTransfer('t-1')] });

    mockFetchSequence([
      { status: 200, body: state },
      { status: 200, body: {} },
    ]);

    const { result } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-1')
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sharedState!.transfers).toHaveLength(1);

    await act(async () => {
      await result.current.acknowledgeTransfers();
    });

    const calls = vi.mocked(globalThis.fetch).mock.calls as unknown as [
      string,
      RequestInit,
    ][];
    const deleteCall = calls.find(([, opts]) => opts?.method === 'DELETE');
    expect(JSON.parse(deleteCall![1].body as string)).toMatchObject({
      playerId: 'player-1',
      type: 'transfers',
    });

    expect(result.current.sharedState!.transfers).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Polling interval
  // -----------------------------------------------------------------------

  it('polls again after 15 seconds', async () => {
    const fetchFn = mockFetchResponse(200, makeSharedState());

    renderHook(() => useSharedCampaignState('CAMP01', 'player-1'));

    await waitFor(() =>
      expect(fetchFn as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1)
    );

    await act(async () => {
      vi.advanceTimersByTime(15000);
    });

    expect(
      (fetchFn as ReturnType<typeof vi.fn>).mock.calls.length
    ).toBeGreaterThanOrEqual(2);
  });

  it('polls multiple times over multiple intervals', async () => {
    const fetchFn = mockFetchResponse(200, makeSharedState());

    renderHook(() => useSharedCampaignState('CAMP01', 'player-1'));

    await waitFor(() =>
      expect(fetchFn as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1)
    );

    await act(async () => {
      vi.advanceTimersByTime(45000); // 3 × 15s
    });

    expect(
      (fetchFn as ReturnType<typeof vi.fn>).mock.calls.length
    ).toBeGreaterThanOrEqual(4); // 1 initial + 3 polls
  });

  it('stops polling on unmount', async () => {
    const fetchFn = mockFetchResponse(200, makeSharedState());

    const { unmount } = renderHook(() =>
      useSharedCampaignState('CAMP01', 'player-1')
    );

    await waitFor(() =>
      expect(fetchFn as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1)
    );

    unmount();

    const callsAtUnmount = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      .length;

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callsAtUnmount
    );
  });

  // -----------------------------------------------------------------------
  // Pause when page is hidden (visibility)
  // -----------------------------------------------------------------------

  it('pauses polling when tab becomes hidden', async () => {
    const fetchFn = mockFetchResponse(200, makeSharedState());

    renderHook(() => useSharedCampaignState('CAMP01', 'player-1'));

    await waitFor(() =>
      expect(fetchFn as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1)
    );

    // Simulate tab hidden
    Object.defineProperty(document, 'hidden', { value: true, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    const callsAfterHide = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      .length;

    await act(async () => {
      vi.advanceTimersByTime(45000);
    });

    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callsAfterHide
    );

    // Restore
    Object.defineProperty(document, 'hidden', {
      value: false,
      writable: true,
    });
  });

  it('resumes polling with immediate fetch when tab becomes visible again', async () => {
    const fetchFn = mockFetchResponse(200, makeSharedState());

    renderHook(() => useSharedCampaignState('CAMP01', 'player-1'));

    await waitFor(() =>
      expect(fetchFn as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1)
    );

    // Hide
    Object.defineProperty(document, 'hidden', { value: true, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    const callsWhileHidden = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      .length;

    // Show again
    Object.defineProperty(document, 'hidden', {
      value: false,
      writable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => {
      expect(
        (fetchFn as ReturnType<typeof vi.fn>).mock.calls.length
      ).toBeGreaterThan(callsWhileHidden);
    });
  });

  // -----------------------------------------------------------------------
  // Pause when idle
  // -----------------------------------------------------------------------

  it('pauses polling after idle timeout (5 minutes)', async () => {
    const fetchFn = mockFetchResponse(200, makeSharedState());

    renderHook(() => useSharedCampaignState('CAMP01', 'player-1'));

    await waitFor(() =>
      expect(fetchFn as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1)
    );

    // Advance past 5-minute idle timeout
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);
    });

    const callsAfterIdle = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      .length;

    // Advance several more poll intervals — should see no new calls
    await act(async () => {
      vi.advanceTimersByTime(45000);
    });

    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callsAfterIdle
    );
  });

  it('resumes polling on user activity after idle pause', async () => {
    const fetchFn = mockFetchResponse(200, makeSharedState());

    renderHook(() => useSharedCampaignState('CAMP01', 'player-1'));

    await waitFor(() =>
      expect(fetchFn as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1)
    );

    // Go idle
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);
    });

    const callsAfterIdle = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      .length;

    // Simulate user activity
    window.dispatchEvent(new Event('mousemove'));

    await waitFor(() => {
      expect(
        (fetchFn as ReturnType<typeof vi.fn>).mock.calls.length
      ).toBeGreaterThan(callsAfterIdle);
    });
  });
});
