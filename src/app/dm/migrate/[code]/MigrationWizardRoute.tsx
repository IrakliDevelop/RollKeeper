'use client';

import { useRouter } from 'next/navigation';

import {
  MigrationWizard,
  type MigrationWizardCloseStatus,
} from '@/components/ui/campaign/MigrationWizard';

/**
 * Spec R2a's close behaviour, the one piece of routing logic this dedicated
 * route exists to carry:
 *
 * - once anything was cut over, `router.replace('/dm/campaign/<code>')` so
 *   fresh durable-family owners mount before editable campaign UI returns;
 * - otherwise `router.replace('/dm')` -- a closed dialog on this route is a
 *   blank page, so Close always has to leave it.
 *
 * `anyCutoverCommitted` alone is not trustworthy: it reads `false` both when
 * nothing was cut over AND before this mount's workspace discovery has ever
 * run (Task 14 carry-forward hazard). `discoveryAttempted` is what tells
 * those apart -- a `false` `anyCutoverCommitted` is only trusted once
 * discovery has actually resolved (success OR failure) THIS mount. Routing
 * to `/dm` on a stale, unverified `false` after a real prior cutover would
 * land the DM on editable campaign UI with no fresh owner mounted, exactly
 * what R2a exists to prevent -- so "unknown" routes the SAME conservative
 * way as "yes, something was cut over".
 */
export function MigrationWizardRoute({
  campaignCode,
}: {
  campaignCode: string;
}) {
  const router = useRouter();

  const handleClose = ({
    anyCutoverCommitted,
    discoveryAttempted,
  }: MigrationWizardCloseStatus) => {
    const routeToCampaign = anyCutoverCommitted || !discoveryAttempted;
    router.replace(routeToCampaign ? `/dm/campaign/${campaignCode}` : '/dm');
  };

  return <MigrationWizard campaignCode={campaignCode} onClose={handleClose} />;
}
