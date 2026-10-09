import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../presentation', () => ({
  TablePresentationView: () => <div data-testid="presentation" />,
}));

import type { TableAuthorityState } from './useTableWorkspaceAuthority';
import { TableWorkspaceHeader, WORKSPACE_LABEL } from './TableWorkspaceHeader';
import { calibrationNotice } from '../presentation/TablePresentationControls.utils';
import type { SaveMessageTone } from './saveMessageTone';

/**
 * O7-2 header compaction with the FC-1 invariants kept: alerts, notices,
 * save results/failures, the conflict block and its actions and the compact
 * S1 label are never collapsed or inside the Details popover; Details holds
 * only diagnostics and recovery actions, counted when actionable.
 */

class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 100,
    bottom: 30,
    width: 100,
    height: 30,
    toJSON: () => ({}),
  } as DOMRect);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** FC-1: any ancestor (or the node) that collapses or pops it over. */
function collapsing(node: Element): Element | null {
  for (let item: Element | null = node; item; item = item.parentElement)
    if (
      item.classList.contains('max-sm:hidden') ||
      item.classList.contains('hidden') ||
      item.hasAttribute('data-radix-popper-content-wrapper') ||
      item.getAttribute('data-testid') === 'table-header-details'
    )
      return item;
  return null;
}

const FAILED_SAVE =
  'Checkpoint not committed (relay-timeout); the local draft remains pending.';

function renderHeader(
  options: {
    state?: TableAuthorityState;
    saveMessage?: string;
    saveTone?: SaveMessageTone;
    localDraft?: boolean;
    checkpoint?: boolean;
    conflict?: boolean;
    recoveryBusy?: boolean;
    saveBusy?: boolean;
    waitSeconds?: number;
    extra?: ReactNode;
    notices?: Parameters<typeof TableWorkspaceHeader>[0]['notices'];
  } = {}
) {
  const actions = {
    restore: vi.fn(async () => {}),
    saveCheckpoint: vi.fn(async () => {}),
    reconcilePendingEdit: vi.fn(async () => {}),
  };
  const element = (overrides: typeof options = {}) => {
    const merged = { ...options, ...overrides };
    const saveMessage = merged.saveMessage ?? 'Local scene ready';
    return (
      <TableWorkspaceHeader
        campaignCode="CAMP"
        leading={<button type="button">Scenes</button>}
        authority={
          {
            state: merged.state ?? { phase: 'ready', session: {} },
            waitSeconds: merged.waitSeconds ?? 0,
            acquire: vi.fn(),
            workOffline: vi.fn(),
          } as never
        }
        clearedNotice={false}
        presentationProps={{} as never}
        presentation={{} as never}
        notices={merged.notices ?? []}
        extra={merged.extra}
        scene={{
          name: 'The Very Long Scene Name Of The Lich King',
          stored: {
            localDraft: merged.localDraft ? { generation: 'g1' } : null,
            canvasCheckpoint: merged.checkpoint
              ? { generation: 'checkpoint-1' }
              : null,
          } as never,
          relayStatus: 'connected',
          checkpoint: {
            saveMessage,
            saveTone:
              merged.saveTone ??
              (saveMessage === FAILED_SAVE
                ? 'failure'
                : saveMessage === 'Local scene ready'
                  ? 'routine'
                  : 'success'),
            recoveryBusy: merged.recoveryBusy ?? false,
            saveBusy: merged.saveBusy ?? false,
            ...actions,
          } as never,
          pendingConflict: merged.conflict ? { fields: ['name'] } : null,
        }}
      />
    );
  };
  const view = render(element());
  return {
    ...view,
    actions,
    update: (overrides: typeof options) => view.rerender(element(overrides)),
  };
}

const details = () => screen.getByRole('button', { name: /^Details/u });
const popover = () => screen.queryByTestId('table-header-details');
function open() {
  act(() => {
    fireEvent.click(details());
  });
  return popover()!;
}

