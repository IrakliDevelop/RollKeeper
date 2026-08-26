import { notFound } from 'next/navigation';

import { isMigrationWizardVisible } from '@/lib/durableDm/slice11gFlags';

import { MigrationWizardRoute } from './MigrationWizardRoute';

/**
 * Spec R2a: the migration wizard's dedicated route, deliberately OUTSIDE
 * `src/app/dm/campaign/[code]/layout.tsx` -- so no durable-family sync owner
 * (NPC / encounter / combat log archive) is mounted while the wizard runs.
 * A cutover committed under a mounted owner would leave that owner's store
 * with `authority` null and `hydrated` false while the aware storage froze
 * the legacy key -- the silent-loss shape backport defects 1 and 3 already
 * demonstrated.
 *
 * The dashboard launcher (`src/app/dm/page.tsx`) only renders while
 * `isMigrationWizardVisible()` is on, but that alone does not stop direct
 * navigation to this URL -- this route independently re-checks the SAME
 * flag, so a DM cannot reach the wizard by typing the URL while it is off.
 *
 * The campaign code lives in the URL for deterministic reload and resume:
 * step 0's owner-workspace discovery and every family's authority read are
 * both keyed on it, and a reload re-mounts this same route with the same
 * code, which is what lets progress re-derive from persisted state (R6)
 * instead of being lost.
 */
export default async function MigrationWizardPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  if (!isMigrationWizardVisible()) notFound();
  const { code } = await params;
  return <MigrationWizardRoute campaignCode={code} />;
}
