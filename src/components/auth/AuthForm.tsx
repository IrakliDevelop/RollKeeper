'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';

import { requestEmailOtp, verifyEmailOtp } from '@/lib/supabase/authService';

interface AuthFormClient {
  signInWithOtp(input: {
    email: string;
    options: { shouldCreateUser: true; captchaToken?: string };
  }): Promise<{ error: { message: string } | null }>;
  verifyOtp(input: {
    email: string;
    token: string;
    type: 'email';
  }): Promise<{ error: { message: string } | null }>;
}

interface AuthFormProps {
  auth: AuthFormClient;
  requireTurnstile: boolean;
  turnstileToken?: string;
  onSignedIn?: () => void;
  onEmailSubmitted?: (email: string) => void;
  onCaptchaConsumed?: () => void;
}

const RESEND_COOLDOWN_SECONDS = 60;

export function AuthForm({
  auth,
  requireTurnstile,
  turnstileToken,
  onSignedIn,
  onEmailSubmitted,
  onCaptchaConsumed,
}: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown(value => value - 1),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const handleRequestCode = async () => {
    if (pending || cooldown > 0) return;
    if (requireTurnstile && !turnstileToken) {
      setError('Complete the anti-bot check before requesting a code.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      await requestEmailOtp(auth, email, turnstileToken);
      const normalizedEmail = email.trim().toLowerCase();
      setEmail(normalizedEmail);
      setCodeRequested(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      onEmailSubmitted?.(normalizedEmail);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not send a sign-in code.'
      );
    } finally {
      if (turnstileToken) onCaptchaConsumed?.();
      setPending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await verifyEmailOtp(auth, email, code);
      onSignedIn?.();
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : 'Could not verify the sign-in code.'
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-5">
      <Input
        id="auth-email"
        type="email"
        autoComplete="email"
        label="Email address"
        value={email}
        onChange={event => setEmail(event.target.value)}
        disabled={pending || codeRequested}
        required
      />

      {!codeRequested ? (
        <Button
          type="button"
          variant="primary"
          fullWidth
          loading={pending}
          disabled={!email.trim()}
          onClick={handleRequestCode}
        >
          Email me a code
        </Button>
      ) : (
        <>
          <Input
            id="auth-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            label="Six-digit code"
            value={code}
            maxLength={6}
            pattern="[0-9]{6}"
            onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
            disabled={pending}
            required
          />
          <Button
            type="button"
            variant="primary"
            fullWidth
            loading={pending}
            disabled={code.length !== 6}
            onClick={handleVerifyCode}
          >
            Verify code
          </Button>
          <Button
            type="button"
            variant="ghost"
            fullWidth
            disabled={pending || cooldown > 0}
            onClick={handleRequestCode}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </Button>
        </>
      )}

      {error && (
        <p role="alert" className="text-accent-red-text text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
