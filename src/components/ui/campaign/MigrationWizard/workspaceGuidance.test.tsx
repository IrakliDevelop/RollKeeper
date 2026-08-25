import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DmCloudWorkspaceControls } from '@/components/ui/campaign/DmCloudWorkspaceControls';
import type { BrowserDmWorkspaceContext } from '@/lib/supabase/browserDmWorkspace';
import type { CampaignInfo } from '@/types/campaign';

import { WorkspaceStep } from './steps/WorkspaceStep';

/**
 * Scoped re-review N3. D3's missing-workspace guidance told the DM to use
 * "Fork ALPHA to cloud" while the dashboard's real button reads "Fork
 * <campaign name> to cloud". The wizard's own test asserted the wizard's own
 * literal, so it could never have caught that — the same failure mode D3
 * exists to fix (naming an action the DM cannot find), at lower severity.
 *
 * This test binds the CONSUMER to the PRODUCER the way Task 18b's
 * `familyConflictMessage.ts` does: it renders the real
 * `DmCloudWorkspaceControls`, reads the accessible name off the button the
 * DM would actually click, and requires the wizard's guidance to contain
 * exactly that string. Neither side is restated as a literal here, so
 * renaming the button in `DmCloudWorkspaceControls` alone reddens this test
 * instead of silently making the wizard's advice wrong.
 */

const CAMPAIGN: CampaignInfo = {
  code: 'ALPHA',
  // Deliberately NOT the code, and not derivable from it: the two used to
  // be interchanged, and a fixture whose name equalled its code would hide
  // exactly that.
  name: 'Canary Reach',
  createdAt: '2026-08-24T00:00:00.000Z',
};

function cloudContext(): BrowserDmWorkspaceContext {
  return {
    accountId: 'account-1',
    accountLabel: 'owner@example.test',
    close: vi.fn(),
    discover: vi.fn().mockResolvedValue([]),
    remember: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    forkLegacy: vi.fn(),
  };
}

/** The real dashboard control renders only with its own flags enabled. */
function enableWorkspaceCloud() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_DM_WORKSPACE_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'public-test-key');
}

/** The accessible name of the fork button the dashboard actually renders. */
function realForkControlName(): string {
  enableWorkspaceCloud();
  const view = render(
    <DmCloudWorkspaceControls
      campaigns={[CAMPAIGN]}
      dmId="legacy-dm"
      cloud={cloudContext()}
    />
  );
  // Located by the CAMPAIGN it acts on, not by the wording of the label —
  // a locator that matched the label's own shape would turn a rename into a
  // "control not found" error instead of the content mismatch this test is
  // for. The fork control is the only button that names a campaign.
  const button = view
    .getAllByRole('button')
    .find(candidate => (candidate.textContent ?? '').includes(CAMPAIGN.name));
  expect(button, 'the dashboard renders no fork control').toBeDefined();
  const name = button!.textContent ?? '';
  view.unmount();
  return name;
}

function renderGuidance(campaignName: string | null) {
  return render(
    <WorkspaceStep
      campaignCode={CAMPAIGN.code}
      campaignName={campaignName}
      discovering={false}
      discoveryError={null}
      signedIn
      workspace={null}
      onDiscover={() => {}}
    />
  );
}

describe("the wizard's missing-workspace guidance", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("names the dashboard's fork control exactly as the dashboard renders it", () => {
    const realName = realForkControlName();
    // Sanity: the control is named after the campaign, not its code. Without
    // this line the binding below would still pass for a control named
    // "Fork ALPHA to cloud", which is the bug being fixed.
    expect(realName).toContain(CAMPAIGN.name);
    expect(realName).not.toContain(CAMPAIGN.code);

    renderGuidance(CAMPAIGN.name);
    const guidance = screen.getByText(
      /this wizard moves campaign data into a cloud workspace/i
    );
    expect(guidance).toHaveTextContent(realName);
  });

  it('names only the create control when this browser has no such campaign', () => {
    renderGuidance(null);
    const guidance = screen.getByText(
      /this wizard moves campaign data into a cloud workspace/i
    );
    // The dashboard renders a fork button per KNOWN campaign, so with no
    // roster entry there is nothing to fork and naming one would be the
    // same defect again.
    expect(guidance).toHaveTextContent('Create cloud workspace');
    expect(guidance.textContent ?? '').not.toMatch(/fork/i);
  });
});
