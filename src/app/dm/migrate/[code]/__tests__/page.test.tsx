import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  DurableFamilyAdapter,
  DurableFamilyName,
  FamilyManifestHandle,
  MigrationRunContext,
} from '@/lib/durableDm/durableFamilyAdapter';
import {
  registeredAdapters,
  enabledAdapters,
} from '@/lib/durableDm/familyRegistry';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import { createBrowserDmWorkspace } from '@/lib/supabase/browserDmWorkspace';

/**
 * Spec R2a / Task 17. `MigrationWizardPage` is an async Server Component
 * (Next.js 16 -- `params` is a `Promise`, and it must be an `async function`
 * for `notFound()` to reject the returned promise rather than throwing
 * synchronously into a caller that isn't expecting it -- see
 * `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md`).
 * React does not support client-rendering an async component via
 * `ReactDOM.render`/`createRoot` outside the RSC pipeline, so it cannot be
 * mounted with `render(<MigrationWizardPage .../>)` the way a normal
 * component would be. It is called directly as the plain async function it
 * is; the JSX it resolves to (or the rejection `notFound()` produces) is
 * exactly what a real Next.js request would receive.
 */
import MigrationWizardPage from '../page';

const mockedReplace = vi.fn();
const mockedPush = vi.fn();

vi.mock('next/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    // `notFound` is left as the REAL implementation (see `not-found.md`):
    // it is a pure function that throws an Error carrying
    // `digest: 'NEXT_HTTP_ERROR_FALLBACK;404'`, and needs no test double.
    useRouter: () => ({ replace: mockedReplace, push: mockedPush }),
  };
});

vi.mock('@/lib/supabase/browserDmWorkspace', () => ({
  createBrowserDmWorkspace: vi.fn(),
}));

vi.mock('@/lib/durableDm/familyRegistry', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/lib/durableDm/familyRegistry')>();
  return {
    ...actual,
    registeredAdapters: vi.fn(actual.registeredAdapters),
    enabledAdapters: vi.fn(actual.enabledAdapters),
  };
});

// R6.7: the "mounts no durable family sync provider" claim is guaranteed by
// this route living outside `src/app/dm/campaign/[code]/layout.tsx` (see the
// dedicated structural test below), which makes it weak by nature -- an
// empty page would pass it too. Strengthened here with a REAL render-time
// assertion: every provider the campaign route group mounts is wrapped so a
// call is recorded, and the route's full render (through to a family step)
// must never trigger one.
const npcProviderSpy = vi.fn();
const encounterProviderSpy = vi.fn();
const combatLogArchiveProviderSpy = vi.fn();

vi.mock('@/components/ui/campaign/NpcSyncControls', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('@/components/ui/campaign/NpcSyncControls')
    >();
  return {
    ...actual,
    NpcSyncProvider: (props: { campaignCode: string; children: ReactNode }) => {
      npcProviderSpy();
      return actual.NpcSyncProvider(props);
    },
  };
});
vi.mock(
  '@/components/ui/campaign/EncounterSyncControls',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@/components/ui/campaign/EncounterSyncControls')
      >();
    return {
      ...actual,
      EncounterSyncProvider: (props: {
        campaignCode: string;
        children: ReactNode;
      }) => {
        encounterProviderSpy();
        return actual.EncounterSyncProvider(props);
      },
    };
  }
);
vi.mock(
  '@/components/ui/campaign/CombatLogArchiveSyncControls',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@/components/ui/campaign/CombatLogArchiveSyncControls')
      >();
    return {
      ...actual,
      CombatLogArchiveSyncProvider: (props: {
        campaignCode: string;
        children: ReactNode;
      }) => {
        combatLogArchiveProviderSpy();
        return actual.CombatLogArchiveSyncProvider(props);
      },
    };
  }
);

const mockedCreateBrowserDmWorkspace = vi.mocked(createBrowserDmWorkspace);
const mockedRegisteredAdapters = vi.mocked(registeredAdapters);
const mockedEnabledAdapters = vi.mocked(enabledAdapters);

const FIXED_TS = '2026-08-24T00:00:00.000Z';

function defaultOwnerContext(accountId = 'account-1') {
  return {
    accountId,
    accountLabel: 'Owner',
    list: vi.fn(async (): Promise<DmWorkspaceDocument[]> => []),
    discover: vi.fn(async (): Promise<DmWorkspaceDocument[]> => []),
    remember: vi.fn(async (): Promise<void> => {}),
    create: vi.fn(),
    forkLegacy: vi.fn(),
    close: vi.fn(),
  };
}

