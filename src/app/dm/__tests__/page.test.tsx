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

/**
 * Fix round 1, Important 1 (coordinator review): the real `BannerUpload`
 * `variant="card"` is display-only and never invokes `onBannerChange`, so a
 * DOM-only test cannot observe whether a routed campaign's write path is
 * wired to the live `updateCampaign` callback or a structural no-op. This
 * mock exposes a trigger button that calls whatever `onBannerChange` the
 * dashboard actually passed down, so tests can click it and assert on
 * `rollkeeper-dm-data` directly -- proving the wiring itself, not just
 * today's incidental lack of a clickable affordance.
 */
vi.mock('@/components/ui/campaign/BannerUpload', () => ({
  BannerUpload: ({
    campaignCode,
    bannerUrl,
    onBannerChange,
  }: {
    campaignCode: string;
    bannerUrl?: string;
    onBannerChange: (url: string | undefined) => void;
  }) => (
    <div data-testid={`banner-upload-mock-${campaignCode}`}>
      <span data-testid={`banner-url-${campaignCode}`}>{bannerUrl ?? ''}</span>
      <button
        type="button"
        data-testid={`banner-upload-trigger-${campaignCode}`}
        onClick={() => onBannerChange('https://example.test/new-banner.png')}
      >
        mock upload trigger
      </button>
    </div>
  ),
}));

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

  /**
   * Fix round 1, Minor 5 (coordinator review): the launcher's copy read
   * (`campaignSettingsRoutedForLauncherCopy`) is deliberately a SEPARATE
   * local from R2b's flag-independent `campaignSettingsRouted` -- it is
   * legitimately allowed to fall back to "not yet migrated" copy while the
   * `campaign_settings` client flag is off, even for an actually-routed
   * campaign. Without this test, collapsing the two locals into one (using
   * the flag-independent `routed` for the launcher too) passes every other
   * test in this file, because the other launcher tests only exercise the
   * flag-on case where the two locals coincide.
   */
  it('shows Move campaign data to cloud sync copy for an already-routed campaign while the campaign_settings client flag is off', () => {
    process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE = 'true';
    // NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE deliberately left unset.
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
      screen.getByRole('link', { name: /move campaign data to cloud sync/i })
    ).toHaveAttribute('href', '/dm/migrate/ALPHA');
    expect(
      screen.queryByRole('link', { name: /review cloud sync/i })
    ).not.toBeInTheDocument();
  });
});

