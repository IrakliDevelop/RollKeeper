import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TableCombatToolbar } from './TableCombatToolbar';

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
        playerNotices={['Aria: player data unavailable — HP not broadcast']}
      />
    );
    expect(
      screen.getByText('Aria: player data unavailable — HP not broadcast')
    ).toBeVisible();
  });
});
