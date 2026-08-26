import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CampaignInfo } from '@/types/campaign';

import { WorkspaceStep } from './steps/WorkspaceStep';

const CAMPAIGN: CampaignInfo = {
  code: 'ALPHA',
  // Deliberately NOT the code, and not derivable from it: the two used to
  // be interchanged, and a fixture whose name equalled its code would hide
  // exactly that.
  name: 'Canary Reach',
  createdAt: '2026-08-24T00:00:00.000Z',
};

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
      onCreateWorkspace={vi.fn()}
    />
  );
}

describe("the wizard's missing-workspace guidance", () => {
  afterEach(() => {
    cleanup();
  });

  it('sets up the online copy inside the wizard', () => {
    renderGuidance(CAMPAIGN.name);
    expect(screen.getByText(CAMPAIGN.name)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /set up online backup/i })
    ).toBeInTheDocument();
  });

  it('does not expose implementation vocabulary when the campaign name is unavailable', () => {
    renderGuidance(null);
    expect(document.body.textContent ?? '').not.toMatch(
      /workspace|manifest|indexeddb|authority|epoch|canary/i
    );
  });
});
