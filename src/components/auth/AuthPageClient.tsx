'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getPublicAuthConfig } from '@/lib/supabase/authConfig';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

import { AuthForm } from './AuthForm';
import { TurnstileWidget } from './TurnstileWidget';

export function AuthPageClient() {
  const router = useRouter();
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [turnstileAttempt, setTurnstileAttempt] = useState(0);
  const config = getPublicAuthConfig();
  const client = createSupabaseBrowserClient();

  if (!config || !client) {
    return (
      <p className="text-body">
        Account sign-in is currently disabled. All local RollKeeper features
        remain available.
      </p>
    );
  }

  const requireTurnstile = process.env.NODE_ENV === 'production';
  if (requireTurnstile && !config.turnstileSiteKey) {
    return (
      <p role="alert" className="text-accent-red-text">
        Account sign-in is not configured for this deployment.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {requireTurnstile && config.turnstileSiteKey && (
        <TurnstileWidget
          key={turnstileAttempt}
          siteKey={config.turnstileSiteKey}
          onToken={setTurnstileToken}
        />
      )}
      <AuthForm
        auth={client.auth}
        requireTurnstile={requireTurnstile}
        turnstileToken={turnstileToken}
        onCaptchaConsumed={() => {
          setTurnstileToken(undefined);
          setTurnstileAttempt(value => value + 1);
        }}
        onSignedIn={() => {
          router.push('/account');
          router.refresh();
        }}
      />
    </div>
  );
}
