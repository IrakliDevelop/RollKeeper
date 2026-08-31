import { spawn } from 'node:child_process';

import { getLocalSupabaseTestConfig } from './local-supabase-env.mjs';

const config = getLocalSupabaseTestConfig();
const child = spawn('npm', ['run', 'dev', '--', '--port', '3111'], {
  env: {
    ...process.env,
    NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE: 'true',
    NEXT_PUBLIC_SUPABASE_AUTH_ENABLED: 'true',
    NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED: 'true',
    NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED: 'false',
    NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED: 'false',
    NEXT_PUBLIC_INDEXEDDB_MIGRATION_ENABLED: 'false',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
    NEXT_PUBLIC_SUPABASE_URL: config.apiUrl,
  },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', code => process.exit(code ?? 1));
