import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTableControl } from '../useTableControl';
import type { TableDescriptor } from '@/lib/tableServer/control';
import { parseTableCommand } from '@/lib/tableServer/validation';

const epoch = '19a12345-1234-4123-8123-123456789abc';
function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
  });
});

describe('useTableControl', () => {
  it('distinguishes a held lease from a published initiative receipt', async () => {
    let current: TableDescriptor | null = null;
    const publication = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/capability'))
          return Promise.resolve(response({ required: true }));
        if (init?.method !== 'POST')
          return Promise.resolve(response({ current }));
        const command = JSON.parse(String(init.body)).command;
        if (command.type === 'initialize') {
          current = {
            epoch,
            revision: 0,
            writerFence: 0,
            leaseUntil: 0,
            holderSessionId: null,
            presentation: { sceneId: null, revision: 0, blanked: false },
            publicRunId: null,
          };
        } else if (command.type === 'acquire') {
          current = {
            ...current!,
            revision: 1,
            writerFence: 1,
            leaseUntil: Date.now() + 30_000,
            holderSessionId: command.holderSessionId,
          };
        } else if (command.type === 'publishInitiative') {
          return publication.promise;
        }
        return Promise.resolve(
          response({ status: 'committed', reason: 'current', current })
        );
      })
    );
    const { result } = renderHook(() => useTableControl('SYNTHA', 'dm-one'));
    await waitFor(() => expect(result.current.status).toBe('waiting'));
    await act(async () => result.current.initialize());
    await act(async () => result.current.acquire());
    expect(result.current.status).toBe('controlling');
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.publish('publishInitiative', {
        runId: 'run-one',
        initiative: {},
      });
    });
    await waitFor(() =>
      expect(
        vi
          .mocked(fetch)
          .mock.calls.some(
            call =>
              call[1]?.method === 'POST' &&
              JSON.parse(String(call[1].body)).command.type ===
                'publishInitiative'
          )
      ).toBe(true)
    );
    expect(result.current.status).toBe('controlling');
    current = { ...current!, revision: 2, publicRunId: 'run-one' };
    await act(async () => {
      publication.resolve(
        response({ status: 'committed', reason: 'current', current })
      );
      await pending;
    });
    expect(result.current.status).toBe('broadcasting');
  });

  it('does not restore broadcast after an offline event during renewal', async () => {
    let current: TableDescriptor | null = null;
    const renewal = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/capability'))
          return Promise.resolve(response({ required: true }));
        if (init?.method !== 'POST')
          return Promise.resolve(response({ current }));
        const command = JSON.parse(String(init.body)).command;
        if (command.type === 'initialize') {
          current = {
            epoch,
            revision: 0,
            writerFence: 0,
            leaseUntil: 0,
            holderSessionId: null,
            presentation: { sceneId: null, revision: 0, blanked: false },
            publicRunId: null,
          };
        } else if (command.type === 'acquire') {
          current = {
            ...current!,
            revision: 1,
            writerFence: 1,
            leaseUntil: Date.now() + 30_000,
            holderSessionId: command.holderSessionId,
          };
        } else if (command.type === 'renew') return renewal.promise;
        return Promise.resolve(
          response({ status: 'committed', reason: 'current', current })
        );
      })
    );
    const { result } = renderHook(() => useTableControl('SYNTHA', 'dm-one'));
    await waitFor(() => expect(result.current.status).toBe('waiting'));
    await act(async () => result.current.initialize());
    await act(async () => result.current.acquire());
    vi.useFakeTimers();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    act(() => window.dispatchEvent(new Event('offline')));
    expect(result.current.status).toBe('not-broadcasting');
    await act(async () => {
      renewal.resolve(
        response({
          status: 'committed',
          reason: 'current',
          current: { ...current!, revision: 2 },
        })
      );
      await Promise.resolve();
    });
    expect(result.current.status).toBe('not-broadcasting');
  });

  it('ignores an old campaign control read after context changes', async () => {
    const oldRead = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/capability'))
          return Promise.resolve(response({ required: true }));
        if (url.includes('/SYNTHA/')) return oldRead.promise;
        return Promise.resolve(response({ current: null }));
      })
    );
    const { result, rerender } = renderHook(
      ({ code }) => useTableControl(code, 'dm-one'),
      { initialProps: { code: 'SYNTHA' } }
    );
    await waitFor(() =>
      expect(
        vi
          .mocked(fetch)
          .mock.calls.some(call =>
            String(call[0]).includes('/SYNTHA/table/control')
          )
      ).toBe(true)
    );
    rerender({ code: 'SYNTHB' });
    await waitFor(() => expect(result.current.status).toBe('waiting'));
    await act(async () => {
      oldRead.resolve(
        response({
          current: {
            epoch,
            revision: 99,
            writerFence: 4,
            leaseUntil: Date.now() + 30_000,
            holderSessionId: 'old-session',
            presentation: { sceneId: null, revision: 0, blanked: false },
            publicRunId: null,
          },
        })
      );
      await Promise.resolve();
    });
    expect(result.current.current).toBeNull();
    expect(result.current.status).toBe('waiting');
  });

  it('drops local control at its absolute lease deadline without a renewal response', async () => {
    let current: TableDescriptor | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/capability'))
          return Promise.resolve(response({ required: true }));
        if (init?.method !== 'POST')
          return Promise.resolve(response({ current }));
        const command = JSON.parse(String(init.body)).command;
        if (command.type === 'initialize') {
          current = {
            epoch,
            revision: 0,
            writerFence: 0,
            leaseUntil: 0,
            holderSessionId: null,
            presentation: { sceneId: null, revision: 0, blanked: false },
            publicRunId: null,
          };
        } else if (command.type === 'acquire') {
          current = {
            ...current!,
            revision: 1,
            writerFence: 1,
            leaseUntil: Date.now() + 1000,
            holderSessionId: command.holderSessionId,
          };
        }
        return Promise.resolve(
          response({ status: 'committed', reason: 'current', current })
        );
      })
    );
    const { result } = renderHook(() => useTableControl('SYNTHA', 'dm-one'));
    await waitFor(() => expect(result.current.status).toBe('waiting'));
    await act(async () => result.current.initialize());
    vi.useFakeTimers();
    await act(async () => result.current.acquire());
    expect(result.current.status).toBe('controlling');
    act(() => vi.advanceTimersByTime(1001));
    expect(result.current.status).toBe('not-broadcasting');
    expect(result.current.error).toContain('lease expired');
  });

  it('invalidates visible authority when the request queue is saturated', async () => {
    let current: TableDescriptor | null = null;
    const firstPublication = deferred<Response>();
    let publicationCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/capability'))
          return Promise.resolve(response({ required: true }));
        if (init?.method !== 'POST')
          return Promise.resolve(response({ current }));
        const command = JSON.parse(String(init.body)).command;
        if (command.type === 'initialize') {
          current = {
            epoch,
            revision: 0,
            writerFence: 0,
            leaseUntil: 0,
            holderSessionId: null,
            presentation: { sceneId: null, revision: 0, blanked: false },
            publicRunId: null,
          };
        } else if (command.type === 'acquire') {
          current = {
            ...current!,
            revision: 1,
            writerFence: 1,
            leaseUntil: Date.now() + 30_000,
            holderSessionId: command.holderSessionId,
          };
        } else if (command.type === 'publishInitiative') {
          publicationCalls += 1;
          if (publicationCalls === 1) return firstPublication.promise;
        }
        return Promise.resolve(
          response({ status: 'committed', reason: 'current', current })
        );
      })
    );
    const { result } = renderHook(() => useTableControl('SYNTHA', 'dm-one'));
    await waitFor(() => expect(result.current.status).toBe('waiting'));
    await act(async () => result.current.initialize());
    await act(async () => result.current.acquire());
    const pending: Promise<void>[] = [];
    act(() => {
      for (let index = 0; index < 8; index += 1) {
        pending.push(
          result.current.publish('publishInitiative', {
            runId: `run-${index}`,
            initiative: {},
          })
        );
      }
    });
    await waitFor(() => expect(publicationCalls).toBe(1));
    await act(async () => {
      await expect(
        result.current.publish('publishInitiative', {
          runId: 'newest',
          initiative: {},
        })
      ).rejects.toThrow('not broadcasting');
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('Too many pending');
    await act(async () => {
      firstPublication.resolve(
        response({
          status: 'committed',
          reason: 'current',
          current: { ...current!, revision: 2, publicRunId: 'run-0' },
        })
      );
      await Promise.allSettled(pending);
    });
    expect(result.current.status).toBe('error');
    expect(publicationCalls).toBe(1);
  });

  it('PR04: every lease and end command it sends passes exact-key validation', async () => {
    let current: TableDescriptor | null = null;
    const sent: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/capability'))
          return Promise.resolve(response({ required: true }));
        if (init?.method !== 'POST')
          return Promise.resolve(response({ current }));
        const command = JSON.parse(String(init.body)).command;
        sent.push(command);
        current = {
          epoch,
          revision: (current?.revision ?? -1) + 1,
          writerFence: 1,
          leaseUntil: Date.now() + 30_000,
          holderSessionId: command.holderSessionId ?? null,
          presentation: { sceneId: null, revision: 0, blanked: false },
          publicRunId: null,
        };
        return Promise.resolve(
          response({ status: 'committed', reason: 'current', current })
        );
      })
    );
    const { result } = renderHook(() => useTableControl('SYNTHA', 'dm-one'));
    await waitFor(() => expect(result.current.status).toBe('waiting'));
    await act(async () => result.current.initialize());
    await act(async () => result.current.acquire());
    await act(async () => result.current.takeover());
    await act(async () => result.current.publish('endInitiative'));
    expect(sent.map(command => command.type)).toEqual([
      'initialize',
      'acquire',
      'takeover',
      'endInitiative',
    ]);
    for (const command of sent.slice(1))
      expect(parseTableCommand(command), String(command.type)).not.toBeNull();
  });
});