function workspaceFor(code: string): DmWorkspaceDocument {
  return {
    namespace: 'user:account-1' as const,
    localId: `legacy:${code}`,
    legacyId: `legacy:${code}`,
    name: `Campaign ${code}`,
    creationKind: 'import_fork',
    sourceFingerprint: 'source',
    createdAt: FIXED_TS,
    family: 'workspace_identity',
    cloudId: `cloud-${code}`,
    displayCode: 'A1B2C3D4E5F6',
    membershipAuthority: 'legacy',
    familyAuthorities: 'legacy',
    liveRuntimeAuthority: 'redis_relay',
    acknowledgedAt: null,
  };
}

const ALL_FAMILIES: DurableFamilyName[] = [
  'campaign_settings',
  'calendar',
  'magic_item',
  'npc',
  'encounter_definition',
  'combat_log_archive',
];

/** A minimal stub -- only `family`, `label`, `isVisible` and `readAuthority` are ever exercised by these route-level tests. */
function stubAdapter(
  family: DurableFamilyName,
  routed: boolean
): DurableFamilyAdapter {
  const manifest: FamilyManifestHandle = {
    family,
    fingerprint: `${family}-fingerprint`,
    recordCount: 0,
    totalBytes: 0,
    blockers: [],
    records: [],
    native: null,
  };
  return {
    family,
    label: family,
    isVisible: () => true,
    previewManifest: async () => manifest,
    confirmation: () => ({
      familyLabel: family,
      campaignLabel: 'Campaign',
      manifestFingerprint: manifest.fingerprint,
      requiredPhrase: `move ${family}`,
    }),
    selectFamily: async () => {},
    prepareIndexedDb: async () => ({
      state: 'CUTOVER_READY',
      generation: 'gen-1',
      manifest,
    }),
    commitLocalCutover: async () => ({ epoch: 1 }),
    activateCloud: async () => ({ status: 'activated' as const, epoch: 1 }),
    verifyCloud: async () => ({
      authorityAgrees: true,
      cloudAuthority: routed ? 'postgres' : 'legacy',
      epoch: 1,
      recordCount: 0,
      documentsMatch: true,
      tombstonesMatch: true,
      outboxEmpty: true,
      conflictCount: 0,
      verified: routed,
    }),
    readAuthority: async () =>
      routed
        ? {
            state: 'postgres',
            epoch: 1,
            campaignId: 'cloud-ALPHA',
            accountId: 'account-1',
            rolledBack: false,
          }
        : {
            state: 'legacy',
            epoch: 0,
            campaignId: null,
            accountId: null,
            rolledBack: false,
          },
    rollback: async () => ({ epoch: 2 }),
    repairAuthority: async function (this: DurableFamilyAdapter) {
      return this.readAuthority({} as MigrationRunContext);
    },
  };
}

/** All six registered families, exactly one (`npc` by default) reporting a completed cutover. */
function adaptersWithOneRouted(
  routedFamily: DurableFamilyName = 'npc'
): DurableFamilyAdapter[] {
  return ALL_FAMILIES.map(family =>
    stubAdapter(family, family === routedFamily)
  );
}

function wireAdapters(adapters: DurableFamilyAdapter[]) {
  mockedRegisteredAdapters.mockReturnValue(adapters);
  mockedEnabledAdapters.mockImplementation(() =>
    mockedRegisteredAdapters().filter(adapter => adapter.isVisible())
  );
  mockedCreateBrowserDmWorkspace.mockResolvedValue({
    ...defaultOwnerContext(),
    list: vi.fn(async () => [workspaceFor('ALPHA')]),
  });
}

async function renderRoute(code: string) {
  const element = await MigrationWizardPage({
    params: Promise.resolve({ code }),
  });
  return render(element);
}

async function findMyCampaigns() {
  await userEvent.click(
    screen.getByRole('button', { name: /find my campaigns/i })
  );
  await screen.findByText(/connected to campaign alpha/i);
}

/** Renders, then runs discovery -- the run this mount actually observed a cutover in. */
async function renderRouteAfterCutover(code: string) {
  wireAdapters(adaptersWithOneRouted());
  await renderRoute(code);
  await findMyCampaigns();
}

async function clickClose() {
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE = 'true';
  mockedCreateBrowserDmWorkspace.mockReset();
  mockedRegisteredAdapters.mockReset();
  mockedRegisteredAdapters.mockReturnValue([]);
  mockedEnabledAdapters.mockReset();
  mockedEnabledAdapters.mockReturnValue([]);
  mockedReplace.mockClear();
  mockedPush.mockClear();
  npcProviderSpy.mockClear();
  encounterProviderSpy.mockClear();
  combatLogArchiveProviderSpy.mockClear();
});

afterEach(() => {
  cleanup();
  delete process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE;
});

