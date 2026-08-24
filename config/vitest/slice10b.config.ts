import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '../..');

export default defineConfig({
  root,
  resolve: { alias: { '@': path.join(root, 'src') } },
  test: {
    name: 'slice10b-coverage',
    environment: 'jsdom',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/lib/campaignMembership{Authority,Security,Service,Token}.test.ts',
      'src/lib/supabase/campaignMembershipGateway.test.ts',
      'src/app/membership/MembershipInvitationPage.test.tsx',
      'src/components/ui/campaign/DmCampaignMembershipControls.test.tsx',
      'src/app/api/campaign/[code]/battlemap-token/route.test.ts',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/slice10b',
      include: [
        'src/lib/campaignMembershipAuthority.ts',
        'src/lib/campaignMembershipSecurity.ts',
        'src/lib/campaignMembershipService.ts',
        'src/lib/campaignMembershipToken.ts',
        'src/lib/supabase/campaignMembershipGateway.ts',
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
