import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.join(dirname, 'src') } },
  test: {
    name: 'slice11a-coverage',
    environment: 'jsdom',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/lib/durableDm/*.test.ts',
      'src/lib/indexeddb/__tests__/campaignSettings*.test.ts',
      'src/app/api/campaign-settings/route.test.ts',
      'src/components/ui/campaign/CampaignSettingsSyncControls.test.tsx',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/slice11a',
      include: [
        'src/lib/durableDm/campaignSettingsFamily.ts',
        'src/lib/durableDm/campaignSettingsProjection.ts',
        'src/lib/durableDm/slice11aFlags.ts',
        'src/lib/indexeddb/campaignSettingsAuthority.ts',
        'src/lib/indexeddb/campaignSettingsRepository.ts',
        'src/lib/indexeddb/campaignSettingsSelection.ts',
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