describe('/dm/migrate/[code]', () => {
  it('is a 404 while the flag is off, even by direct navigation', async () => {
    process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE = 'false';
    // `notFound()` THROWS (it does not return a `{ notFound: true }` value
    // of any kind) -- inside this `async function` page, that throw rejects
    // the returned promise with an Error carrying Next's own 404 digest.
    await expect(
      MigrationWizardPage({ params: Promise.resolve({ code: 'ALPHA' }) })
    ).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
  });

  it('renders the wizard while the flag is on, independently of the dashboard launcher', async () => {
    await renderRoute('ALPHA');
    expect(
      screen.getByText('Move campaign data to cloud sync')
    ).toBeInTheDocument();
  });

  it('lives outside the campaign route group (structural, R6.7)', () => {
    const pagePath = path.resolve(
      process.cwd(),
      'src/app/dm/migrate/[code]/page.tsx'
    );
    expect(fs.existsSync(pagePath)).toBe(true);
    expect(pagePath.split(path.sep)).not.toContain('campaign');
    expect(pagePath.replace(/\\/g, '/')).toMatch(
      /\/dm\/migrate\/\[code\]\/page\.tsx$/
    );
    // And the campaign route group's OWN layout must not exist at the
    // mirror-image path -- i.e. this really is a sibling of, not nested
    // under, `dm/campaign/[code]`.
    expect(
      fs.existsSync(
        path.resolve(process.cwd(), 'src/app/dm/campaign/[code]/migrate.tsx')
      )
    ).toBe(false);
  });

  it('mounts no durable family sync provider, confirmed by render through a family step', async () => {
    wireAdapters(adaptersWithOneRouted('campaign_settings'));
    await renderRoute('ALPHA');
    await findMyCampaigns();
    // Advance past the intro so a family step (and its adapter-backed
    // content) actually renders -- the strongest render this suite can do
    // without reproducing the wizard's own harness.
    await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(npcProviderSpy).not.toHaveBeenCalled();
    expect(encounterProviderSpy).not.toHaveBeenCalled();
    expect(combatLogArchiveProviderSpy).not.toHaveBeenCalled();
  });

  it('replaces into the campaign route on close once anything was cut over', async () => {
    await renderRouteAfterCutover('ALPHA');
    await clickClose();
    expect(mockedReplace).toHaveBeenCalledWith('/dm/campaign/ALPHA');
  });

  it('returns to the dashboard when discovery ran and found nothing cut over', async () => {
    wireAdapters(
      adaptersWithOneRouted('npc').map(adapter =>
        // no family routed at all this time
        stubAdapter(adapter.family, false)
      )
    );
    await renderRoute('ALPHA');
    await findMyCampaigns();
    await clickClose();
    expect(mockedReplace).toHaveBeenCalledWith('/dm');
  });

  it('does NOT route to the dashboard on close before discovery has ever run this mount', async () => {
    // No `findMyCampaigns()` call -- Close is the very first interaction.
    // A closed dialog on this route is a blank page either way, but which
    // target is picked matters: routing to `/dm` here would be the R2a
    // hazard (a stale `false` mistaken for "definitely nothing cut over").
    wireAdapters(adaptersWithOneRouted());
    await renderRoute('ALPHA');
    await clickClose();
    expect(mockedReplace).toHaveBeenCalledWith('/dm/campaign/ALPHA');
    expect(mockedReplace).not.toHaveBeenCalledWith('/dm');
  });

  /**
   * THE pinned hazard (Task 14 carry-forward): a cutover happened in an
   * earlier mount (a previous tab session), so it is on record in this
   * "browser"'s adapter authority -- but a reload resets ALL React state,
   * and this fresh mount's Close is clicked before it re-runs discovery
   * itself. `anyCutoverCommitted` alone reads `false` here (nothing
   * observed THIS mount) -- indistinguishable, by that field alone, from a
   * campaign that was genuinely never touched. Routing to `/dm` on that
   * stale `false` would land the DM on editable campaign UI with no fresh
   * durable-family owner mounted, which is exactly what R2a exists to
   * prevent. The route must route conservatively to the campaign page
   * instead.
   */
  it('replaces into the campaign route on close after a real cutover even when discovery has not re-run this mount', async () => {
    const adapters = adaptersWithOneRouted();
    wireAdapters(adapters);
    await renderRoute('ALPHA');
    await findMyCampaigns();
    cleanup(); // simulate a reload: full unmount, all component state gone

    wireAdapters(adapters); // same underlying "browser" state persists
    await renderRoute('ALPHA'); // fresh mount -- no rediscovery click
    await clickClose();
    expect(mockedReplace).toHaveBeenCalledWith('/dm/campaign/ALPHA');
    expect(mockedReplace).not.toHaveBeenCalledWith('/dm');
  });

  it('reopens and re-derives progress after a reload', async () => {
    await renderRouteAfterCutover('ALPHA');
    cleanup();
    wireAdapters(adaptersWithOneRouted());
    await renderRoute('ALPHA');
    await findMyCampaigns();
    expect(await screen.findByText(/1 of 6/)).toBeInTheDocument();
  });
});
