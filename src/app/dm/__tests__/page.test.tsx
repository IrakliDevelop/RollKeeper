import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import { useDmStore } from '@/store/dmStore';
import {
  campaignSettingsProjectionAuthorityKey,
  type ProjectionAuthorityMarker,
} from '@/lib/durableDm/campaignSettingsLegacyProjection';

import DmDashboardPage from '../page';

function seedCampaignSettingsMarker(
  code: string,
  authority: ProjectionAuthorityMarker['authority']
) {
  const marker: ProjectionAuthorityMarker = {
    version: 1,
    authority,
    epoch: authority === 'legacy_restored' ? 2 : 1,
    campaignId: `cloud-${code}`,
  };
  localStorage.setItem(
    campaignSettingsProjectionAuthorityKey(code),
    JSON.stringify(marker)
  );
}

function seedRoutedCampaignSettings(
  code: string,
  authority: 'indexedDB' | 'postgres' = 'postgres'
) {
  seedCampaignSettingsMarker(code, authority);
}

function seedRolledBackCampaignSettings(code: string) {
  seedCampaignSettingsMarker(code, 'legacy_restored');
}

function campaignCard(code: string): HTMLElement {
  return screen.getByTestId(`campaign-card-${code}`);
}

/**
 * Spec R2a: the launcher is flag-gated on the client, and the route it
 * links to (`/dm/migrate/[code]`) independently re-checks the SAME flag --
 * that half of the contract is pinned by
 * `src/app/dm/migrate/[code]/__tests__/page.test.tsx`. This file only pins
 * the launcher's own render condition and copy.
 */
describe('DmDashboardPage — migration wizard launcher (spec R2a)', () => {
  beforeEach(() => {
    useCharacterStore.setState({ hasHydrated: true });
    useDmStore.setState({
      dmId: 'dm-local',
      campaigns: [
        {
          code: 'ALPHA',
          name: 'Canary',
          createdAt: '2026-08-24T00:00:00.000Z',
        },
      ],
    });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('no network in tests')
    );
    delete process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE;
    delete process.env.NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE;
    delete process.env.NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE;
    localStorage.clear();
  });

  it('shows Move campaign data to cloud sync only while the wizard flag is on', () => {
    process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE = 'false';
    const { rerender } = render(<DmDashboardPage />);
    expect(
      screen.queryByRole('link', { name: /move campaign data to cloud sync/i })
    ).not.toBeInTheDocument();

    process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE = 'true';
    rerender(<DmDashboardPage />);
    expect(
      screen.getByRole('link', { name: /move campaign data to cloud sync/i })
    ).toHaveAttribute('href', '/dm/migrate/ALPHA');
  });

  it('shows Review cloud sync, not Move campaign data to cloud sync, once campaign_settings is already routed', () => {
    process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE = 'true';
    process.env.NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE = 'true';
    const marker: ProjectionAuthorityMarker = {
      version: 1,
      authority: 'postgres',
      epoch: 1,
      campaignId: 'cloud-ALPHA',
    };
    localStorage.setItem(
      campaignSettingsProjectionAuthorityKey('ALPHA'),
      JSON.stringify(marker)
    );

    render(<DmDashboardPage />);

    expect(
      screen.getByRole('link', { name: /review cloud sync/i })
    ).toHaveAttribute('href', '/dm/migrate/ALPHA');
    expect(
      screen.queryByRole('link', { name: /move campaign data to cloud sync/i })
    ).not.toBeInTheDocument();
  });

  it('renders the launcher as a link into this campaign specifically, not a generic route', () => {
    process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE = 'true';
    useDmStore.setState({
      dmId: 'dm-local',
      campaigns: [
        {
          code: 'ALPHA',
          name: 'Canary',
          createdAt: '2026-08-24T00:00:00.000Z',
        },
        { code: 'BETA', name: 'Second', createdAt: '2026-08-24T00:00:00.000Z' },
      ],
    });
    render(<DmDashboardPage />);
    const links = screen.getAllByRole('link', {
      name: /move campaign data to cloud sync/i,
    });
    expect(links).toHaveLength(2);
    const hrefs = links.map(link => link.getAttribute('href')).sort();
    expect(hrefs).toEqual(['/dm/migrate/ALPHA', '/dm/migrate/BETA']);
  });
});

