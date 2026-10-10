import { StrictMode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  PresentationCommand,
  TableControlOutcome,
  TableControlSession,
  TableDescriptor,
} from '@/lib/table/authorityLifecycle';
import type { TableAuthorityState } from '../workspace/useTableWorkspaceAuthority';

import { TablePresentationControls } from '.';

const HOLDER = 'table-session-1';
const descriptor = (
  sceneId: string | null,
  blanked = false,
  holderSessionId: string | null = HOLDER
): TableDescriptor => ({
  epoch: 'epoch-a',
  revision: 4,
  writerFence: 2,
  leaseUntil: Date.now() + 30_000,
  holderSessionId,
  presentation: { sceneId, revision: 2, blanked },
  publicRunId: null,
});
const REGISTRY = [
  { sceneId: 'scene-tavern', safeLabel: 'Tavern', sourceMapId: 'map-tavern' },
  {
    sceneId: 'scene-forest',
    safeLabel: 'Private Forest',
    sourceMapId: 'map-forest',
  },
];

type Method = 'show' | 'blank' | 'unpresent' | 'resend';
function fakeSession(
  outcomes: Partial<Record<Method, () => Promise<TableControlOutcome>>> = {}
) {
  const committed = (current: TableDescriptor) =>
    Promise.resolve({
      status: 'committed',
      duplicate: false,
      current,
    } as const);
  return {
    holderSessionId: HOLDER,
    current: () => descriptor(null),
    isLost: () => false,
    lostReason: () => null,
    renew: vi.fn(),
    publishInitiative: vi.fn(),
    endInitiative: vi.fn(),
    deletePresented: vi.fn(),
    show: vi.fn(outcomes.show ?? (() => committed(descriptor('scene-forest')))),
    blank: vi.fn(
      outcomes.blank ?? (() => committed(descriptor('scene-tavern', true)))
    ),
    unpresent: vi.fn(outcomes.unpresent ?? (() => committed(descriptor(null)))),
    resend: vi.fn(
      outcomes.resend ?? (() => committed(descriptor('scene-forest')))
    ),
    subscribe: () => () => {},
  };
}

