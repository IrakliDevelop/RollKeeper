import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Player Backup Wizard coverage contract (Task 11).
//
// coverage.include is an explicit list of lib modules that own consent,
// selection partitioning, run identity, destructive cloud action, conflict
// preservation, recovery write eligibility, acknowledgement, or
// stale-response rejection. Do not replace it with a glob: well-tested copy
// or presentation modules would mask an under-tested destructive module.
//
// Deliberately excluded from coverage.include (still exercised by tests
// where needed):
// - playerBackupCopy.ts — pure presentation strings
// - playerBackupDashboard.ts / playerBackupStatus.ts — view/status projectors
// - playerBackupCloudPreview.ts — read-only list/classify; enrollment refusal
//   is owned by playerBackupEligibility.ts and the coordinator
// - React surfaces (PlayerBackupWizard/, PlayerBackupManager.tsx,
//   PlayerBackupRecovery.tsx, usePlayerBackupDashboard.ts,
//   PersistenceBootstrap.tsx, route pages) — component behavior stays in
//   their focused unit/Storybook tests
// - src/lib/indexeddb/*.ts — already gated by the IndexedDB CI contract;
//   measuring them here would hide or duplicate that floor
//
// test.include reuses existing focused player-backup, automatic-sync,
// IndexedDB, recovery, route, dashboard, manager, wizard, and bootstrap
// tests that execute the included modules. Percentages reported here are
// never evidence that React wizard guards are covered.

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '../..');

export default defineConfig({
  root,
  resolve: { alias: { '@': path.join(root, 'src') } },
  test: {
    name: 'player-backup-wizard-coverage',
    environment: 'jsdom',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/lib/playerBackup/__tests__/*.test.ts',
      'src/components/ui/character/PlayerBackupWizard/*.test.ts',
      'src/components/ui/character/PlayerBackupWizard/*.test.tsx',
      'src/components/ui/character/PlayerBackupManager.test.tsx',
      'src/components/ui/character/PlayerBackupRecovery.test.tsx',
      'src/components/ui/character/PlayerBackupSummaryCard.test.tsx',
      'src/app/player/backup/__tests__/page.test.tsx',
      'src/app/player/__tests__/page.test.tsx',
      'src/components/PersistenceBootstrap.test.tsx',
      'src/lib/indexeddb/__tests__/characterRecovery.test.ts',
      'src/lib/indexeddb/__tests__/characterCutoverSelection.test.ts',
      'src/lib/supabase/browserAutomaticCharacterSync.test.ts',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/player-backup-wizard',
      include: [
        'src/lib/playerBackup/playerBackupCoordinator.ts',
        'src/lib/playerBackup/playerBackupConflictCoordinator.ts',
        'src/lib/playerBackup/playerBackupConflictResolution.ts',
        'src/lib/playerBackup/playerBackupRunFence.ts',
        'src/lib/playerBackup/playerBackupRunRepository.ts',
        'src/lib/playerBackup/playerBackupActiveSelection.ts',
        'src/lib/playerBackup/playerBackupOnlineExecution.ts',
        'src/lib/playerBackup/playerBackupOngoingExecution.ts',
        'src/lib/playerBackup/playerBackupSafety.ts',
        'src/lib/playerBackup/playerBackupRecoveryPolicy.ts',
        'src/lib/playerBackup/playerBackupManagement.ts',
        'src/lib/playerBackup/playerBackupEligibility.ts',
        'src/lib/playerBackup/playerBackupFlags.ts',
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
