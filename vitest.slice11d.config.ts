import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.join(dirname, 'src') } },
  test: {
    name: 'slice11d-coverage',
    environment: 'jsdom',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/lib/durableDm/npc*.test.ts',
      'src/lib/durableDm/slice11dFlags.test.ts',
      'src/lib/indexeddb/__tests__/npc*.test.ts',
      'src/app/api/npc-sync/route.test.ts',
      'src/components/ui/campaign/NpcSyncControls/*.test.tsx',
      'src/app/dm/campaign/[code]/__tests__/layout.test.tsx',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/slice11d',
      include: [
        'src/lib/durableDm/npcAwareStorage.ts',
        'src/lib/durableDm/npcLegacyAuthority.ts',
        'src/lib/durableDm/npcFamily.ts',
        'src/lib/durableDm/npcSyncService.ts',
        'src/lib/durableDm/slice11dFlags.ts',
        'src/lib/indexeddb/npcAuthority.ts',
        'src/lib/indexeddb/npcRepository.ts',
        'src/lib/indexeddb/npcSelection.ts',
        'src/lib/indexeddb/npcMigration.ts',
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