describe('FC-1 invariants in the compact header (O7-2 H4)', () => {
  it('keeps the conflict alert, its actions, notices, the failed save and the authority banner outside Details; counts attention items', () => {
    renderHeader({
      conflict: true,
      localDraft: true,
      saveMessage: FAILED_SAVE,
      state: {
        phase: 'lost',
        reason: 'lease',
        leaseUntil: null,
        foreignHolder: false,
      },
      notices: [
        {
          id: 'switch',
          text: 'Resolve the unsaved change on Tavern before switching',
          tone: 'alert',
        },
        {
          id: 'room',
          text: 'Registration failed',
          tone: 'status',
          action: { label: 'Retry live registration', onClick: vi.fn() },
        },
      ],
    });
    expect(popover()).toBeNull();
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(3);
    for (const alert of alerts) expect(collapsing(alert)).toBeNull();
    for (const node of [
      screen.getByText(/conflicted with a newer scene/u),
      screen.getByRole('button', { name: 'Refresh winner' }),
      screen.getByRole('button', { name: 'Retry pending edit' }),
      screen.getByRole('button', { name: 'Discard pending edit' }),
      screen.getByText('Resolve the unsaved change on Tavern before switching'),
      screen.getByText('Registration failed'),
      screen.getByRole('button', { name: 'Retry live registration' }),
      screen.getByText(FAILED_SAVE),
      screen.getByText(/Live control lost/u),
      screen.getByRole('button', { name: 'Acquire live control' }),
      screen.getByRole('button', { name: 'Work offline' }),
      screen.getByText('Local scene runs'),
    ])
      expect(collapsing(node)).toBeNull();
    expect(details()).toHaveAccessibleName(
      'Details (2) — 2 items need attention'
    );
    expect(details()).toHaveTextContent(/^Details \(2\)$/u);
    expect(
      screen.queryByRole('button', { name: 'Reapply local draft' })
    ).toBeNull();
    const content = open();
    expect(
      within(content).getByRole('button', { name: 'Reapply local draft' })
    ).toBeInTheDocument();
  });

  it('shows "Details (1)" for a local draft to reapply, with an accessible name saying so', () => {
    renderHeader({ localDraft: true });
    expect(details()).toHaveAccessibleName(
      'Details (1) — 1 item needs attention'
    );
    expect(details()).toHaveTextContent(/^Details \(1\)$/u);
    expect(details()).toHaveAttribute('aria-expanded', 'false');
  });

  it.each([
    FAILED_SAVE,
    'Local draft failed (unavailable); live authority and local data are unchanged.',
    'Scene not found in this local workspace',
  ])(
    'counts a failed save/restore (%s) and shows it as a failure banner in a status region (HR-1)',
    message => {
      renderHeader({ saveMessage: message, saveTone: 'failure' });
      expect(details()).toHaveAccessibleName(
        'Details (1) — 1 item needs attention'
      );
      const line = screen.getByText(message);
      expect(collapsing(line)).toBeNull();
      expect(line.closest('[role="status"]')).not.toBeNull();
      expect(line.className).toMatch(/text-accent-red-text/u);
    }
  );

  it('a restore result shows as a banner while Details is closed (HR-1)', () => {
    renderHeader({ saveMessage: 'Local draft restored to live authority.' });
    expect(popover()).toBeNull();
    const line = screen.getByText('Local draft restored to live authority.');
    expect(line.closest('[role="status"]')).toHaveAttribute(
      'aria-live',
      'polite'
    );
    expect(details()).toHaveAccessibleName('Details');
  });

  it.each<[string, TableAuthorityState, RegExp]>([
    [
      'foreign holder',
      {
        phase: 'failed',
        reason: 'held',
        leaseUntil: null,
        foreignHolder: true,
      },
      /Another session holds live control/u,
    ],
    [
      'live unavailable',
      {
        phase: 'failed',
        reason: 'live-unavailable',
        leaseUntil: null,
        foreignHolder: false,
      },
      /Live publishing unavailable/u,
    ],
    ['offline', { phase: 'offline' }, /Working offline/u],
    ['acquiring', { phase: 'initializing' }, /Acquiring live control/u],
  ])('never collapses the %s authority text', (_name, state, text) => {
    renderHeader({ state });
    expect(collapsing(screen.getByText(text))).toBeNull();
  });

  it('never collapses the PR07 verify-required notice', () => {
    const notice = calibrationNotice({
      state: 'loaded',
      sceneId: 'scene-a',
      ageMs: 100,
      calibration: 'verify-required',
    });
    expect(notice).not.toBeNull();
    renderHeader({ notices: [notice!] });
    const text = screen.getByText(
      'Table reports scale needs verification — use Verify scale on the table display.'
    );
    expect(text).toHaveAttribute('role', 'alert');
    expect(collapsing(text)).toBeNull();
  });

  it('renders the prepare-encounter flow in the banners zone, never in Details (HR-8)', () => {
    renderHeader({ extra: <p>Prepare Goblin ambush on this map</p> });
    expect(
      collapsing(screen.getByText('Prepare Goblin ambush on this map'))
    ).toBeNull();
    expect(
      within(screen.getByTestId('table-header-banners')).getByText(
        'Prepare Goblin ambush on this map'
      )
    ).toBeInTheDocument();
  });
});

