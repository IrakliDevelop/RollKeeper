import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  open: vi.fn(),
}));

vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: mocks.createClient,
}));
vi.mock('@/lib/table/sceneAdapter', () => ({
  openTableWorkspace: mocks.open,
}));

import { useAuthenticatedTableWorkspace } from './useAuthenticatedTableWorkspace';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

function repository(label: string) {
  return {
    label,
    dispose: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  };
}

describe('authenticated Table workspace lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['account switch', { user: { id: 'account-b' } }],
    ['logout', null],
  ])(
    'immediately disposes account A before opening the next namespace on %s',
    async (_label, nextSession) => {
      let authCallback: (
        event: string,
        session: { user: { id: string } } | null
      ) => void = () => {};
      mocks.createClient.mockReturnValue({
        auth: {
          getUser: vi.fn(async () => ({ data: { user: { id: 'account-a' } } })),
          onAuthStateChange: vi.fn(callback => {
            authCallback = callback;
            return { data: { subscription: { unsubscribe: vi.fn() } } };
          }),
        },
      });
      const a = repository('A');
      const next = repository(nextSession ? 'B' : 'guest');
      const pending = deferred<{ repository: typeof next; selection: never }>();
      mocks.open
        .mockResolvedValueOnce({ repository: a, selection: {} })
        .mockReturnValueOnce(pending.promise);

      const { result } = renderHook(() =>
        useAuthenticatedTableWorkspace({ sourceCampaignCode: 'CAMP' })
      );
      await waitFor(() => expect(result.current.repository).toBe(a));

      act(() => authCallback('SIGNED_OUT', nextSession));
      expect(a.dispose).toHaveBeenCalledOnce();
      expect(result.current.repository).toBeNull();
      expect(mocks.open).toHaveBeenLastCalledWith(
        expect.objectContaining({
          account: nextSession
            ? { kind: 'authenticated', accountId: 'account-b' }
            : { kind: 'guest' },
        })
      );

      await act(async () =>
        pending.resolve({ repository: next, selection: {} as never })
      );
      expect(result.current.repository).toBe(next);
      expect(a.subscribe).toHaveBeenCalledOnce();
    }
  );

  it('cannot reopen stale account A when getUser resolves after an A to B auth event', async () => {
    let authCallback: (
      event: string,
      session: { user: { id: string } } | null
    ) => void = () => {};
    const initial = deferred<{ data: { user: { id: string } } }>();
    mocks.createClient.mockReturnValue({
      auth: {
        getUser: vi.fn(() => initial.promise),
        onAuthStateChange: vi.fn(callback => {
          authCallback = callback;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
      },
    });
    const b = repository('B');
    mocks.open.mockResolvedValue({ repository: b, selection: {} });
    const { result } = renderHook(() =>
      useAuthenticatedTableWorkspace({ sourceCampaignCode: 'CAMP' })
    );

    act(() => authCallback('SIGNED_IN', { user: { id: 'account-b' } }));
    await waitFor(() => expect(result.current.repository).toBe(b));
    await act(async () => {
      initial.resolve({ data: { user: { id: 'account-a' } } });
      await initial.promise;
    });

    expect(mocks.open).toHaveBeenCalledOnce();
    expect(mocks.open).toHaveBeenCalledWith(
      expect.objectContaining({
        account: { kind: 'authenticated', accountId: 'account-b' },
      })
    );
    expect(result.current.repository).toBe(b);
  });
});
