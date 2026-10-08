import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../presentation', () => ({
  TablePresentationView: () => <div data-testid="presentation" />,
}));

import type { TableAuthorityState } from './useTableWorkspaceAuthority';
import { TableWorkspaceHeader, WORKSPACE_LABEL } from './TableWorkspaceHeader';
import { calibrationNotice } from '../presentation/TablePresentationControls.utils';

afterEach(cleanup);

/** FC-1: any ancestor (or the node) that collapses it below `sm`. */
function collapsing(node: Element): Element | null {
  for (let item: Element | null = node; item; item = item.parentElement)
    if (
      item.classList.contains('max-sm:hidden') ||
      item.classList.contains('hidden')
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
    localDraft?: boolean;
    conflict?: boolean;
    notices?: Parameters<typeof TableWorkspaceHeader>[0]['notices'];
  } = {}
) {
  return render(
    <TableWorkspaceHeader
      campaignCode="CAMP"
      authority={
        {
          state: options.state ?? { phase: 'ready', session: {} },
          waitSeconds: 0,
          acquire: vi.fn(),
          workOffline: vi.fn(),
        } as never
      }
      clearedNotice={false}
      presentationProps={{} as never}
      presentation={{} as never}
      notices={options.notices ?? []}
      scene={{
        name: 'Tavern',
        stored: {
          localDraft: options.localDraft ? { generation: 'g1' } : null,
          canvasCheckpoint: null,
        } as never,
        relayStatus: 'connected',
        checkpoint: {
          saveMessage: options.saveMessage ?? 'Local scene ready',
          recoveryBusy: false,
          restore: vi.fn(),
          saveCheckpoint: vi.fn(),
          reconcilePendingEdit: vi.fn(),
        } as never,
        pendingConflict: options.conflict ? { fields: ['name'] } : null,
      }}
    />
  );
}

describe('FC-1 compact header never collapses alerts, notices or failures (R4-1)', () => {
  it('keeps the conflict alert, its actions, notices and a failed save visible; counts attention items', () => {
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
    ])
      expect(collapsing(node)).toBeNull();
    const details = screen.getByRole('button', {
      name: 'Details (2) — 2 items need attention',
    });
    expect(details).toHaveTextContent(/^Details \(2\)$/u);
    expect(
      collapsing(screen.getByRole('button', { name: 'Reapply local draft' }))
    ).not.toBeNull();
  });

  it('shows "Details (1)" for a local draft to reapply, with an accessible name saying so', () => {
    renderHeader({ localDraft: true });
    const details = screen.getByRole('button', {
      name: 'Details (1) — 1 item needs attention',
    });
    expect(details).toHaveTextContent(/^Details \(1\)$/u);
    expect(details).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows "Details (1)" when only the last save failed', () => {
    renderHeader({ saveMessage: FAILED_SAVE });
    expect(
      screen.getByRole('button', {
        name: 'Details (1) — 1 item needs attention',
      })
    ).toHaveTextContent(/^Details \(1\)$/u);
    expect(collapsing(screen.getByText(FAILED_SAVE))).toBeNull();
  });

  it('plain "Details" with nothing actionable; routine lines collapse until expanded', () => {
    renderHeader();
    const details = screen.getByRole('button', { name: 'Details' });
    expect(details).toHaveTextContent(/^Details$/u);
    const routine = [
      screen.getByText('Local scene ready'),
      screen.getByText(/^Relay:/u),
      screen.getByText('Live control held.'),
      screen.getByRole('button', { name: 'Save checkpoint' }),
    ];
    for (const node of routine) expect(collapsing(node)).not.toBeNull();
    expect(collapsing(screen.getByText('Local scene runs'))).toBeNull();
    expect(collapsing(screen.getByText(WORKSPACE_LABEL))).not.toBeNull();
    fireEvent.click(details);
    expect(details).toHaveAttribute('aria-expanded', 'true');
    for (const node of routine) expect(collapsing(node)).toBeNull();
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
});

describe('PR07 P9 table scale notice (FC-1)', () => {
  it('never collapses the verify-required notice in the compact header', () => {
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
});
