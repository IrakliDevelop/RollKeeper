import { spawn } from 'node:child_process';

import { getLocalSupabaseTestConfig } from './local-supabase-env.mjs';

const config = getLocalSupabaseTestConfig();
const guestEnabled = process.env.MANUAL_GUEST_ENABLED !== 'false';
const npmScript = process.env.MANUAL_NPM_SCRIPT ?? 'dev';
const child = spawn('npm', ['run', npmScript], {
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_AUTH_ENABLED: 'true',
    NEXT_PUBLIC_SUPABASE_DM_WORKSPACE_ENABLED: 'true',
    NEXT_PUBLIC_SUPABASE_HYBRID_GUEST_UI_ENABLED: String(guestEnabled),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
    NEXT_PUBLIC_SUPABASE_URL: config.apiUrl,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
    SUPABASE_HYBRID_GUEST_ENABLED: String(guestEnabled),
    SUPABASE_SERVICE_ROLE_KEY: config.serviceRoleKey,
    GUEST_SESSION_PEPPER: 'synthetic-manual-guest-pepper-at-least-32-bytes',
  },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', code => process.exit(code ?? 1));
