import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DmMessageNotification } from './DmMessageNotification';

afterEach(cleanup);

describe('DmMessageNotification', () => {
  it('exposes whether a message is expanded to keyboard and touch users', () => {
    render(
      <DmMessageNotification
        messages={[
          {
            id: 'one',
            title: 'Rendezvous',
            content: '<p>Meet at the tavern.</p>',
            sentAt: '2026-01-01',
          },
        ]}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    const read = screen.getByRole('button', { name: 'Read message' });
    expect(read).toHaveAttribute('aria-expanded', 'false');
    expect(read).toHaveClass('pointer-coarse:min-h-11');
    fireEvent.click(read);
    expect(
      screen.getByRole('button', { name: 'Hide message' })
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Meet at the tavern.')).toBeVisible();
  });
});