/**
 * Spec R2b: once a campaign's `campaign_settings` family is routed off
 * legacy (authority `indexedDB` or `postgres`), `/dm` must not offer a
 * banner upload or a legacy delete for that campaign -- both write through
 * `rollkeeper-dm-data`, which `createCampaignSettingsAwareDmStorage` either
 * silently reverts (banner) or which orphans IndexedDB/Postgres data no
 * longer reachable from legacy (delete). The routed check MUST be read
 * directly from the marker in localStorage, independent of the
 * `NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE` client flag -- R8.3.
 */
describe('DM dashboard — migrated campaigns (spec R2b)', () => {
  beforeEach(() => {
    useCharacterStore.setState({ hasHydrated: true });
    useDmStore.setState({
      dmId: 'dm-local',
      campaigns: [
        {
          code: 'ALPHA',
          name: 'Alpha Campaign',
          createdAt: '2026-08-24T00:00:00.000Z',
        },
        {
          code: 'BETA',
          name: 'Beta Campaign',
          createdAt: '2026-08-24T00:00:00.000Z',
        },
      ],
    });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('no network in tests')
    );
    delete process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE;
    delete process.env.NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE;
    delete process.env.NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE;
    localStorage.clear();
  });

  it('offers no banner upload for a campaign whose settings are routed', () => {
    seedRoutedCampaignSettings('ALPHA');
    render(<DmDashboardPage />);
    expect(
      within(campaignCard('ALPHA')).queryByLabelText(/banner/i)
    ).not.toBeInTheDocument();
  });

  it('offers no legacy delete for a campaign whose settings are routed', () => {
    seedRoutedCampaignSettings('ALPHA');
    render(<DmDashboardPage />);
    expect(
      within(campaignCard('ALPHA')).queryByRole('button', {
        name: /delete/i,
      })
    ).not.toBeInTheDocument();
  });

  it('links into the campaign-owned UI instead, via an outline Manage link', () => {
    seedRoutedCampaignSettings('ALPHA');
    render(<DmDashboardPage />);
    expect(
      within(campaignCard('ALPHA')).getByRole('link', { name: /^manage$/i })
    ).toHaveAttribute('href', '/dm/campaign/ALPHA');
  });

  it('shows a Synced badge next to the code badge for a routed campaign', () => {
    seedRoutedCampaignSettings('ALPHA');
    render(<DmDashboardPage />);
    expect(
      within(campaignCard('ALPHA')).getByText(/^synced$/i)
    ).toBeInTheDocument();
  });

  it('performs no dmStore mutation for a migrated campaign, and its remaining controls write nothing either', async () => {
    seedRoutedCampaignSettings('ALPHA');
    const before = localStorage.getItem('rollkeeper-dm-data');
    render(<DmDashboardPage />);

    const card = campaignCard('ALPHA');
    // Strengthened per R6.5 / D6: a card click was never a write path in
    // either state, so pin the ABSENCE of the unsafe controls too, not just
    // that clicking the card is a no-op.
    expect(within(card).queryByLabelText(/banner/i)).not.toBeInTheDocument();
    expect(
      within(card).queryByRole('button', { name: /delete/i })
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(card).getByRole('link', { name: /^manage$/i })
    );
    expect(localStorage.getItem('rollkeeper-dm-data')).toBe(before);
  });

  it('keeps the controls hidden when the family flag is turned off after migration', () => {
    seedRoutedCampaignSettings('ALPHA');
    process.env.NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE = 'false';
    render(<DmDashboardPage />);

    const card = campaignCard('ALPHA');
    expect(within(card).queryByLabelText(/banner/i)).not.toBeInTheDocument();
    expect(
      within(card).queryByRole('button', { name: /delete/i })
    ).not.toBeInTheDocument();
  });

  it('returns the controls for a campaign that was rolled back (legacy_restored)', () => {
    seedRolledBackCampaignSettings('ALPHA');
    render(<DmDashboardPage />);

    const card = campaignCard('ALPHA');
    expect(within(card).getByLabelText(/banner/i)).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: /delete/i })
    ).toBeInTheDocument();
  });

  it('leaves the controls of an unmigrated campaign exactly as they were', () => {
    seedRoutedCampaignSettings('ALPHA');
    render(<DmDashboardPage />);

    const card = campaignCard('BETA');
    expect(within(card).getByLabelText(/banner/i)).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: /delete/i })
    ).toBeInTheDocument();
  });
});
