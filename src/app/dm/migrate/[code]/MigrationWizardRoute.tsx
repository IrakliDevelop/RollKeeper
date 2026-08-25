'use client';

import { useRouter } from 'next/navigation';

import {
  MigrationWizard,
  type MigrationWizardCloseStatus,
} from '@/components/ui/campaign/MigrationWizard';
import { useDmStore } from '@/store/dmStore';

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
 * nothing was cut over AND before/while this mount's bulk authority scan is
 * unresolved (Task 14 carry-forward hazard). `discoveryAttempted` is what
 * tells those apart -- it is `true` only once that scan has actually
 * completed for the CURRENT owner-workspace pairing (it resets to `false`
 * on a fresh "Find my campaigns" click, and stays `false` after a discovery
 * that failed or found no signed-in owner, since the scan never runs at
 * all then). Routing to `/dm` on a stale, unverified `false` after a real
 * prior cutover would land the DM on editable campaign UI with no fresh
 * owner mounted, exactly what R2a exists to prevent -- so "unknown" routes
 * the SAME conservative way as "yes, something was cut over".
 */
export function MigrationWizardRoute({
  campaignCode,
}: {
  campaignCode: string;
}) {
  const router = useRouter();
  // Re-review N3: step 0's missing-workspace guidance names the dashboard's
  // fork button, and that button is named after the campaign, not its code.
  // Read from `dmStore` — the SAME roster `/dm` builds those buttons from —
  // so the two cannot name different things. `undefined` (no roster entry)
  // means the dashboard renders no fork button for this campaign either.
  // Selects the NAME, not the campaign object: a primitive result keeps the
  // selector referentially stable across renders.
  const campaignName = useDmStore(
    state =>
      state.campaigns.find(campaign => campaign.code === campaignCode)?.name ??
      null
  );

  const handleClose = ({
    anyCutoverCommitted,
    discoveryAttempted,
  }: MigrationWizardCloseStatus) => {
    const routeToCampaign = anyCutoverCommitted || !discoveryAttempted;
    router.replace(routeToCampaign ? `/dm/campaign/${campaignCode}` : '/dm');
  };

  return (
    <MigrationWizard
      campaignCode={campaignCode}
      campaignName={campaignName}
      onClose={handleClose}
    />
  );
}
