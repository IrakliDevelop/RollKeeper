import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import { useDmStore } from '@/store/dmStore';
import {
  campaignSettingsProjectionAuthorityKey,
  type ProjectionAuthorityMarker,
} from '@/lib/durableDm/campaignSettingsLegacyProjection';

import {
  clickConfirmDialogButton,
  findConfirmDialog,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';

import DmDashboardPage from '../page';

// The real `next/image` rejects hosts that aren't configured in
// `next.config`, which jsdom tests don't load; stand in a plain <img>.
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const rest = { ...props };
    delete rest.fill;
    delete rest.priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
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

  it('shows Back up campaign online only while the wizard flag is on', () => {
    process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE = 'false';
    const { rerender } = render(<DmDashboardPage />);
    expect(
      screen.queryByRole('link', { name: /back up campaign online/i })
    ).not.toBeInTheDocument();

    process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE = 'true';
    rerender(<DmDashboardPage />);
    expect(
      screen.getByRole('link', { name: /back up campaign online/i })
    ).toHaveAttribute('href', '/dm/migrate/ALPHA');
  });

  it('shows Review online backup, not Back up campaign online, once campaign_settings is already routed', () => {
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
      screen.getByRole('link', { name: /review online backup/i })
    ).toHaveAttribute('href', '/dm/migrate/ALPHA');
    expect(
      screen.queryByRole('link', { name: /back up campaign online/i })
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
      name: /back up campaign online/i,
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
  it('shows Back up campaign online copy for an already-routed campaign while the campaign_settings client flag is off', () => {
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
      screen.getByRole('link', { name: /back up campaign online/i })
    ).toHaveAttribute('href', '/dm/migrate/ALPHA');
    expect(
      screen.queryByRole('link', { name: /review online backup/i })
    ).not.toBeInTheDocument();
  });
});

