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
  TableControlSession,
  TableDescriptor,
} from '@/lib/table/authorityLifecycle';
import type { TableAuthorityState } from '../workspace/useTableWorkspaceAuthority';

import { TablePresentationControls } from '.';
import {
  calibrationNotice,
  displayCalibrationLine,
  displayStatusLine,
} from './TablePresentationControls.utils';

const HOLDER = 'table-session-1';
const descriptor = (
  sceneId: string | null,
  revision = 2,
  blanked = false
): TableDescriptor => ({
  epoch: 'epoch-a',
  revision: 4,
  writerFence: 2,
  leaseUntil: Date.now() + 30_000,
  holderSessionId: HOLDER,
  presentation: { sceneId, revision, blanked },
  publicRunId: null,
});
const REGISTRY = [
  { sceneId: 'scene-tavern', safeLabel: 'Tavern', sourceMapId: 'map-tavern' },
  { sceneId: 'scene-hall', safeLabel: 'Hall', sourceMapId: null },
];
const LABELS = {
  'scene-tavern': { safeLabel: 'Tavern', sourceMapId: 'map-tavern' },
};

let displayReply: () => Response | Promise<Response>;
const fetchFn = vi.fn();
const statusCalls = () =>
  fetchFn.mock.calls.filter(([url]) =>
    String(url).includes('/table/display/status?dmId=dm-1')
  );

function session() {
  return {
    holderSessionId: HOLDER,
    current: () => descriptor('scene-tavern'),
    isLost: () => false,
    lostReason: () => null,
    renew: vi.fn(),
    publishInitiative: vi.fn(),
    endInitiative: vi.fn(),
    deletePresented: vi.fn(),
    show: vi.fn(async () => ({
      status: 'committed' as const,
      duplicate: false,
      current: descriptor('scene-forest', 3),
    })),
    blank: vi.fn(),
    unpresent: vi.fn(),
    resend: vi.fn(),
    subscribe: () => () => {},
  };
}

function controls(options: { holder?: boolean; current?: TableDescriptor }) {
  const held = options.holder ?? true;
  const active = held ? session() : null;
  const state: TableAuthorityState = active
    ? { phase: 'ready', session: active as unknown as TableControlSession }
    : {
        phase: 'lost',
        reason: 'lease-lost',
        leaseUntil: null,
        foreignHolder: true,
      };
  return {
    session: active,
    element: (
      <TablePresentationControls
        campaignCode="CAMP"
        dmId="dm-1"
        sceneId="scene-forest"
        sceneName="Private Forest"
        authorityState={state}
        session={active as unknown as TableControlSession | null}
        descriptor={options.current ?? descriptor('scene-tavern')}
      />
    ),
  };
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
  displayReply = () =>
    Response.json({ state: 'none', sceneId: null, ageMs: null });
  fetchFn.mockReset();
  fetchFn.mockImplementation(async (url: string) =>
    String(url).includes('/table/display/status')
      ? displayReply()
      : Response.json({
          current: descriptor('scene-tavern'),
          registry: REGISTRY,
        })
  );
  vi.stubGlobal('fetch', fetchFn);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const audienceStatus = () =>
  screen.getByRole('status', { name: 'What players see' });
async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('display status wording (E13)', () => {
  it('words every state as a device report, never derived from Published', () => {
    const line = (
      state: string,
      sceneId: string | null,
      ageMs: number | null
    ) =>
      displayStatusLine({
        status: { state, sceneId, ageMs } as never,
        sceneId: 'scene-forest',
        sceneName: 'Private Forest',
        labels: LABELS,
      });
    expect(line('none', null, null)).toEqual({
      text: 'No TV connected',
      tone: 'muted',
    });
    expect(line('loaded', 'scene-tavern', 900)).toEqual({
      text: "TV says it's showing Tavern",
      tone: 'success',
    });
    expect(line('loaded', 'scene-forest', 900).text).toBe(
      "TV says it's showing Private Forest"
    );
    expect(line('blank', null, 900).text).toBe("TV says it's blank");
    expect(line('waiting', null, 900).text).toBe("TV says it's waiting");
    expect(line('updating', 'scene-tavern', 900).text).toBe('TV updating…');
    expect(line('stale', 'scene-tavern', 17_400)).toEqual({
      text: 'No word from the TV for 17 s',
      tone: 'warning',
    });
    expect(
      displayStatusLine({
        status: 'error',
        sceneId: 'scene-forest',
        sceneName: 'Private Forest',
        labels: LABELS,
      })
    ).toEqual({ text: "Couldn't check the TV", tone: 'muted' });
  });

  it('shows the display line in the audience status region and drops the PR04 suffix', async () => {
    displayReply = () =>
      Response.json({ state: 'loaded', sceneId: 'scene-tavern', ageMs: 1_000 });
    render(controls({}).element);
    await settle();
    expect(audienceStatus()).toHaveTextContent("TV says it's showing Tavern");
    cleanup();
    render(controls({ current: descriptor('scene-hall') }).element);
    await settle();
    expect(audienceStatus()).toHaveTextContent(
      "Players see: Hall · TV only, not on players' devices"
    );
    expect(audienceStatus().textContent).not.toContain('arrives later');
  });

  it('a stale or failed read never shows success styling', async () => {
    displayReply = () =>
      Response.json({ state: 'stale', sceneId: 'scene-tavern', ageMs: 20_000 });
    render(controls({}).element);
    await settle();
    const stale = screen.getByText('No word from the TV for 20 s');
    expect(stale.className).not.toContain('emerald');
    displayReply = () => new Response('{}', { status: 503 });
    await settle(5_000);
    expect(screen.getByText("Couldn't check the TV")).toBeVisible();
  });
});

describe('display status read timeout (review 01 F1)', () => {
  it('a read aborted by its own 5 s timeout shows unavailable, never the old green line', async () => {
    displayReply = () =>
      Response.json({ state: 'loaded', sceneId: 'scene-tavern', ageMs: 1_000 });
    render(controls({}).element);
    await settle();
    const loaded = screen.getByText("TV says it's showing Tavern");
    expect(loaded.className).toContain('emerald');
    fetchFn.mockImplementation(async (url: string, init?: RequestInit) => {
      if (!String(url).includes('/table/display/status'))
        return Response.json({
          current: descriptor('scene-tavern'),
          registry: REGISTRY,
        });
      return new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        )
      );
    });
    await settle(5_000);
    await settle(5_000);
    const line = screen.getByText("Couldn't check the TV");
    expect(line.className).not.toContain('emerald');
    expect(screen.queryByText("TV says it's showing Tavern")).toBeNull();
  });
});

