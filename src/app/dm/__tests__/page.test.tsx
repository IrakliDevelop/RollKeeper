import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import { useDmStore } from '@/store/dmStore';
import {
  campaignSettingsProjectionAuthorityKey,
  type ProjectionAuthorityMarker,
} from '@/lib/durableDm/campaignSettingsLegacyProjection';

import DmDashboardPage from '../page';

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
