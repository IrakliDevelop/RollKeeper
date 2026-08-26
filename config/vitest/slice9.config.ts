import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '../..');

export default defineConfig({
  root,
  resolve: { alias: { '@': path.join(root, 'src') } },
  test: {
    name: 'slice9-coverage',
    environment: 'jsdom',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/lib/indexeddb/__tests__/automaticCharacter*.test.ts',
      'src/lib/supabase/automaticCharacterSync*.test.ts',
      'src/lib/supabase/browserAutomaticCharacterSync.test.ts',
      'src/lib/playerBackup/__tests__/playerBackupCoordinator.test.ts',
      'src/lib/playerBackup/__tests__/playerBackupRunRepository.test.ts',
      'src/lib/playerBackup/__tests__/playerBackupEligibility.test.ts',
      'src/lib/playerBackup/__tests__/playerBackupOnlineExecution.test.ts',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/slice9',
      include: [
        'src/lib/indexeddb/automaticCharacterConflictService.ts',
        'src/lib/indexeddb/automaticCharacterSyncRepository.ts',
        'src/lib/supabase/automaticCharacterSyncCoordinator.ts',
        'src/lib/supabase/automaticCharacterSyncPreferences.ts',
        'src/lib/supabase/automaticCharacterSyncPuller.ts',
        'src/lib/supabase/automaticCharacterSyncRuntime.ts',
        'src/lib/supabase/automaticCharacterSyncService.ts',
        'src/lib/supabase/automaticCharacterSyncWorker.ts',
        'src/lib/supabase/automaticCharacterSyncValidation.ts',
        'src/lib/supabase/browserAutomaticCharacterSync.ts',
      ],
      thresholds: {
        perFile: true,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