describe('header bar (O7-2 H1, H2, HR-8)', () => {
  it('one wrapping bar: Back to campaign text, Scenes, the full scene title, compact S1 badge, live pill, Details', () => {
    renderHeader();
    const header = screen.getByTestId('table-workspace-header');
    const bar = screen.getByTestId('table-header-bar');
    expect(header.firstElementChild).toBe(bar);
    expect(bar.className).toMatch(/flex-wrap/u);
    expect(
      within(bar).getByRole('link', { name: 'Back to campaign' })
    ).toHaveTextContent('Back to campaign');
    const title = within(bar).getByText(
      'The Very Long Scene Name Of The Lich King'
    );
    expect(title.className).not.toMatch(/truncate/u);
    expect(within(bar).getByText('Local scene runs')).toBeInTheDocument();
    expect(within(bar).getByText('Live control held.')).toBeInTheDocument();
    expect(screen.queryByText(WORKSPACE_LABEL)).toBeNull();
    for (const child of [...bar.children])
      expect((child as HTMLElement).className).not.toMatch(/\bw-full\b/u);
  });

  it.each<[string, TableAuthorityState, string, boolean]>([
    [
      'ready',
      { phase: 'ready', session: {} as never },
      'Live control held.',
      true,
    ],
    [
      'initializing',
      { phase: 'initializing' },
      'Acquiring live control…',
      true,
    ],
    ['offline', { phase: 'offline' }, 'Offline', false],
    [
      'lost',
      {
        phase: 'lost',
        reason: 'lease',
        leaseUntil: null,
        foreignHolder: false,
      },
      'Not live',
      false,
    ],
    [
      'idle',
      { phase: 'idle' } as TableAuthorityState,
      'Live control: not started',
      false,
    ],
  ])(
    'pill for %s: "%s"; one live region per state',
    (_name, state, text, pillLive) => {
      renderHeader({ state });
      const pill = screen.getByTestId('table-live-pill');
      expect(pill).toHaveTextContent(text);
      expect(pill.getAttribute('role') === 'status').toBe(pillLive);
      if (!pillLive && _name !== 'idle') {
        const banner = screen.getByTestId('table-authority-banner');
        expect(
          banner.querySelectorAll('[role="status"],[role="alert"]')
        ).toHaveLength(1);
      }
    }
  );

  it('offline gets a non-alert banner with Acquire; lost gets an alert with Acquire (countdown) and Work offline', () => {
    const view = renderHeader({ state: { phase: 'offline' } });
    expect(screen.getByText(/Working offline/u)).toHaveAttribute(
      'role',
      'status'
    );
    expect(
      screen.getByRole('button', { name: 'Acquire live control' })
    ).toBeEnabled();
    view.update({
      state: {
        phase: 'lost',
        reason: 'lease',
        leaseUntil: null,
        foreignHolder: false,
      },
      waitSeconds: 7,
    });
    expect(screen.getByText(/Live control lost/u)).toHaveAttribute(
      'role',
      'alert'
    );
    expect(
      screen.getByRole('button', { name: 'Acquire live control (7 s)' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Work offline' })).toBeEnabled();
  });
});

describe('Details popover (O7-2 H3, HR-5, HN-2)', () => {
  it('holds the full S1 sentence, the diagnostics and outline recovery actions; stays open after an action', () => {
    const { actions } = renderHeader({ localDraft: true, checkpoint: true });
    const content = open();
    expect(details()).toHaveAttribute('aria-expanded', 'true');
    expect(details().getAttribute('aria-controls')).toBe(content.id);
    expect(within(content).getByText(WORKSPACE_LABEL)).toBeInTheDocument();
    const terms = [...content.querySelectorAll('dt')].map(
      node => node.textContent
    );
    expect(terms).toEqual(['Relay', 'Local draft', 'Checkpoint']);
    expect(content).toHaveTextContent('connected');
    expect(content).toHaveTextContent('saved · local operations pending');
    expect(content).toHaveTextContent('Local scene ready');
    fireEvent.click(
      within(content).getByRole('button', { name: 'Save checkpoint' })
    );
    expect(actions.saveCheckpoint).toHaveBeenCalledTimes(1);
    fireEvent.click(
      within(content).getByRole('button', { name: 'Reapply local draft' })
    );
    expect(actions.restore).toHaveBeenCalledTimes(1);
    expect(popover()).not.toBeNull();
  });

  it('shows visible busy text and disables actions while recovery or a save runs', () => {
    const view = renderHeader({ localDraft: true, recoveryBusy: true });
    let content = open();
    expect(content).toHaveTextContent('Restoring…');
    expect(
      within(content).getByRole('button', { name: 'Reapply local draft' })
    ).toBeDisabled();
    view.update({ localDraft: true, recoveryBusy: false, saveBusy: true });
    content = popover()!;
    expect(content).toHaveTextContent('Saving checkpoint…');
    expect(
      within(content).getByRole('button', { name: 'Save checkpoint' })
    ).toBeDisabled();
  });

  it('focus: first control on open; Esc closes and returns to the trigger; Shift+Tab from the first returns to the trigger', () => {
    renderHeader({ localDraft: true, checkpoint: true });
    const content = open();
    const first = within(content).getByRole('button', {
      name: 'Reapply local draft',
    });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(details());
    open();
    act(() => {
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    });
    expect(popover()).toBeNull();
    expect(document.activeElement).toBe(details());
  });

  it('Tab from the last control closes Details and focuses the next control after the trigger', () => {
    renderHeader();
    const after = document.createElement('button');
    after.textContent = 'After header';
    document.body.append(after);
    const content = open();
    const last = within(content).getByRole('button', {
      name: 'Save checkpoint',
    });
    last.focus();
    act(() => {
      fireEvent.keyDown(last, { key: 'Tab' });
    });
    expect(popover()).toBeNull();
    expect(document.activeElement).not.toBe(details());
    expect(
      document.activeElement?.closest('[data-testid="table-header-details"]')
    ).toBeNull();
    after.remove();
  });

  it('when the focused control unmounts, focus moves to the first remaining control (HN-2)', () => {
    const view = renderHeader({ localDraft: true, checkpoint: true });
    const content = open();
    expect(document.activeElement).toBe(
      within(content).getByRole('button', { name: 'Reapply local draft' })
    );
    view.update({ localDraft: false, checkpoint: true });
    expect(document.activeElement).toBe(
      within(popover()!).getByRole('button', {
        name: 'Restore saved checkpoint',
      })
    );
  });

  it('content stays within 8 px of the viewport edges (HR-5)', () => {
    renderHeader();
    const content = open();
    expect(content.style.maxWidth).toBe('calc(100vw - 16px)');
    expect(content.className).toMatch(/z-50/u);
  });
});
