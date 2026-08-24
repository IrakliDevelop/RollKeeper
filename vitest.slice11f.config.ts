import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Slice 11F coverage contract for the combat_log_archive family.
//
// WARNING for the next reader: src/app/dm/campaign/[code]/__tests__/layout.test.tsx
// and src/components/ui/campaign/CombatLogArchiveSyncControls/*.test.tsx are in
// test.include below — they run as part of this suite — but the controller
// component (src/app/dm/campaign/[code]/_components/CombatLogArchiveSyncController*,
// wherever it lives) is deliberately NOT in coverage.include. coverage.include
// lists only the nine src/lib/** library modules. The percentages this config
// reports measure those library modules only and are NEVER evidence that the
// controller's four durability guards (mutation-ID replay, CAS/epoch
// mismatch, oversized-record rejection, cloud-write failure fallback) are
// covered. A prior PR conflated "coverage contract is green" with "the
// controller is tested" — see the coverage caveat in BACKPORT_EVIDENCE.md.
// Do not repeat that mistake: guard coverage for the controller is
// demonstrated only by the controller's own tests and by the mutation-verify
// red/green cycle recorded in SLICE_11F_EVIDENCE.md, never by this config.

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.join(dirname, 'src') } },
  test: {
    name: 'slice11f-coverage',
    environment: 'jsdom',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/lib/durableDm/combatLogArchive*.test.ts',
      'src/lib/durableDm/slice11fFlags.test.ts',
      'src/lib/indexeddb/__tests__/combatLogArchive*.test.ts',
      'src/app/api/combat-log-sync/route.test.ts',
      'src/components/ui/campaign/CombatLogArchiveSyncControls/*.test.tsx',
      'src/app/dm/campaign/[code]/__tests__/layout.test.tsx',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/slice11f',
      include: [
        'src/lib/durableDm/combatLogArchiveAwareStorage.ts',
        'src/lib/durableDm/combatLogArchiveLegacyAuthority.ts',
        'src/lib/durableDm/combatLogArchiveFamily.ts',
        'src/lib/durableDm/combatLogArchiveSyncService.ts',
        'src/lib/durableDm/slice11fFlags.ts',
        'src/lib/indexeddb/combatLogArchiveAuthority.ts',
        'src/lib/indexeddb/combatLogArchiveRepository.ts',
        'src/lib/indexeddb/combatLogArchiveSelection.ts',
        'src/lib/indexeddb/combatLogArchiveMigration.ts',
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
