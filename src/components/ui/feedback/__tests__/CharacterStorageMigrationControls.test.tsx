import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CharacterStorageMigrationControls } from '@/components/ui/feedback/CharacterStorageMigrationControls';

const capture = vi.fn();

vi.mock('@/lib/deviceRecovery', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/deviceRecovery')>()),
  captureDeviceBackup: (...args: unknown[]) => capture(...args),
}));

describe('CharacterStorageMigrationControls', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED', undefined);
    capture.mockReset();
    localStorage.clear();
  });

  it('renders nothing and makes zero preview/storage calls while deployment-disabled', () => {
    const { container } = render(<CharacterStorageMigrationControls />);
    expect(container).toBeEmptyDOMElement();
    expect(capture).not.toHaveBeenCalled();
  });

  it('requires an explicit preview before offering recovery download and migration selection', async () => {
    vi.stubEnv('NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED', 'true');
    capture.mockResolvedValue({
      runId: 'run',
      createdAt: 'now',
      manifestHash: 'hash',
      validation: {
        entryCount: 3,
        totalBytes: 10,
        validJsonCount: 3,
        malformedJsonCount: 0,
        futureVersionCount: 0,
        retainedOnlyCount: 0,
      },
      entries: [],
    });
    render(<CharacterStorageMigrationControls />);
    expect(
      screen.queryByRole('button', { name: /download recovery and select/i })
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /preview character migration/i })
    );
    await waitFor(() => expect(capture).toHaveBeenCalledOnce());
    expect(await screen.findByText(/3 entries/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /download recovery and select/i })
    ).toBeInTheDocument();
  });
});