describe('display status poll lifecycle (E13)', () => {
  it('polls every 5 s with one request in flight and a 5 s abort, holder and non-holder', async () => {
    for (const holder of [true, false]) {
      fetchFn.mockClear();
      let active = 0;
      let maxActive = 0;
      let hung: AbortSignal | undefined;
      fetchFn.mockImplementation(async (url: string, init?: RequestInit) => {
        if (!String(url).includes('/table/display/status'))
          return Response.json({
            current: descriptor('scene-tavern'),
            registry: REGISTRY,
          });
        hung = init?.signal ?? undefined;
        active += 1;
        maxActive = Math.max(maxActive, active);
        return new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => {
            active -= 1;
            reject(new DOMException('aborted', 'AbortError'));
          })
        );
      });
      const { unmount } = render(controls({ holder }).element);
      await settle();
      expect(statusCalls()).toHaveLength(1);
      await settle(4_999);
      expect(statusCalls()).toHaveLength(1);
      const first = hung;
      await settle(1);
      expect(first?.aborted).toBe(true);
      expect(statusCalls()).toHaveLength(2);
      // The next tick coincides with the in-flight read's abort and skips;
      // a hung read never stacks a second request.
      await settle(5_000);
      expect(statusCalls()).toHaveLength(2);
      await settle(5_000);
      expect(statusCalls()).toHaveLength(3);
      expect(maxActive).toBe(1);
      const last = hung;
      unmount();
      expect(last?.aborted).toBe(true);
      await settle(30_000);
      expect(statusCalls()).toHaveLength(3);
    }
  });

  it('re-reads immediately after a committed presentation command', async () => {
    const { session: active, element } = controls({});
    render(element);
    await settle();
    const before = statusCalls().length;
    fireEvent.click(screen.getByRole('button', { name: 'Show this scene' }));
    await settle();
    expect(active!.show).toHaveBeenCalled();
    expect(statusCalls().length).toBeGreaterThan(before);
  });

  it('survives a StrictMode remount with a single running poll', async () => {
    render(<StrictMode>{controls({}).element}</StrictMode>);
    await settle();
    const afterMount = statusCalls().length;
    await settle(5_000);
    expect(statusCalls().length - afterMount).toBe(1);
  });
});