/**
 * Spec R2b: once a campaign's `campaign_settings` family is routed off
 * legacy (authority `indexedDB` or `postgres`), `/dm` must not offer a
 * *live* banner write or a legacy delete for that campaign -- both write
 * through `rollkeeper-dm-data`, which `createCampaignSettingsAwareDmStorage`
 * either silently reverts (banner) or which orphans IndexedDB/Postgres data
 * no longer reachable from legacy (delete). The routed check MUST be read
 * directly from the marker in localStorage, independent of the
 * `NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE` client flag -- R8.3.
 *
 * Fix round 1, Important 1 (coordinator review): the banner image itself
 * keeps rendering for every campaign, routed or not -- `BannerUpload`
 * `variant="card"` is display-only today, so hiding the whole region closed
 * no reachable write and only regressed what a DM sees. What must be
 * disproven for a routed campaign is that the *callback* is wired to a real
 * write, which is why every banner assertion below goes through the mocked
 * trigger button rather than DOM presence/absence.
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

  it('still displays the banner image for a campaign whose settings are routed', () => {
    seedRoutedCampaignSettings('ALPHA');
    useDmStore.setState(state => ({
      campaigns: state.campaigns.map(c =>
        c.code === 'ALPHA'
          ? { ...c, bannerUrl: 'https://example.test/alpha-current.png' }
          : c
      ),
    }));

    render(<DmDashboardPage />);

    expect(
      within(campaignCard('ALPHA')).getByTestId('banner-url-ALPHA')
    ).toHaveTextContent('https://example.test/alpha-current.png');
  });

  it('does not wire a live banner write for a campaign whose settings are routed', async () => {
    seedRoutedCampaignSettings('ALPHA');
    const before = localStorage.getItem('rollkeeper-dm-data');

    render(<DmDashboardPage />);
    await userEvent.click(
      within(campaignCard('ALPHA')).getByTestId('banner-upload-trigger-ALPHA')
    );

    expect(localStorage.getItem('rollkeeper-dm-data')).toBe(before);
  });

  /**
   * Fix round 1, Minor 3 (coordinator review): the dashboard's routed check
   * must apply the SAME shape validation as
   * `readCampaignSettingsProjectionAuthority` (via the shared
   * `parseProjectionAuthorityMarker`), not a looser hand-rolled check. A
   * marker with an unrecognized `version` is invalid everywhere else in the
   * codebase and must not be treated as routed here either -- otherwise the
   * dashboard could show "Synced" and hide delete for a campaign every
   * other reader still treats as legacy.
   */
  it('does not treat a marker with an unrecognized version as routed', () => {
    localStorage.setItem(
      campaignSettingsProjectionAuthorityKey('ALPHA'),
      JSON.stringify({
        version: 2,
        authority: 'indexedDB',
        epoch: 1,
        campaignId: 'cloud-ALPHA',
      })
    );

    render(<DmDashboardPage />);

    const card = campaignCard('ALPHA');
    expect(within(card).queryByText(/^synced$/i)).not.toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: /delete/i })
    ).toBeInTheDocument();
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

  it('links into the campaign-owned UI instead, via an outline Manage link (not secondary)', () => {
    seedRoutedCampaignSettings('ALPHA');
    render(<DmDashboardPage />);

    const manageLink = within(campaignCard('ALPHA')).getByRole('link', {
      name: /^manage$/i,
    });
    expect(manageLink).toHaveAttribute('href', '/dm/campaign/ALPHA');

    const manageButton = manageLink.querySelector('button');
    expect(manageButton).not.toBeNull();
    // `outline` and `secondary` are visually distinct Button variants
    // (src/components/ui/primitives/variants.ts); pin the outline-specific
    // border class and rule out the secondary-specific gradient class, so a
    // silent variant flip is caught even though both variants render as a
    // `<button>` with the same accessible name.
    expect(manageButton).toHaveClass('border-divider');
    expect(manageButton).not.toHaveClass('from-blue-600');
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
    // either state, so pin the ABSENCE of the unsafe delete control too,
    // not just that clicking the card is a no-op.
    expect(
      within(card).queryByRole('button', { name: /delete/i })
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(card).getByRole('link', { name: /^manage$/i })
    );
    await userEvent.click(
      within(card).getByTestId('banner-upload-trigger-ALPHA')
    );
    expect(localStorage.getItem('rollkeeper-dm-data')).toBe(before);
  });

  it('keeps the delete control hidden and the banner write inert when the family flag is turned off after migration', async () => {
    seedRoutedCampaignSettings('ALPHA');
    process.env.NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE = 'false';
    const before = localStorage.getItem('rollkeeper-dm-data');

    render(<DmDashboardPage />);

    const card = campaignCard('ALPHA');
    expect(
      within(card).queryByRole('button', { name: /delete/i })
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(card).getByTestId('banner-upload-trigger-ALPHA')
    );
    expect(localStorage.getItem('rollkeeper-dm-data')).toBe(before);
  });

  it('returns the controls for a campaign that was rolled back (legacy_restored)', async () => {
    seedRolledBackCampaignSettings('ALPHA');
    render(<DmDashboardPage />);

    const card = campaignCard('ALPHA');
    expect(
      within(card).getByRole('button', { name: /delete/i })
    ).toBeInTheDocument();
    expect(within(card).queryByText(/^synced$/i)).not.toBeInTheDocument();
    expect(
      within(card).getByRole('link', { name: /^open campaign$/i })
    ).toBeInTheDocument();

    // The banner write is live again after rollback.
    await userEvent.click(
      within(card).getByTestId('banner-upload-trigger-ALPHA')
    );
    expect(
      useDmStore.getState().campaigns.find(c => c.code === 'ALPHA')?.bannerUrl
    ).toBe('https://example.test/new-banner.png');
  });

  it('leaves the controls of an unmigrated campaign exactly as they were', async () => {
    seedRoutedCampaignSettings('ALPHA');
    render(<DmDashboardPage />);

    const card = campaignCard('BETA');
    expect(
      within(card).getByRole('button', { name: /delete/i })
    ).toBeInTheDocument();
    // Fix round 1, Important 2: an unmigrated campaign must not pick up
    // either the "Synced" badge (a false cloud-safety claim) or lose its
    // "Open Campaign" label to "Manage".
    expect(within(card).queryByText(/^synced$/i)).not.toBeInTheDocument();
    expect(
      within(card).getByRole('link', { name: /^open campaign$/i })
    ).toBeInTheDocument();

    // The banner write is live for an unmigrated campaign.
    await userEvent.click(
      within(card).getByTestId('banner-upload-trigger-BETA')
    );
    expect(
      useDmStore.getState().campaigns.find(c => c.code === 'BETA')?.bannerUrl
    ).toBe('https://example.test/new-banner.png');
  });
});
