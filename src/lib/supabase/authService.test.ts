import { describe, expect, it, vi } from 'vitest';

import {
  requestEmailOtp,
  signOutWithoutTouchingLegacyStorage,
  verifyEmailOtp,
} from './authService';

const LEGACY_ENTRIES = [
  ['rollkeeper-character', '{"name":"Aster"}'],
  ['rollkeeper-player-data', '{"state":{"characters":[]}}'],
  ['location-canvas-demo', '{"shapes":[1,2,3]}'],
] as const;

function seedLegacyStorage() {
  localStorage.clear();
  for (const [key, value] of LEGACY_ENTRIES) localStorage.setItem(key, value);
  return LEGACY_ENTRIES.map(([key]) => [key, localStorage.getItem(key)]);
}

describe('authService', () => {
  it('allows account creation and passes the production captcha token', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });

    await requestEmailOtp(
      { signInWithOtp },
      'player@example.com',
      'captcha-token'
    );

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'player@example.com',
      options: {
        shouldCreateUser: true,
        captchaToken: 'captcha-token',
      },
    });
  });

  it('verifies an exact six-digit email code', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });

    await verifyEmailOtp({ verifyOtp }, 'player@example.com', '123456');

    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'player@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it.each(['12345', '1234567', '12a456'])(
    'rejects invalid code %s locally',
    async code => {
      const verifyOtp = vi.fn();

      await expect(
        verifyEmailOtp({ verifyOtp }, 'player@example.com', code)
      ).rejects.toThrow('Enter the six-digit code');
      expect(verifyOtp).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['expired', 'Token has expired'],
    ['reused', 'Token has already been used'],
  ])('surfaces %s OTP failures without retrying', async (_case, message) => {
    const verifyOtp = vi.fn().mockResolvedValue({
      error: { message },
    });

    await expect(
      verifyEmailOtp({ verifyOtp }, 'player@example.com', '123456')
    ).rejects.toThrow(message);
    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });

  it('leaves every legacy localStorage byte unchanged across sign-out', async () => {
    const before = seedLegacyStorage();
    const signOut = vi.fn().mockResolvedValue({ error: null });

    await signOutWithoutTouchingLegacyStorage({ signOut });

    expect(
      LEGACY_ENTRIES.map(([key]) => [key, localStorage.getItem(key)])
    ).toEqual(before);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
