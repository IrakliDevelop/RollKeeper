import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PublicationStatus } from '@/lib/table/combatPublisher';

import { TableCombatStatus } from './TableCombatStatus';
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

describe('combat save status (review X2, C1)', () => {
  it('is one live region, mounted before any notice arrives (review Z4)', () => {
    const { rerender } = render(
      <TableCombatStatus saving={false} notice={null} unsavedNotice={null} />
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    rerender(
      <TableCombatStatus
        saving
        notice={null}
        unsavedNotice={{ tone: 'error', message: "Orc HP wasn't saved." }}
      />
    );
    expect(screen.getAllByRole('status')).toEqual([region]);
    expect(region).toHaveTextContent("Saving…Orc HP wasn't saved.");
  });

  it('shows a one-off notice and "Saving…" beside the unsaved change', () => {
    const retry = vi.fn();
    const { rerender } = render(
      <TableCombatStatus
        saving={false}
        notice={{ tone: 'info', message: 'Still saving the last change.' }}
        unsavedNotice={{
          tone: 'error',
          message: "Orc damage wasn't saved. Saving failed.",
          retry,
        }}
      />
    );
    expect(screen.getByText('Still saving the last change.')).toBeVisible();
    expect(
      screen.getByText("Orc damage wasn't saved. Saving failed.")
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
    rerender(
      <TableCombatStatus
        saving
        notice={null}
        unsavedNotice={{
          tone: 'error',
          message: "These changes weren't saved.",
        }}
      />
    );
    expect(screen.getByText('Saving…')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});
