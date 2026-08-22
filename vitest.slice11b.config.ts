import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.join(dirname, 'src') } },
  test: {
    name: 'slice11b-coverage',
    environment: 'jsdom',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/lib/durableDm/calendar*.test.ts',
      'src/lib/durableDm/slice11bFlags.test.ts',
      'src/lib/indexeddb/__tests__/calendar*.test.ts',
      'src/app/api/calendar-sync/route.test.ts',
      'src/components/ui/calendar/CalendarSyncControls.test.tsx',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/slice11b',
      include: [
        'src/lib/durableDm/calendarAwareStorage.ts',
        'src/lib/durableDm/calendarProjection.ts',
        'src/lib/durableDm/calendarSyncService.ts',
        'src/lib/durableDm/slice11bFlags.ts',
        'src/lib/indexeddb/calendarAuthority.ts',
        'src/lib/indexeddb/calendarRepository.ts',
        'src/lib/indexeddb/calendarSelection.ts',
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
