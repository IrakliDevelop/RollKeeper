import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DmCounterNotification } from './DmCounterNotification';
import { DmEffectsNotification } from './DmEffectsNotification';

afterEach(cleanup);

describe('DM notices', () => {
  it('names dismiss controls by the update they remove', () => {
    render(
      <>
        <DmCounterNotification
          label="Inspiration"
          value={2}
          delta={1}
          onDismiss={vi.fn()}
        />
        <DmEffectsNotification
          effects={[
            {
              id: 'shield',
              name: 'Shielded',
              action: 'add',
              appliedAt: '2026-01-01',
            },
          ]}
          onDismiss={vi.fn()}
        />
      </>
    );
    expect(
      screen.getByRole('button', { name: 'Dismiss Inspiration update' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Dismiss Shielded notice' })
    ).toBeInTheDocument();
  });
});
