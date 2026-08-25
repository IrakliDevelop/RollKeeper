import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Slice 11G coverage contract for the migration wizard.
//
// WARNING for the next reader: the wizard component
// (src/components/ui/campaign/MigrationWizard/) runs as part of this suite via
// test.include, but is deliberately NOT in coverage.include. coverage.include
// lists the src/lib/** modules only. The percentages this config reports
// measure those library modules and are NEVER evidence that the wizard's
// guards — the one-bundle receipt gate, the per-family typed confirmation, the
// skip/cancel no-write rule, and the report's completion claims — are covered.
// Guard coverage for the wizard is demonstrated only by the wizard's own tests
// and the mutation-verify red/green cycle recorded in SLICE_11G_EVIDENCE.md.
// See the same caveat in BACKPORT_EVIDENCE.md; do not repeat that mistake.
//
// test.include also carries three files that are not this task's own but are
// 11G work with no other 11G suite to run under (rulings.md R1.1):
// awareStorageFixpoint.test.ts (Task 1's fixpoint guard), deviceRecovery.test.ts
// (Task 3 modifies deviceRecovery.ts), and the browserRecoveryRepository suite
// (Task 3's receipt-vector write). None of their source files are added to
// coverage.include — those files are shipped code owned by earlier slices and
// measuring them here would import their coverage debt into this contract
// (rulings.md R1.2). The /dm dashboard test file is Task 17's own (the
// flag-gated launcher) — Task 18's R2b hardening edits the SAME file, not a
// new one.

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '../..');

export default defineConfig({
  root,
  resolve: { alias: { '@': path.join(root, 'src') } },
  test: {
    name: 'slice11g-coverage',
    environment: 'jsdom',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/lib/durableDm/__tests__/slice11gFlags.test.ts',
      'src/lib/durableDm/__tests__/migrationMutationIds.test.ts',
      'src/lib/durableDm/__tests__/familyAuthorityNormalizer.test.ts',
      'src/lib/durableDm/__tests__/resumableCloudActivation.test.ts',
      'src/lib/durableDm/__tests__/familyRegistry.test.ts',
      'src/lib/durableDm/__tests__/migrationRunState.test.ts',
      'src/lib/durableDm/__tests__/authorityRepair.test.ts',
      'src/lib/durableDm/__tests__/familySelectionReader.test.ts',
      'src/lib/durableDm/__tests__/awareStorageFixpoint.test.ts',
      'src/lib/durableDm/adapters/__tests__/*.test.ts',
      'src/lib/__tests__/browserRecoveryRepository.test.ts',
      'src/lib/__tests__/deviceRecovery.test.ts',
      'src/components/ui/campaign/MigrationWizard/*.test.tsx',
      'src/app/dm/migrate/[code]/__tests__/*.test.tsx',
      'src/app/dm/__tests__/page.test.tsx',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/slice11g',
      include: [
        'src/lib/durableDm/slice11gFlags.ts',
        'src/lib/durableDm/migrationMutationIds.ts',
        'src/lib/durableDm/familyAuthorityNormalizer.ts',
        'src/lib/durableDm/resumableCloudActivation.ts',
        'src/lib/durableDm/familyRegistry.ts',
        'src/lib/durableDm/migrationRunState.ts',
        'src/lib/durableDm/authorityRepair.ts',
        'src/lib/durableDm/familySelectionReader.ts',
        'src/lib/durableDm/adapters/*.ts',
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
