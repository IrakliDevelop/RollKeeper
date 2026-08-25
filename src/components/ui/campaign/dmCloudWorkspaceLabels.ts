/**
 * The DM dashboard's cloud-workspace control names, in one place, because
 * two surfaces render them: `DmCloudWorkspaceControls` (the real section and
 * buttons) and the migration wizard's step 0, whose D3 guidance tells a DM
 * with no cloud workspace which control to go and press.
 *
 * Scoped re-review N3: the wizard named "Fork <CODE> to cloud" while the
 * button reads "Fork <campaign name> to cloud" — an action named in words
 * the DM cannot find on the dashboard, which is the exact failure mode D3
 * exists to fix, at lower severity. The wizard's own test asserted the
 * wizard's own literal, so it was self-referential and structurally
 * incapable of catching the mismatch.
 *
 * Same producer/consumer binding as `familyConflictMessage.ts`: deriving
 * both surfaces from this one module is what stops them drifting apart
 * again, and `MigrationWizard/workspaceGuidance.test.tsx` binds the
 * wizard's rendered guidance to the REAL button's accessible name rather
 * than to a copy of it.
 */
export function forkCampaignToCloudLabel(campaignName: string): string {
  return `Fork ${campaignName} to cloud`;
}

/** The button that creates a brand-new (unforked) owner workspace. */
export const CREATE_CLOUD_WORKSPACE_LABEL = 'Create cloud workspace';

/** The dashboard section both controls live in. */
export const DM_CLOUD_WORKSPACE_SECTION_LABEL = 'DM cloud workspace';