const fetchFn = vi.fn();
beforeEach(() => {
  fetchFn.mockReset();
  fetchFn.mockImplementation(async () =>
    Response.json({ current: descriptor('scene-tavern'), registry: REGISTRY })
  );
  vi.stubGlobal('fetch', fetchFn);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderControls(options: {
  session?: ReturnType<typeof fakeSession> | null;
  current?: TableDescriptor | null;
  state?: TableAuthorityState;
  sceneId?: string;
}) {
  const session =
    options.session === undefined ? fakeSession() : options.session;
  const state: TableAuthorityState =
    options.state ??
    (session
      ? { phase: 'ready', session: session as unknown as TableControlSession }
      : {
          phase: 'lost',
          reason: 'lease-lost',
          leaseUntil: null,
          foreignHolder: true,
        });
  const utils = render(
    <TablePresentationControls
      campaignCode="CAMP"
      dmId="dm-1"
      sceneId={options.sceneId ?? 'scene-forest'}
      sceneName="Private Forest"
      authorityState={state}
      session={session as unknown as TableControlSession | null}
      descriptor={
        options.current === undefined
          ? descriptor('scene-tavern')
          : options.current
      }
    />
  );
  return { ...utils, session };
}

const status = () => screen.getByRole('status', { name: 'What players see' });

describe('Table presentation controls (PR04 P4)', () => {
  it('separates the public audience from private preparation', async () => {
    renderControls({});
    expect(await screen.findByText('Players see: Tavern')).toBeVisible();
    expect(status()).toHaveTextContent(
      "Preparing Private Forest (players can't see it)"
    );
    expect(status()).toHaveAttribute('aria-live', 'polite');
  });

  it('labels the shown scene as live, blank as covered and nothing shown', async () => {
    const { rerender } = renderControls({
      current: descriptor('scene-forest'),
    });
    expect(
      await screen.findByText(
        "You're editing the scene players see. Changes show right away."
      )
    ).toBeVisible();
    expect(status()).toHaveTextContent('Players see: Private Forest');
    cleanup();
    renderControls({ current: descriptor('scene-tavern', true) });
    expect(await screen.findByText('Players see: blank screen')).toBeVisible();
    cleanup();
    renderControls({ current: descriptor(null) });
    expect(await screen.findByText('Players see: nothing')).toBeVisible();
    void rerender;
  });

  it('offers the actions that fit each audience state (holder only)', async () => {
    renderControls({ current: descriptor('scene-tavern') });
    await screen.findByText('Players see: Tavern');
    for (const name of ['Show this scene', 'Blank screen', 'Stop showing'])
      expect(screen.getByRole('button', { name })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Reveal/ })).toBeNull();
    cleanup();
    renderControls({ current: descriptor('scene-tavern', true) });
    expect(
      await screen.findByRole('button', { name: 'Reveal Tavern' })
    ).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Blank screen' })).toBeNull();
    cleanup();
    renderControls({ current: descriptor('scene-forest') });
    await screen.findByText(
      "You're editing the scene players see. Changes show right away."
    );
    expect(
      screen.queryByRole('button', { name: 'Show this scene' })
    ).toBeNull();
    cleanup();
    renderControls({ current: descriptor(null) });
    await screen.findByText('Players see: nothing');
    expect(screen.queryByRole('button', { name: 'Stop showing' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Blank screen' })).toBeNull();
  });

  it('reports Published only after the server commit, and disables controls while saving', async () => {
    let resolve!: (outcome: TableControlOutcome) => void;
    const session = fakeSession({
      show: () => new Promise(done => (resolve = done)),
    });
    renderControls({ session });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Show this scene' })
    );
    expect(screen.getByText('Saving…')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Blank screen' })).toBeDisabled();
    expect(screen.queryByText(/^Players' view/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show this scene' }));
    expect(session.show).toHaveBeenCalledTimes(1);
    await act(async () =>
      resolve({
        status: 'committed',
        duplicate: false,
        current: descriptor('scene-forest'),
      })
    );
    expect(await screen.findByText("Players' view updated")).toBeVisible();
    const [sceneId, operationId] = session.show.mock.calls[0] as unknown as [
      string,
      string,
    ];
    expect(sceneId).toBe('scene-forest');
    expect(operationId).toMatch(/^show-/u);
  });

  it('never shows false success on 409, 403/503 or network failure', async () => {
    const cases: Array<[TableControlOutcome, RegExp]> = [
      [
        {
          status: 'rejected',
          reason: 'scene-deleted',
          current: descriptor('scene-tavern'),
        },
        /Not changed: this scene was deleted\./,
      ],
      [
        {
          status: 'rejected',
          reason: 'presentation-changed',
          current: descriptor('scene-tavern'),
        },
        /Not changed: what players see changed in the meantime\./,
      ],
      [
        { status: 'failed', reason: 'unavailable' },
        /Not changed: live play isn't available right now\./,
      ],
      [
        { status: 'lost', reason: 'lease-lost' },
        /Not changed: you're no longer live\./,
      ],
      [
        { status: 'failed', reason: 'network' },
        /^Couldn't confirm the change\.$/,
      ],
    ];
    for (const [outcome, text] of cases) {
      const session = fakeSession({ blank: async () => outcome });
      renderControls({ session });
      fireEvent.click(
        await screen.findByRole('button', { name: 'Blank screen' })
      );
      expect(await screen.findByText(text)).toBeVisible();
      expect(screen.queryByText(/^Players' view/)).toBeNull();
      cleanup();
    }
  });

  it('Retry after a network failure re-sends the identical command once per click', async () => {
    const command = {
      type: 'show',
      operationId: 'show-1',
      expectedEpoch: 'epoch-a',
      expectedRevision: 4,
      expectedFence: 2,
      holderSessionId: HOLDER,
      sceneId: 'scene-forest',
    } satisfies PresentationCommand;
    const session = fakeSession({
      show: async () => ({ status: 'failed', reason: 'network', command }),
      resend: async () => ({
        status: 'committed',
        duplicate: true,
        current: descriptor('scene-forest'),
      }),
    });
    renderControls({ session });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Show this scene' })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByText("Players' view already updated")
    ).toBeVisible();
    expect(session.resend).toHaveBeenCalledTimes(1);
    expect(session.resend).toHaveBeenCalledWith(command);
    expect(session.show).toHaveBeenCalledTimes(1);
  });

  it('F1: a 503 after a possible commit is "Not confirmed" with the identical Retry', async () => {
    const command = {
      type: 'show',
      operationId: 'show-503',
      expectedEpoch: 'epoch-a',
      expectedRevision: 4,
      expectedFence: 2,
      holderSessionId: HOLDER,
      sceneId: 'scene-forest',
    } satisfies PresentationCommand;
    const session = fakeSession({
      show: async () => ({
        status: 'failed',
        reason: 'redis-unavailable',
        command,
      }),
      resend: async () => ({
        status: 'committed',
        duplicate: true,
        current: descriptor('scene-forest'),
      }),
    });
    renderControls({ session });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Show this scene' })
    );
    expect(
      await screen.findByText("Couldn't confirm the change.")
    ).toBeVisible();
    expect(screen.queryByText(/Not changed/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByText("Players' view already updated")
    ).toBeVisible();
    expect(session.resend).toHaveBeenCalledWith(command);
  });

  it('Concern 2: a definite HTTP 400 is "Not changed: the request was refused." with no futile Retry', async () => {
    const session = fakeSession({
      blank: async () => ({
        status: 'failed',
        reason: 'unavailable',
        httpStatus: 400,
        command: {
          type: 'blank',
          operationId: 'blank-400',
          expectedEpoch: 'epoch-a',
          expectedRevision: 4,
          expectedFence: 2,
          holderSessionId: HOLDER,
        },
      }),
    });
    renderControls({ session });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Blank screen' })
    );
    expect(
      await screen.findByText('Not changed: the request was refused.')
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByText(/Couldn't confirm/)).toBeNull();
  });

  it('F3: a hung status read is aborted after 5 s so later polls still run', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    fetchFn.mockImplementation(
      (url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          // PR05: the display status poll has its own lifecycle test.
          if (!String(url).includes('/table/control')) return;
          signals.push(init!.signal!);
          init!.signal!.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        })
    );
    renderControls({ session: null, current: null });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(signals).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(signals[0]!.aborted).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(signals).toHaveLength(2);
  });

  it('judges a duplicate whose audience has since changed truthfully (Q1)', async () => {
    const session = fakeSession({
      show: async () => ({
        status: 'committed',
        duplicate: true,
        current: descriptor('scene-tavern'),
      }),
    });
    renderControls({ session });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Show this scene' })
    );
    expect(
      await screen.findByText(
        'That change went through earlier, but what players see has changed since.'
      )
    ).toBeVisible();
  });

  it('re-reads control after an unconfirmed Retry, then applies Q1 (Q6)', async () => {
    const command = {
      type: 'blank',
      operationId: 'blank-1',
      expectedEpoch: 'epoch-a',
      expectedRevision: 4,
      expectedFence: 2,
      holderSessionId: HOLDER,
    } satisfies PresentationCommand;
    const session = fakeSession({
      blank: async () => ({ status: 'failed', reason: 'network', command }),
      resend: async () => ({
        status: 'unconfirmed',
        reason: 'operation-id-reused',
      }),
    });
    renderControls({ session });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Blank screen' })
    );
    fetchFn.mockImplementation(async () =>
      Response.json({
        current: descriptor('scene-tavern', true),
        registry: REGISTRY,
      })
    );
    const before = fetchFn.mock.calls.length;
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByText(
        /Couldn't confirm the change\. Check what players see above\./
      )
    ).toBeVisible();
    expect(
      await screen.findByText(/Players' view already updated/)
    ).toBeVisible();
    expect(fetchFn.mock.calls.length).toBeGreaterThan(before);
  });

  it('is read-only without live control and polls the DM control read every 10 s', async () => {
    vi.useFakeTimers();
    const { unmount } = renderControls({ session: null, current: null });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      screen.getByText('Go live to change what players see.')
    ).toBeVisible();
    expect(screen.getByText('Players see: Tavern')).toBeVisible();
    for (const name of ['Show this scene', 'Blank screen', 'Stop showing'])
      expect(screen.getByRole('button', { name })).toBeDisabled();
    const reads = () =>
      fetchFn.mock.calls.filter(([url]) =>
        String(url).includes('/table/control?dmId=dm-1')
      ).length;
    const first = reads();
    expect(first).toBeGreaterThanOrEqual(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(reads()).toBe(first + 1);
    for (const [, init] of fetchFn.mock.calls)
      expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET');
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(reads()).toBe(first + 1);
  });

  it('names another presented scene from the DM registry, else "another scene"', async () => {
    fetchFn.mockImplementation(async () =>
      Response.json({ current: descriptor('scene-x'), registry: REGISTRY })
    );
    renderControls({ current: descriptor('scene-x') });
    expect(await screen.findByText('Players see: another scene')).toBeVisible();
  });

  it('private preparation never issues a presentation command', async () => {
    const session = fakeSession();
    renderControls({ session });
    await screen.findByText('Players see: Tavern');
    for (const method of ['show', 'blank', 'unpresent', 'resend'] as const)
      expect(session[method]).not.toHaveBeenCalled();
  });

  const holderProps = (
    session: ReturnType<typeof fakeSession> | null,
    current: TableDescriptor | null
  ) => ({
    campaignCode: 'CAMP',
    dmId: 'dm-1',
    sceneId: 'scene-forest',
    sceneName: 'Private Forest',
    authorityState: (session
      ? { phase: 'ready', session: session as unknown as TableControlSession }
      : {
          phase: 'lost',
          reason: 'lease-lost',
          leaseUntil: null,
          foreignHolder: true,
        }) as TableAuthorityState,
    session: session as unknown as TableControlSession | null,
    descriptor: current,
  });

  it('A1: an aborted first label read (StrictMode remount) does not block the next one', async () => {
    let calls = 0;
    fetchFn.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((resolve, reject) => {
          calls += 1;
          if (calls === 1) {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            );
            return;
          }
          resolve(
            Response.json({
              current: descriptor('scene-tavern'),
              registry: REGISTRY,
            })
          );
        })
    );
    render(
      <StrictMode>
        <TablePresentationControls
          {...holderProps(fakeSession(), descriptor('scene-tavern'))}
        />
      </StrictMode>
    );
    expect(await screen.findByText('Players see: Tavern')).toBeVisible();
  });

  it('A1: a failed label read is retried on the next descriptor change', async () => {
    let calls = 0;
    fetchFn.mockImplementation(async () => {
      calls += 1;
      return calls === 1
        ? Response.json({ error: 'down' }, { status: 503 })
        : Response.json({
            current: descriptor('scene-tavern'),
            registry: REGISTRY,
          });
    });
    const session = fakeSession();
    const { rerender } = render(
      <TablePresentationControls
        {...holderProps(session, descriptor('scene-tavern'))}
      />
    );
    expect(await screen.findByText('Players see: another scene')).toBeVisible();
    rerender(
      <TablePresentationControls
        {...holderProps(session, {
          ...descriptor('scene-tavern'),
          revision: 5,
        })}
      />
    );
    expect(await screen.findByText('Players see: Tavern')).toBeVisible();
  });

  it('A3: the previous success notice clears when the audience changes or control is lost', async () => {
    const session = fakeSession();
    const { rerender } = render(
      <TablePresentationControls
        {...holderProps(session, descriptor('scene-tavern'))}
      />
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Show this scene' })
    );
    expect(await screen.findByText("Players' view updated")).toBeVisible();
    // Same state the message described: it stays.
    rerender(
      <TablePresentationControls
        {...holderProps(session, {
          ...descriptor('scene-forest'),
          revision: 9,
        })}
      />
    );
    expect(screen.getByText("Players' view updated")).toBeVisible();
    // Audience changed elsewhere: the notice no longer describes it.
    rerender(
      <TablePresentationControls
        {...holderProps(session, { ...descriptor(null), revision: 10 })}
      />
    );
    expect(screen.queryByText("Players' view updated")).toBeNull();
    session.show.mockResolvedValueOnce({
      status: 'committed',
      duplicate: false,
      current: { ...descriptor('scene-forest'), revision: 11 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show this scene' }));
    expect(await screen.findByText("Players' view updated")).toBeVisible();
    // Control lost: no stale success beside "Live control is required…".
    rerender(
      <TablePresentationControls
        {...holderProps(null, descriptor('scene-forest'))}
      />
    );
    expect(
      screen.getByText('Go live to change what players see.')
    ).toBeVisible();
    expect(screen.queryByText("Players' view updated")).toBeNull();
  });
});
