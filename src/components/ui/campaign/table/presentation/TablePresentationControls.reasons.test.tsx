import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TableDescriptor } from '@/lib/table/authorityLifecycle';

import { TablePresentationView, type TablePresentationPanel } from '.';
import { LIVE_CONTROL_REQUIRED } from './TablePresentationControls.utils';

/**
 * O7-2 H5 / HR-7: disabled presentation buttons say why, in visible text
 * referenced by `aria-describedby`; LIVE_CONTROL_REQUIRED stays one text
 * node; the show-blocked reason sits outside the polite live region and is
 * shown only to the holder. The status region is unchanged.
 */
vi.mock('../display/OpenDisplayButton', () => ({
  OpenDisplayButton: () => <button type="button">Open display</button>,
}));

const descriptor = (sceneId: string | null): TableDescriptor => ({
  epoch: 'epoch-a',
  revision: 4,
  writerFence: 2,
  leaseUntil: 0,
  holderSessionId: 'holder',
  presentation: { sceneId, revision: 2, blanked: false },
  publicRunId: null,
});

function view(options: { holder: boolean; canShow?: boolean }) {
  const panel = {
    presentation: {
      descriptor: descriptor('scene-tavern'),
      labels: {},
      pending: false,
      message: null,
      holder: options.holder,
      show: vi.fn(),
      reveal: vi.fn(),
      blank: vi.fn(),
      unpresent: vi.fn(),
      retry: vi.fn(),
      committedCount: 0,
    },
    display: { status: null, refresh: vi.fn() },
    verifiedSeen: false,
  } as unknown as TablePresentationPanel;
  render(
    <TablePresentationView
      campaignCode="CAMP"
      dmId="dm-1"
      sceneId="scene-forest"
      sceneName="Private Forest"
      canShow={options.canShow}
      authorityState={{ phase: 'offline' }}
      session={null}
      descriptor={descriptor('scene-tavern')}
      panel={panel}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('visible disabled reasons (HR-7)', () => {
  it('without live control every disabled presentation button points at the one LIVE_CONTROL_REQUIRED node', () => {
    view({ holder: false });
    const reasons = screen.getAllByText(LIVE_CONTROL_REQUIRED);
    expect(reasons).toHaveLength(1);
    const reason = reasons[0]!;
    expect(reason.id).not.toBe('');
    for (const name of ['Show this scene', 'Blank audience', 'Stop showing']) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(LIVE_CONTROL_REQUIRED);
    }
    expect(
      screen.queryByText('This scene is not registered for live play yet')
    ).toBeNull();
  });

  it('a non-holder never sees the show-blocked reason; Show points at the live-control reason', () => {
    view({ holder: false, canShow: false });
    expect(
      screen.queryByText('This scene is not registered for live play yet')
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Show this scene' })
    ).toHaveAccessibleDescription(LIVE_CONTROL_REQUIRED);
  });

  it('a holder sees why Show is blocked, outside the polite status region', () => {
    view({ holder: true, canShow: false });
    const reason = screen.getByText(
      'This scene is not registered for live play yet'
    );
    expect(reason.closest('[aria-live]')).toBeNull();
    expect(reason.closest('[role="status"]')).toBeNull();
    const show = screen.getByRole('button', { name: 'Show this scene' });
    expect(show).toBeDisabled();
    expect(show).toHaveAccessibleDescription(
      'This scene is not registered for live play yet'
    );
    expect(screen.queryByText(LIVE_CONTROL_REQUIRED)).toBeNull();
  });

  it('wraps on one row: no stacked column or top border', () => {
    view({ holder: true });
    const section = screen.getByRole('region', {
      name: 'Audience presentation',
    });
    expect(section.className).toMatch(/flex-wrap/u);
    expect(section.className).not.toMatch(/flex-col|border-t/u);
  });
});
