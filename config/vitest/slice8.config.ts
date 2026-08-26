import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '../..');

export default defineConfig({
  root,
  resolve: { alias: { '@': path.join(root, 'src') } },
  test: {
    name: 'slice8-coverage',
    environment: 'jsdom',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/lib/indexeddb/__tests__/character*.test.ts',
      'src/lib/indexeddb/__tests__/migrationState.test.ts',
      'src/lib/playerBackup/__tests__/playerBackupActiveSelection.test.ts',
      'src/lib/playerBackup/__tests__/playerBackupCoordinator.test.ts',
      'src/lib/playerBackup/__tests__/playerBackupSafety.test.ts',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/slice8',
      include: [
        'src/lib/indexeddb/character*.ts',
        'src/lib/indexeddb/migrationState.ts',
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
