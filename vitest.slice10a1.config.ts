import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.join(dirname, 'src') } },
  test: {
    name: 'slice10a1-coverage',
    environment: 'jsdom',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/lib/campaignAuthorityRouter.test.ts',
      'src/lib/indexeddb/__tests__/dmWorkspaceRepository.test.ts',
      'src/lib/supabase/{browserDmWorkspace,dmWorkspaceGateway,dmWorkspaceService}.test.ts',
      'src/components/ui/campaign/DmCloudWorkspaceControls.test.tsx',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/slice10a1',
      include: [
        'src/lib/campaignAuthorityRouter.ts',
        'src/lib/indexeddb/dmWorkspaceRepository.ts',
        'src/lib/supabase/browserDmWorkspace.ts',
        'src/lib/supabase/dmWorkspaceGateway.ts',
        'src/lib/supabase/dmWorkspaceService.ts',
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
