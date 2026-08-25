import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  DurableFamilyAdapter,
  DurableFamilyName,
  FamilyManifestHandle,
  MigrationRunContext,
} from '@/lib/durableDm/durableFamilyAdapter';
import type { NormalizedAuthority } from '@/lib/durableDm/familyAuthorityNormalizer';
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
//
// Fix round 1, Important 2 (coordinator review): mocking only the BARREL
// module (`@/components/ui/campaign/NpcSyncControls`, etc.) is bypassable --
// mounting the SAME `NpcSyncProvider` via its deep module path
// (`.../NpcSyncControls/NpcSyncProvider`) left this suite green, because the
// deep module was never intercepted. Each REAL provider component is
// declared in exactly one deep module and the barrel only re-exports it, so
// mocking the deep module directly wraps the ONE shared implementation --
// the barrel's own (unmocked, real) re-export resolves through this same
// mock too, since ordinary imports inside a module fetched via
// `importOriginal` still go through the mocked module graph. This covers
// both the barrel and the deep import path with a single spy.
const npcProviderSpy = vi.fn();
const encounterProviderSpy = vi.fn();
const combatLogArchiveProviderSpy = vi.fn();

vi.mock(
  '@/components/ui/campaign/NpcSyncControls/NpcSyncProvider',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@/components/ui/campaign/NpcSyncControls/NpcSyncProvider')
      >();
    return {
      ...actual,
      NpcSyncProvider: (props: {
        campaignCode: string;
        children: ReactNode;
      }) => {
        npcProviderSpy();
        return actual.NpcSyncProvider(props);
      },
    };
  }
);
vi.mock(
  '@/components/ui/campaign/EncounterSyncControls/EncounterSyncProvider',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@/components/ui/campaign/EncounterSyncControls/EncounterSyncProvider')
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
  '@/components/ui/campaign/CombatLogArchiveSyncControls/CombatLogArchiveSyncProvider',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@/components/ui/campaign/CombatLogArchiveSyncControls/CombatLogArchiveSyncProvider')
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

  /**
   * THE pinned hazard (Task 14 carry-forward), covering BOTH reachable
   * "never confirmed this mount" shapes in one test:
   *
   * - Close clicked as the very first interaction (no `findMyCampaigns()`
   *   call at all -- a closed dialog on this route is a blank page either
   *   way, but which target is picked matters).
   * - A reload: a cutover happened in an EARLIER mount (a previous tab
   *   session, simulated by `cleanup()` + a fresh `renderRoute` re-wired to
   *   the SAME adapter instances -- same underlying "browser" state), and
   *   THIS mount's Close is clicked before it re-runs discovery itself.
   *
   * Fix round 1, Minor 4 (coordinator review): these were originally two
   * separate tests, but they are NOT independently discriminating -- a
   * fresh, never-discovered mount is the identical state either way (the
   * first mount + `cleanup()` cannot influence the second mount's own
   * state, which is what a real reload also does to React). Kept as ONE
   * test, documenting both scenarios, rather than two that always fail and
   * pass together. The genuinely discriminating twin -- asserting the
   * `{true,true}` -> `{false,false}` TRANSITION across the reload, which
   * this route-level test cannot see (it only observes the final
   * `router.replace` call) -- is
   * `MigrationWizard.test.tsx`'s `resets discoveryAttempted (and so cannot
   * be trusted) on a fresh mount, even though the underlying cutover
   * persists`.
   */
  it('replaces into the campaign route on close whenever discovery has not confirmed anything this mount, never routing to the dashboard on a stale false', async () => {
    const adapters = adaptersWithOneRouted();

    // Shape 1: Close as the very first interaction, no discovery attempted.
    wireAdapters(adapters);
    await renderRoute('ALPHA');
    await clickClose();
    expect(mockedReplace).toHaveBeenCalledWith('/dm/campaign/ALPHA');
    expect(mockedReplace).not.toHaveBeenCalledWith('/dm');
    mockedReplace.mockClear();
    cleanup();

    // Shape 2: a reload after an earlier mount DID observe the cutover.
    wireAdapters(adapters); // same underlying "browser" state persists
    await renderRoute('ALPHA');
    await findMyCampaigns();
    cleanup(); // simulate the reload: full unmount, all component state gone

    wireAdapters(adapters);
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

  /**
   * Fix round 2 (coordinator review, item 1): pins the reset half of
   * `discoveryAttempted`'s predicate, not just the tail-set half. "Find my
   * campaigns" (`WorkspaceStep.tsx`) renders unconditionally and is never
   * disabled after a successful discovery, and each click opens a fresh
   * workspace identity -- so a SECOND discovery, still in flight when Close
   * is clicked, must not be masked by the FIRST discovery's already-completed
   * `discoveryAttempted: true`. Without the reset in the scan effect, this
   * reaches the R2a hazard verbatim: `/dm` instead of the campaign route.
   */
  it('resets discoveryAttempted on a second discovery, so a stale true from the first scan does not mask a still-pending second scan', async () => {
    let npcCallCount = 0;
    let resolveSecondScan: (value: NormalizedAuthority) => void = () => {};
    const legacyAuthority: NormalizedAuthority = {
      state: 'legacy',
      epoch: 0,
      campaignId: null,
      accountId: null,
      rolledBack: false,
    };
    const npcAdapter: DurableFamilyAdapter = {
      ...stubAdapter('npc', false),
      readAuthority: async () => {
        npcCallCount += 1;
        if (npcCallCount === 1) return legacyAuthority;
        // Second (and any later) scan: held pending deliberately -- resolved
        // only after the assertion below, so nothing leaks as an unhandled
        // rejection into a later test.
        return new Promise<NormalizedAuthority>(resolve => {
          resolveSecondScan = resolve;
        });
      },
    };
    const adapters = ALL_FAMILIES.map(family =>
      family === 'npc' ? npcAdapter : stubAdapter(family, false)
    );
    wireAdapters(adapters);
    await renderRoute('ALPHA');
    await findMyCampaigns(); // first discovery: scan completes, nothing routed

    // Second discovery: re-click "Find my campaigns" -- opens a fresh
    // workspace identity (`list()` is re-invoked and builds a fresh
    // `workspaceFor('ALPHA')` object each call) and re-runs the scan effect,
    // this time with npc's `readAuthority` held pending.
    await userEvent.click(
      screen.getByRole('button', { name: /find my campaigns/i })
    );
    await waitFor(() => expect(npcCallCount).toBeGreaterThanOrEqual(2));

    await clickClose();
    expect(mockedReplace).toHaveBeenCalledWith('/dm/campaign/ALPHA');
    expect(mockedReplace).not.toHaveBeenCalledWith('/dm');

    resolveSecondScan(legacyAuthority);
  });
});
