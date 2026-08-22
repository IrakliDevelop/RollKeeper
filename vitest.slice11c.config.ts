import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.join(dirname, 'src') } },
  test: {
    name: 'slice11c-coverage',
    environment: 'jsdom',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/lib/durableDm/magicItem*.test.ts',
      'src/lib/durableDm/slice11cFlags.test.ts',
      'src/lib/indexeddb/__tests__/magicItem*.test.ts',
      'src/app/api/magic-item-sync/route.test.ts',
      'src/components/ui/campaign/MagicItemLibrary/MagicItemSyncControls.test.tsx',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/slice11c',
      include: [
        'src/lib/durableDm/magicItemAwareStorage.ts',
        'src/lib/durableDm/magicItemLegacyAuthority.ts',
        'src/lib/durableDm/magicItemFamily.ts',
        'src/lib/durableDm/magicItemSyncService.ts',
        'src/lib/durableDm/slice11cFlags.ts',
        'src/lib/indexeddb/magicItemAuthority.ts',
        'src/lib/indexeddb/magicItemRepository.ts',
        'src/lib/indexeddb/magicItemSelection.ts',
        'src/lib/indexeddb/magicItemMigration.ts',
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
