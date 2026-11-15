import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CharacterRecoveryExportControls } from '@/components/ui/feedback/CharacterRecoveryExportControls';

vi.mock('@/lib/indexeddb/localDatabase', () => ({
  openRollkeeperDatabase: vi.fn(() =>
    Promise.reject(new Error('IndexedDB is unavailable'))
  ),
}));

vi.mock('@/lib/indexeddb/characterRecoveryExport', () => ({
  exportCurrentCharacterData: vi.fn(),
}));

describe('CharacterRecoveryExportControls', () => {
  afterEach(cleanup);

  it('keeps current-generation and immutable-capture downloads available in recovery required', () => {
    render(
      <CharacterRecoveryExportControls namespace="guest" runId="capture" />
    );
    expect(
      screen.getByRole('button', { name: /download current character data/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /download immutable raw capture/i })
    ).toBeInTheDocument();
  });

  it('shows a failed download as an alert', async () => {
    const user = userEvent.setup();
    render(
      <CharacterRecoveryExportControls namespace="guest" runId="capture" />
    );
    await user.click(
      screen.getByRole('button', { name: 'Download current character data' })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'IndexedDB is unavailable'
    );
    expect(
      screen.getByRole('button', { name: 'Download current character data' })
    ).toHaveAttribute('data-variant', 'secondary');
    expect(
      screen.getByRole('button', { name: 'Download immutable raw capture' })
    ).toHaveAttribute('data-variant', 'secondary');
  });
});
