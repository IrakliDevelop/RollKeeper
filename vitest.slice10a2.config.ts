import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.join(dirname, 'src') } },
  test: {
    name: 'slice10a2-coverage',
    environment: 'jsdom',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/lib/{guestPlayerProjection,guestRouteAuthorization,guestSessionCrypto,guestSessionSecurity,guestSessionService}.test.ts',
      'src/lib/supabase/guestSessionGateway.test.ts',
      'src/app/guest/GuestRedemptionPage.test.tsx',
      'src/components/ui/campaign/DmGuestInvitationControls.test.tsx',
      'src/lib/campaignAuthorityRouter.test.ts',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/slice10a2',
      include: [
        'src/lib/guestPlayerProjection.ts',
        'src/lib/guestRouteAuthorization.ts',
        'src/lib/guestSessionCrypto.ts',
        'src/lib/guestSessionSecurity.ts',
        'src/lib/guestSessionService.ts',
        'src/lib/supabase/guestSessionGateway.ts',
        'src/lib/campaignAuthorityRouter.ts',
      ],
      thresholds: {
        perFile: true,
        statements: 90,
        functions: 90,
        branches: 80,
      },
    },
  },
});