/**
 * Spec R2b: once a campaign's `campaign_settings` family is routed off
 * legacy (authority `indexedDB` or `postgres`), `/dm` must not offer a
 * legacy delete for that campaign -- it writes through
 * `rollkeeper-dm-data` and orphans IndexedDB/Postgres data no longer
 * reachable from legacy. The routed check MUST be read directly from the
 * marker in localStorage, independent of the
 * `NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE` client flag -- R8.3.
 *
 * The dashboard offers no banner upload for any campaign (banners are set
 * on the campaign page), so there is no banner write path here to guard;
 * the banner image itself still renders for every campaign that has one.
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

    expect(campaignCard('ALPHA').querySelector('img')).not.toBeNull();
  });

  it('offers no banner upload on the dashboard', () => {
    seedRoutedCampaignSettings('ALPHA');
    render(<DmDashboardPage />);

    for (const code of ['ALPHA', 'BETA']) {
      const card = campaignCard(code);
      expect(card.querySelector('input[type="file"]')).toBeNull();
      expect(within(card).queryByText(/banner/i)).toBeNull();
    }
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
    // Pin the variant through Button's data-variant attribute (asChild puts
    // it on the link itself), so a silent variant flip is caught even though
    // both variants render with the same accessible name.
    expect(manageLink).toHaveAttribute('data-variant', 'outline');
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
    expect(localStorage.getItem('rollkeeper-dm-data')).toBe(before);
  });

  it('keeps the delete control hidden when the family flag is turned off after migration', () => {
    seedRoutedCampaignSettings('ALPHA');
    process.env.NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE = 'false';
    const before = localStorage.getItem('rollkeeper-dm-data');

    render(<DmDashboardPage />);

    const card = campaignCard('ALPHA');
    expect(
      within(card).queryByRole('button', { name: /delete/i })
    ).not.toBeInTheDocument();
    expect(localStorage.getItem('rollkeeper-dm-data')).toBe(before);
  });

  it('returns the controls for a campaign that was rolled back (legacy_restored)', () => {
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
  });

  it('leaves the controls of an unmigrated campaign exactly as they were', () => {
    seedRoutedCampaignSettings('ALPHA');
    render(<DmDashboardPage />);

    const card = campaignCard('BETA');
    expect(
      within(card).getByRole('button', { name: /delete/i })
    ).toBeInTheDocument();
    // Fix round 1, Important 2: an unmigrated campaign must not pick up
    // either the "Synced" badge (a false cloud-safety claim) or lose its
    // "Open campaign" label to "Manage".
    expect(within(card).queryByText(/^synced$/i)).not.toBeInTheDocument();
    expect(
      within(card).getByRole('link', { name: /^open campaign$/i })
    ).toBeInTheDocument();
  });
});

describe('DmDashboardPage — layout', () => {
  beforeEach(() => {
    useCharacterStore.setState({ hasHydrated: true });
    useDmStore.setState({
      dmId: 'dm-local',
      campaigns: [
        {
          code: 'ALPHA',
          name: 'Alpha Campaign',
          createdAt: '2026-08-24T00:00:00.000Z',
          bannerUrl: 'https://example.test/alpha.png',
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
    localStorage.clear();
  });

  it('titles the page Campaigns', () => {
    render(<DmDashboardPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Campaigns' })
    ).toBeInTheDocument();
  });

  it('has one primary Create campaign button and a pluralised summary', () => {
    render(<DmDashboardPage />);
    const create = screen.getAllByRole('button', { name: 'Create campaign' });
    expect(create).toHaveLength(1);
    expect(create[0]).toHaveAttribute('data-variant', 'primary');
    expect(
      screen.getByText('2 campaigns · 0 players connected')
    ).toBeInTheDocument();
  });

  it('uses singular nouns for one campaign and one player', async () => {
    useDmStore.setState({
      campaigns: [
        {
          code: 'ALPHA',
          name: 'Alpha Campaign',
          createdAt: '2026-08-24T00:00:00.000Z',
        },
      ],
    });
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ players: [{}] }),
    } as Response);
    render(<DmDashboardPage />);
    expect(
      await screen.findByText('1 campaign · 1 player connected')
    ).toBeInTheDocument();
  });

  it('shows the empty state with its own Create campaign button', () => {
    useDmStore.setState({ campaigns: [] });
    render(<DmDashboardPage />);
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Create your first campaign',
      })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Create campaign' })
    ).toHaveLength(1);
    expect(
      screen.getByText(
        'Players join with the campaign code, and their characters appear on the campaign page.'
      )
    ).toBeInTheDocument();
  });

  it('shows a banner only for campaigns that have one', () => {
    render(<DmDashboardPage />);
    expect(campaignCard('ALPHA').querySelector('img')).not.toBeNull();
    expect(campaignCard('BETA').querySelector('img')).toBeNull();
  });

  it('names the icon actions after the campaign', () => {
    render(<DmDashboardPage />);
    const card = within(campaignCard('BETA'));
    expect(
      card.getByRole('button', { name: 'Export Beta Campaign' })
    ).toBeInTheDocument();
    expect(
      card.getByRole('button', { name: 'Delete Beta Campaign' })
    ).toHaveAttribute('data-variant', 'danger');
    expect(
      card.getByRole('button', { name: 'Copy code BETA' })
    ).toBeInTheDocument();
  });

  it('describes each Open campaign link by its card heading', () => {
    render(<DmDashboardPage />);
    const links = screen.getAllByRole('link', { name: 'Open campaign' });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAccessibleDescription('Alpha Campaign');
    expect(links[1]).toHaveAccessibleDescription('Beta Campaign');
  });
});

describe('DmDashboardPage — deleting a campaign', () => {
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
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null));
    delete process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE;
    delete process.env.NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('deletes only after the destructive confirm', async () => {
    renderConfirmDialogHost();
    render(<DmDashboardPage />);
    const deleteButton = () =>
      within(campaignCard('ALPHA')).getByRole('button', { name: /delete/i });

    await userEvent.setup().click(deleteButton());
    const dialog = await findConfirmDialog();
    expect(dialog).toHaveAttribute('role', 'alertdialog');
    expect(dialog).toHaveAccessibleName('Delete Canary?');
    await clickConfirmDialogButton('Cancel');
    expect(useDmStore.getState().campaigns).toHaveLength(1);
    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      '/api/campaign/ALPHA',
      expect.anything()
    );

    await userEvent.setup().click(deleteButton());
    await clickConfirmDialogButton('Delete campaign');
    await waitFor(() =>
      expect(useDmStore.getState().campaigns).toHaveLength(0)
    );
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/campaign/ALPHA', {
      method: 'DELETE',
    });
  });
});
