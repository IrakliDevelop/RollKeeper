import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '../..');

export default defineConfig({
  root,
  resolve: { alias: { '@': path.join(root, 'src') } },
  test: {
    name: 'slice11e-coverage',
    environment: 'jsdom',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/lib/durableDm/encounter*.test.ts',
      'src/lib/durableDm/slice11eFlags.test.ts',
      'src/lib/indexeddb/__tests__/encounter*.test.ts',
      'src/app/api/encounter-sync/route.test.ts',
      'src/components/ui/campaign/EncounterSyncControls/*.test.tsx',
      'src/app/dm/campaign/[code]/__tests__/layout.test.tsx',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/slice11e',
      include: [
        'src/lib/durableDm/encounterAwareStorage.ts',
        'src/lib/durableDm/encounterLegacyAuthority.ts',
        'src/lib/durableDm/encounterFamily.ts',
        'src/lib/durableDm/encounterSyncService.ts',
        'src/lib/durableDm/slice11eFlags.ts',
        'src/lib/indexeddb/encounterAuthority.ts',
        'src/lib/indexeddb/encounterRepository.ts',
        'src/lib/indexeddb/encounterSelection.ts',
        'src/lib/indexeddb/encounterMigration.ts',
      ],
      thresholds: {
        perFile: true,
        statements: 85,
        functions: 85,
        branches: 75,
      },
    },
  },
});
