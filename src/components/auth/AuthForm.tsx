'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';

import { requestEmailOtp, verifyEmailOtp } from '@/lib/supabase/authService';

import { OtpCodeInputs } from './OtpCodeInputs';

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
  showSuccessStep?: boolean;
  successHref?: string;
  successActionLabel?: string;
}

const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type AuthStep = 'email' | 'code' | 'success';
type CodeStatus = 'idle' | 'wrong' | 'expired';

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

function classifyCodeError(message: string): CodeStatus {
  if (/expired|already been used/i.test(message)) return 'expired';
  return 'wrong';
}

export function AuthForm({
  auth,
  requireTurnstile,
  turnstileToken,
  onSignedIn,
  onEmailSubmitted,
  onCaptchaConsumed,
  showSuccessStep = false,
  successHref = '/player/backup',
  successActionLabel = 'Back up my characters',
}: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<AuthStep>('email');
  const [emailTouched, setEmailTouched] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeStatus, setCodeStatus] = useState<CodeStatus>('idle');
  const verifyingRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown(value => value - 1),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const emailInvalid = emailTouched && !isValidEmail(email);
  const sentTo = email.trim().toLowerCase();

  const handleRequestCode = async () => {
    if (pending || cooldown > 0) return;
    setEmailTouched(true);
    if (!isValidEmail(email)) return;
    if (requireTurnstile && !turnstileToken) {
      setError('Complete the anti-bot check before requesting a code.');
      return;
    }

    setPending(true);
    setError(null);
    setCodeStatus('idle');
    try {
      await requestEmailOtp(auth, email, turnstileToken);
      const normalizedEmail = email.trim().toLowerCase();
      setEmail(normalizedEmail);
      setCode('');
      setStep('code');
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

  const handleVerifyCode = async (nextCode: string) => {
    if (pending || verifyingRef.current) return;
    verifyingRef.current = true;
    setPending(true);
    setError(null);
    setCodeStatus('idle');
    try {
      await verifyEmailOtp(auth, email, nextCode);
      if (showSuccessStep) {
        setStep('success');
      } else {
        onSignedIn?.();
      }
    } catch (verificationError) {
      const message =
        verificationError instanceof Error
          ? verificationError.message
          : 'Could not verify the sign-in code.';
      setError(message);
      setCodeStatus(classifyCodeError(message));
      setCode('');
    } finally {
      verifyingRef.current = false;
      setPending(false);
    }
  };

  const title =
    step === 'success'
      ? 'Welcome back'
      : step === 'code'
        ? 'Enter your code'
        : 'Sign in to RollKeeper';
  const subtitle =
    step === 'success'
      ? sentTo
      : step === 'code'
        ? 'Type the six digits and you are in'
        : 'We will email you a code, no password needed';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pr-11">
        <span className="bg-accent-emerald-bg text-accent-emerald-text inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-heading text-[19px] leading-tight font-bold tracking-tight">
            {title}
          </h2>
          <p className="text-muted mt-0.5 truncate text-[13px]">{subtitle}</p>
        </div>
      </div>

      {step === 'email' && (
        <div className="flex flex-col gap-3.5">
          <Input
            id="auth-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            label="Email address"
            placeholder="you@example.com"
            value={email}
            leftIcon={<Mail className="h-4 w-4" />}
            onChange={event => setEmail(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') void handleRequestCode();
            }}
            disabled={pending}
            error={
              emailInvalid
                ? 'That does not look like an email address yet.'
                : undefined
            }
            helperText={
              emailInvalid
                ? undefined
                : 'We send a new code every time you sign in.'
            }
            className="h-12"
          />

          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            loading={pending}
            disabled={!email.trim()}
            onClick={handleRequestCode}
          >
            {pending ? 'Sending code…' : 'Email me a code'}
          </Button>

          <div className="border-divider flex flex-col gap-2.5 border-t pt-3.5">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="text-accent-emerald-text mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-body text-[12.5px] leading-snug">
                There is no password to remember. We email you a 6-digit code
                each time.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="text-accent-emerald-text mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-body text-[12.5px] leading-snug">
                Signing in only confirms who you are. Your characters, campaigns
                and maps stay on this browser, and nothing is uploaded here.
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 'code' && (
        <div className="flex flex-col gap-3.5">
          <div className="border-divider bg-surface-secondary inline-flex max-w-full items-center gap-2 self-start rounded-full border py-1 pr-1.5 pl-3">
            <span className="text-body truncate text-[12.5px]">
              Sent to {sentTo}
            </span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="h-[26px] rounded-full px-2.5 text-xs"
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
                setCodeStatus('idle');
                setEmailTouched(false);
              }}
            >
              Change
            </Button>
          </div>

          <OtpCodeInputs
            value={code}
            onChange={setCode}
            onComplete={handleVerifyCode}
            disabled={pending}
            error={codeStatus === 'wrong'}
          />

          <div
            className={
              pending
                ? 'border-accent-emerald-border bg-accent-emerald-bg flex min-h-[42px] items-center gap-2.5 rounded-[10px] border px-3 py-2.5'
                : codeStatus === 'wrong'
                  ? 'border-accent-red-border bg-accent-red-bg flex min-h-[42px] items-center gap-2.5 rounded-[10px] border px-3 py-2.5'
                  : codeStatus === 'expired'
                    ? 'border-accent-amber-border bg-accent-amber-bg flex min-h-[42px] items-center gap-2.5 rounded-[10px] border px-3 py-2.5'
                    : 'border-divider bg-surface-secondary flex min-h-[42px] items-center gap-2.5 rounded-[10px] border px-3 py-2.5'
            }
          >
            {pending && (
              <span className="border-accent-emerald-border h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-t-emerald-700" />
            )}
            <p
              role="status"
              className={
                pending
                  ? 'text-accent-emerald-text text-[12.5px] leading-snug'
                  : codeStatus === 'wrong'
                    ? 'text-accent-red-text text-[12.5px] leading-snug'
                    : codeStatus === 'expired'
                      ? 'text-accent-amber-text text-[12.5px] leading-snug'
                      : 'text-body text-[12.5px] leading-snug'
              }
            >
              {pending
                ? 'Checking your code…'
                : codeStatus === 'wrong'
                  ? 'That code did not match. Open the newest email and try the six digits again.'
                  : codeStatus === 'expired'
                    ? 'This code has expired. Send yourself a new one. Nothing on this browser was changed.'
                    : 'Type the 6-digit code from your email. It sends itself once the last box is filled.'}
            </p>
          </div>

          <div className="border-divider flex items-center justify-between gap-3 border-t pt-3">
            <span className="text-muted text-[12.5px]">
              {codeStatus === 'expired'
                ? 'Codes last 10 minutes'
                : 'Code expires in 10 minutes'}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full"
              disabled={pending || cooldown > 0}
              onClick={handleRequestCode}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </Button>
          </div>
          {error && codeStatus === 'idle' && (
            <p role="alert" className="text-accent-red-text text-sm">
              {error}
            </p>
          )}
        </div>
      )}

      {step === 'success' && (
        <div className="flex flex-col items-center gap-3.5 pt-1">
          <span className="border-accent-emerald-border bg-accent-emerald-bg text-accent-emerald-text inline-flex h-16 w-16 items-center justify-center rounded-full border-2">
            <Check className="h-8 w-8" strokeWidth={2.4} />
          </span>
          <div className="text-center">
            <p className="text-heading text-base font-semibold">
              You are signed in
            </p>
            <p className="text-muted mt-1 text-[13px]">
              Signed in as {sentTo}. Nothing has been copied or changed yet. You
              choose what gets saved.
            </p>
          </div>
          <Button variant="primary" size="lg" fullWidth asChild>
            <Link href={successHref} onClick={() => onSignedIn?.()}>
              {successActionLabel}
            </Link>
          </Button>
        </div>
      )}

      {error && step === 'email' && (
        <p role="alert" className="text-accent-red-text text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
