import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PublicationStatus } from '@/lib/table/combatPublisher';

import { TableCombatToolbar } from './TableCombatToolbar';
import { publicationDetail, publicationLabel } from './tableCombatMessages';

afterEach(cleanup);

const props = {
  campaignCode: 'CAMP',
  runs: [],
  selectedRun: null,
  activeRunId: null,
  running: false,
  loggingPaused: false,
  publicationLabel: 'Saved locally',
  publishedRun: null,
  canPublish: false,
  saving: false,
  notice: null,
  playerNotices: [],
  onSelect: vi.fn(),
  onNewRun: vi.fn(),
  onHistory: vi.fn(),
  onEnd: vi.fn(),
  onPublish: vi.fn(),
};

describe('Table combat toolbar player-data hints (N1, N2)', () => {
  it('shows a stale hint only while the players snapshot is stale', () => {
    const { rerender } = render(
      <TableCombatToolbar {...props} playersStale={false} />
    );
    expect(screen.queryByText('Player data may be out of date')).toBeNull();
    rerender(<TableCombatToolbar {...props} playersStale />);
    expect(screen.getByText('Player data may be out of date')).toBeVisible();
  });

  it('names each participant whose HP is not broadcast', () => {
    render(
      <TableCombatToolbar
        {...props}
        playersStale={false}
        playerNotices={["Aria: couldn't load player data, so HP isn't shared"]}
      />
    );
    expect(
      screen.getByText("Aria: couldn't load player data, so HP isn't shared")
    ).toBeVisible();
  });
});

describe('publication wording (O7-3)', () => {
  it('keeps a raw not-shared reason out of the text and in the tooltip', () => {
    const status: PublicationStatus = {
      kind: 'not-broadcasting',
      reason: 'relay-timeout',
      pending: null,
    };
    expect(publicationLabel(status, false)).toBe('Not shared with players');
    expect(publicationDetail(status, false)).toBe('relay-timeout');
    render(
      <TableCombatToolbar
        {...props}
        playersStale={false}
        canPublish
        publicationLabel={publicationLabel(status, false)}
        publicationDetail={publicationDetail(status, false)}
      />
    );
    const line = screen.getByTestId('table-publication-status');
    expect(line).toHaveTextContent('Not shared with players');
    expect(line).toHaveAttribute('title', 'relay-timeout');
    expect(
      screen.getByRole('button', { name: 'Share with players' })
    ).toBeVisible();
  });

  it('says plainly when live play is unavailable, with no tooltip', () => {
    const status: PublicationStatus = { kind: 'broadcasting', runId: 'r1' };
    expect(publicationLabel(status, true)).toBe('Live play unavailable');
    expect(publicationDetail(status, true)).toBeUndefined();
    expect(publicationLabel(status, false)).toBe(
      'Initiative shared with players'
    );
  });
});
