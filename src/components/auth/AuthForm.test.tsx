import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthForm } from './AuthForm';

describe('AuthForm', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('requests an OTP, enforces cooldown, and verifies the six-digit code', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    const onSignedIn = vi.fn();

    render(
      <AuthForm
        auth={{ signInWithOtp, verifyOtp }}
        requireTurnstile={false}
        onSignedIn={onSignedIn}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Email address/), {
      target: { value: 'Player@Example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));

    await screen.findByLabelText('Digit 1 of 6');
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: /Resend in 60s/i })
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Digit 1 of 6'), {
      target: { value: '123456' },
    });

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'player@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('surfaces Turnstile failures without mutating browser storage', async () => {
    localStorage.setItem('rollkeeper-character', 'exact legacy bytes');
    const signInWithOtp = vi.fn().mockResolvedValue({
      error: { message: 'Captcha verification process failed' },
    });

    render(
      <AuthForm
        auth={{ signInWithOtp, verifyOtp: vi.fn() }}
        requireTurnstile={true}
        turnstileToken="rejected-token"
      />
    );

    fireEvent.change(screen.getByLabelText(/^Email address/), {
      target: { value: 'player@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));

    expect(
      await screen.findByText('Captcha verification process failed')
    ).toBeInTheDocument();
    expect(localStorage.getItem('rollkeeper-character')).toBe(
      'exact legacy bytes'
    );
  });
});