describe('Open display launcher (E12)', () => {
  it('is offered to any DM and reports a blocked popup without rotating', async () => {
    for (const holder of [true, false]) {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      render(controls({ holder }).element);
      await settle();
      fireEvent.click(screen.getByRole('button', { name: 'Open display' }));
      expect(open).toHaveBeenCalledWith('about:blank', '_blank');
      await settle();
      expect(
        screen.getByText(
          'Your browser blocked the new window. Allow pop-ups for this site, then press Open display again.'
        )
      ).toBeVisible();
      expect(
        fetchFn.mock.calls.some(([url]) =>
          String(url).includes('/table/display/capability')
        )
      ).toBe(false);
      cleanup();
      open.mockRestore();
    }
  });

  it('opens the display tab and refreshes the status after a successful rotation', async () => {
    const win = {
      opener: window,
      location: { replace: vi.fn() },
      close: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
    fetchFn.mockImplementation(async (url: string) =>
      String(url).includes('/table/display/capability')
        ? Response.json({
            capability: 'Cap5Synthetic_display-capability_0123456789',
            displayGeneration: 5,
          })
        : String(url).includes('/table/display/status')
          ? displayReply()
          : Response.json({
              current: descriptor('scene-tavern'),
              registry: REGISTRY,
            })
    );
    render(controls({}).element);
    await settle();
    const before = statusCalls().length;
    fireEvent.click(screen.getByRole('button', { name: 'Open display' }));
    await settle();
    expect(win.location.replace).toHaveBeenCalledWith(
      '/table-display/CAMP#k=Cap5Synthetic_display-capability_0123456789'
    );
    expect(statusCalls().length).toBeGreaterThan(before);
  });

  it('keeps narrow (390 px) layouts wrapping and uses theme tokens only', async () => {
    displayReply = () =>
      Response.json({ state: 'loaded', sceneId: 'scene-tavern', ageMs: 1_000 });
    render(controls({}).element);
    await settle();
    const line = screen.getByText("TV says it's showing Tavern");
    expect(line.className).toMatch(/break-words/u);
    const button = screen.getByRole('button', { name: 'Open display' });
    expect(button.closest('.flex-wrap')).not.toBeNull();
    // The PR05 additions use semantic theme tokens only (light/dark).
    const launcherStatus =
      button.parentElement!.querySelector('[role="status"]')!;
    for (const element of [line, launcherStatus]) {
      expect(element.className).toMatch(
        /\btext-(?:accent-[a-z]+-text|muted)\b/u
      );
      expect(element.className).not.toMatch(
        /\b(?:text|bg|border)-(?:white|black|gray|slate|zinc|red|green|blue|amber|emerald)-\d+\b/u
      );
    }
  });
});

describe('PR07 P9 table scale reports (R3-4 wording)', () => {
  const status = (calibration?: string) =>
    ({
      state: 'loaded',
      sceneId: 'scene-tavern',
      ageMs: 900,
      ...(calibration ? { calibration } : {}),
    }) as never;

  it('words verified/unsupported as inline device reports and verify-required as a notice only', () => {
    expect(displayCalibrationLine(status('verified'))).toEqual({
      text: 'TV says the scale is checked',
      tone: 'muted',
    });
    expect(displayCalibrationLine(status('unsupported'))).toEqual({
      text: "TV says this scene can't use mini scale (it needs a square grid)",
      tone: 'muted',
    });
    for (const quiet of ['verify-required', 'uncalibrated', undefined])
      expect(displayCalibrationLine(status(quiet))).toBeNull();
    expect(displayCalibrationLine('error')).toBeNull();
    expect(calibrationNotice(status('verify-required'))).toEqual({
      id: 'table-scale',
      text: 'TV says the scale needs checking. Use Check scale on the TV.',
      tone: 'alert',
    });
    for (const quiet of ['verified', 'unsupported', 'uncalibrated', undefined])
      expect(calibrationNotice(status(quiet))).toBeNull();
    expect(calibrationNotice('error')).toBeNull();
    expect(calibrationNotice(null)).toBeNull();
  });

  it('keeps a valid calibration enum from the status read and shows the inline line', async () => {
    displayReply = () =>
      Response.json({
        state: 'loaded',
        sceneId: 'scene-tavern',
        ageMs: 1_000,
        calibration: 'verified',
      });
    render(controls({}).element);
    await settle();
    expect(audienceStatus()).toHaveTextContent('TV says the scale is checked');
    displayReply = () =>
      Response.json({
        state: 'loaded',
        sceneId: 'scene-tavern',
        ageMs: 1_000,
        calibration: 'bogus',
      });
    await settle(5_000);
    expect(screen.queryByText(/TV says the scale/u)).toBeNull();
  });
});

describe('O7-A5 uncalibrated after verified', () => {
  it('shows "TV says it is back to normal view" only after verified was seen in this DM page session', async () => {
    const report = (calibration: string) => () =>
      Response.json({
        state: 'loaded',
        sceneId: 'scene-tavern',
        ageMs: 1_000,
        calibration,
      });
    displayReply = report('uncalibrated');
    render(controls({}).element);
    await settle();
    expect(screen.queryByText("TV says it's back to normal view")).toBeNull();
    displayReply = report('verified');
    await settle(5_000);
    expect(audienceStatus()).toHaveTextContent('TV says the scale is checked');
    displayReply = report('uncalibrated');
    await settle(5_000);
    const line = screen.getByText("TV says it's back to normal view");
    expect(line.className).toContain('text-muted');
    expect(screen.queryByText(/TV says the scale needs checking/u)).toBeNull();
  });
});
