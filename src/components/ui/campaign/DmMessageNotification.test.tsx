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

  it('renders a hostile message from the DM as inert text', () => {
    render(
      <DmMessageNotification
        messages={[
          {
            id: 'two',
            title: 'Bad scroll',
            content:
              '<p onclick="alert(1)">Read me</p><script>alert(2)</script><img src=x onerror="alert(3)"><a href="javascript:alert(4)">link</a><iframe srcdoc="<script>alert(5)</script>"></iframe><svg onload="alert(6)"></svg><form action="https://evil.test"><input name="pw"></form><span style="position: fixed; inset: 0">cover</span>',
            sentAt: '2026-01-01',
          },
        ]}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Read message' }));
    expect(screen.getByText('Read me')).toBeVisible();
    // The message body, apart from the card's own icons.
    const body = screen.getByText('Read me').parentElement!;
    for (const tag of ['script', 'img', 'iframe', 'svg', 'form', 'input']) {
      expect(body.querySelector(tag), tag).toBeNull();
    }
    expect(body.querySelector('[onclick]')).toBeNull();
    expect(screen.getByText('link')).not.toHaveAttribute('href');
    expect(screen.getByText('cover')).not.toHaveAttribute('style');
  });
});
