import 'fake-indexeddb/auto';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  calendarPayloadFromCampaignCalendar,
  fingerprintCalendarPayload,
  type CalendarPayload,
} from '@/lib/durableDm/calendarFamily';
import { writeCalendarProjectionAuthority } from '@/lib/durableDm/calendarLegacyProjection';
import { commitCalendarLocalCutover } from '@/lib/indexeddb/calendarAuthority';
import { IndexedDbCalendarRepository } from '@/lib/indexeddb/calendarRepository';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import * as localDatabase from '@/lib/indexeddb/localDatabase';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import * as supabaseBrowser from '@/lib/supabase/browser';
import * as browserDmWorkspace from '@/lib/supabase/browserDmWorkspace';
import { useCalendarStore } from '@/store/calendarStore';
import type { CalendarConfig, CampaignCalendar } from '@/types/calendar';

import { CalendarSyncControls } from './CalendarSyncControls';

const NOW = '2026-08-22T00:00:00.000Z';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222';
const NAMESPACE = `user:${ACCOUNT_ID}` as const;
const GENERATION = 'calendar-generation';

const campaign = { code: 'SYNTH1', name: 'Calendar', createdAt: 'now' };

const gates = {
  recoveryReceipt: true,
  sourceManifestUnchanged: true,
  captureVerifiedAfterReopen: true,
  manifestConfirmed: true,
  noConflicts: true,
  noQuarantine: true,
  parity: true,
  journalEmpty: true,
};

const workspace = {
  namespace: NAMESPACE,
  localId: 'legacy:SYNTH1',
  legacyId: 'SYNTH1',
  name: 'Calendar',
  creationKind: 'import_fork' as const,
  sourceFingerprint: 'source',
  createdAt: 'created',
  family: 'workspace_identity' as const,
  cloudId: CAMPAIGN_ID,
  displayCode: 'A1B2C3D4E5F6',
  membershipAuthority: 'legacy' as const,
  familyAuthorities: 'legacy' as const,
  liveRuntimeAuthority: 'redis_relay' as const,
  acknowledgedAt: 'acknowledged',
};

function mockOwnerWorkspace() {
  vi.spyOn(browserDmWorkspace, 'createBrowserDmWorkspace').mockResolvedValue({
    accountId: ACCOUNT_ID,
    accountLabel: 'fake@example.test',
    list: vi.fn().mockResolvedValue([]),
    discover: vi.fn().mockResolvedValue([workspace]),
    remember: vi.fn(),
    create: vi.fn(),
    forkLegacy: vi.fn(),
    close: vi.fn(),
  });
}

/**
 * Faithful stand-in for the repository-backed context: `discover` returns the
 * cloud-side workspaces, but `list` returns only what was explicitly
 * `remember`ed — which is what a reload's hydrate() reads.
 */
function mockOwnerWorkspaceWithMemory() {
  const remembered: DmWorkspaceDocument[] = [];
  vi.spyOn(browserDmWorkspace, 'createBrowserDmWorkspace').mockImplementation(
    async () => ({
      accountId: ACCOUNT_ID,
      accountLabel: 'fake@example.test',
      list: vi.fn().mockImplementation(async () => [...remembered]),
      discover: vi.fn().mockResolvedValue([workspace]),
      remember: vi
        .fn()
        .mockImplementation(async (item: DmWorkspaceDocument) => {
          if (!remembered.some(known => known.cloudId === item.cloudId))
            remembered.push(item);
        }),
      create: vi.fn(),
      forkLegacy: vi.fn(),
      close: vi.fn(),
    })
  );
  return remembered;
}

function mockOwnerSession() {
  vi.spyOn(supabaseBrowser, 'createSupabaseBrowserClient').mockReturnValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: ACCOUNT_ID } } },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  } as never);
}

type AuthListener = (event: string, session: unknown) => void;

/**
 * Same owner session, but the controller's `onAuthStateChange` listener is
 * captured so a case can replay a Supabase event (TOKEN_REFRESHED fires
 * hourly, and whenever a hidden tab's token expired).
 */
function mockOwnerSessionCapturingListener() {
  let listener: AuthListener | null = null;
  vi.spyOn(supabaseBrowser, 'createSupabaseBrowserClient').mockReturnValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: ACCOUNT_ID } } },
      }),
      onAuthStateChange: vi
        .fn()
        .mockImplementation((callback: AuthListener) => {
          listener = callback;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
    },
  } as never);
  return (event: string, session: unknown) => {
    if (!listener) throw new Error('The controller never subscribed to auth');
    listener(event, session);
  };
}

function calendarConfig(): CalendarConfig {
  return {
    clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
    weekDays: [{ name: 'Firstday' }],
    months: [{ name: 'Dawn', days: 30 }],
    seasons: [],
    moons: [],
    namedYears: [],
    eras: [],
    yearOffset: 0,
    yearStartWeekdayOffset: 0,
    mechanics: {
      hoursPerLongRest: 8,
      minutesPerShortRest: 60,
      secondsPerRound: 6,
    },
  };
}

function calendarFixture(): CampaignCalendar {
  return {
    campaignCode: campaign.code,
    config: calendarConfig(),
    currentTime: 12,
    startTime: 0,
    events: [
      {
        id: 'evt-stable',
        title: 'Vault opens',
        description: 'DM detail',
        year: 1,
        month: 0,
        day: 2,
        createdAt: 10,
        visibility: 'private' as const,
      },
    ],
    weather: 'clear' as const,
  };
}

function oneCalendarState() {
  return { calendars: [calendarFixture()] };
}

function calendarEnvelope() {
  return JSON.stringify({ version: 3, state: oneCalendarState() });
}

function seedCalendarEnvelope() {
  localStorage.setItem('rollkeeper-calendar-data', calendarEnvelope());
}

/**
 * Puts this device in the state a completed local cutover leaves behind:
 * IndexedDB holds the routed generation and the legacy key is frozen behind
 * an `indexedDB` authority marker.
 */
async function seedLocalIndexedDbAuthority() {
  const payload = calendarPayloadFromCampaignCalendar(calendarFixture());
  const contentFingerprint = await fingerprintCalendarPayload(payload);
  const database = await openRollkeeperDatabase();
  const transaction = database.transaction(
    ['meta', 'kvGenerations'],
    'readwrite'
  );
  transaction.objectStore('meta').put({
    key: `migration-state:${NAMESPACE}:calendar:${CAMPAIGN_ID}`,
    state: 'CUTOVER_READY',
    runId: GENERATION,
  });
  transaction.objectStore('kvGenerations').put({
    namespace: NAMESPACE,
    generation: GENERATION,
    key: 'rollkeeper-calendar-data',
    presence: true,
    rawValue: calendarEnvelope(),
  });
  await transactionComplete(transaction);
  await commitCalendarLocalCutover(database, {
    namespace: NAMESPACE,
    campaignId: CAMPAIGN_ID,
    generation: GENERATION,
    confirmed: true,
    gates,
    now: () => NOW,
    initialDocument: {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN_ID,
      legacyId: campaign.code,
      family: 'calendar',
      cutoverEpoch: 1,
      operation: 'create',
      payload,
      schemaVersion: 1,
      localRevision: 1,
      baseServerVersion: 0,
      contentFingerprint,
      updatedAt: NOW,
      deletedAt: null,
    },
  });
  database.close();
  writeCalendarProjectionAuthority(localStorage, campaign.code, {
    version: 1,
    authority: 'indexedDB',
    epoch: 1,
    campaignId: CAMPAIGN_ID,
    namespace: NAMESPACE,
  });
}

/**
 * Drives the discovery → preview → verified recovery → prepare → cutover flow
 * that leaves this device on its own local IndexedDB authority.
 */
async function completeLocalCutover() {
  render(<CalendarSyncControls campaign={campaign} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Find owner workspaces' })
  );
  fireEvent.click(
    await screen.findByRole('button', { name: /Select Calendar/ })
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Preview exact manifest' })
  );
  const createObjectURL = vi.mocked(URL.createObjectURL);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Download recovery file' })
  );
  await screen.findByText(/Reopen that file here before selection/);
  const downloadedBlob = createObjectURL.mock.calls[0]![0] as Blob;
  fireEvent.change(screen.getByLabelText('Downloaded calendar recovery file'), {
    target: {
      files: [
        new File([await downloadedBlob.text()], 'calendar-backup.json', {
          type: 'application/json',
        }),
      ],
    },
  });
  await screen.findByText(
    'Recovery file verified and calendar selected. LocalStorage remains authoritative.'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Prepare IndexedDB' }));
  // "Confirm local cutover" is already on screen while preparation runs, so
  // the prepared generation has to be awaited before it can be clicked.
  await screen.findByText(
    'IndexedDB preparation validated and reopened. Final confirmation is still required.'
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm local cutover' })
  );
  await screen.findByText(
    'Local: saved · IndexedDB authority epoch 1 · Cloud: inactive'
  );
}

describe('CalendarSyncControls gates', () => {
  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    // The persisted store rewrites its envelope on every setState, so the
    // reset has to happen before the storage is cleared.
    useCalendarStore.setState({ calendars: [] });
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('renders nothing and performs zero storage, IndexedDB, cookie, or network work by default', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const open = vi.spyOn(indexedDB, 'open');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cookieBefore = document.cookie;
    const { container } = render(<CalendarSyncControls campaign={campaign} />);
    expect(container).toBeEmptyDOMElement();
    await Promise.resolve();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookieBefore);
  });

  it('workspace discovery and selection do not open the calendar repository', async () => {
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    const open = vi
      .spyOn(localDatabase, 'openRollkeeperDatabase')
      .mockRejectedValue(new Error('must not open'));
    render(<CalendarSyncControls campaign={campaign} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Select Calendar/ })
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Preview exact manifest' })
      ).toBeVisible()
    );
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview exact manifest' })
    );
    expect(
      await screen.findByRole('button', { name: 'Download recovery file' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Verify recovery file and select' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Prepare IndexedDB' })
    ).toBeDisabled();

    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:calendar-recovery');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined
    );
    vi.spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Download recovery file' })
    );
    await screen.findByText(/Reopen that file here before selection/);
    const downloadedBlob = createObjectURL.mock.calls[0]![0] as Blob;
    const recoveryFile = new File(
      [await downloadedBlob.text()],
      'calendar-backup.json',
      { type: 'application/json' }
    );
    fireEvent.change(
      screen.getByLabelText('Downloaded calendar recovery file'),
      {
        target: { files: [recoveryFile] },
      }
    );
    await screen.findByText(/family selection was cancelled/);
    expect(
      screen.getByRole('button', { name: 'Prepare IndexedDB' })
    ).toBeDisabled();
    fireEvent.change(
      screen.getByLabelText('Downloaded calendar recovery file'),
      { target: { files: [recoveryFile] } }
    );
    await screen.findByText(
      'Recovery file verified and calendar selected. LocalStorage remains authoritative.'
    );
    expect(
      screen.getByRole('button', { name: 'Prepare IndexedDB' })
    ).toBeEnabled();
  });

  it('hydrates after a reload when the workspace was only discovered, never enrolled', async () => {
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'true');
    const remembered = mockOwnerWorkspaceWithMemory();
    mockOwnerSession();
    useCalendarStore.setState(oneCalendarState());
    seedCalendarEnvelope();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:calendar-recovery');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await completeLocalCutover();

    // The reload: fresh mount, localStorage keeps the frozen legacy copy plus
    // the authority marker, IndexedDB keeps the cutover generation, and cloud
    // activation never happened.
    cleanup();
    useCalendarStore.setState(oneCalendarState());
    render(<CalendarSyncControls campaign={campaign} />);

    expect(
      await screen.findByText(
        'Calendar loaded from the verified local IndexedDB generation.'
      )
    ).toBeVisible();
    expect(
      screen.queryByText(
        'The initialized calendar namespace has no matching owner workspace on this device.'
      )
    ).toBeNull();
    expect(remembered).toHaveLength(1);

    // …and edits keep committing instead of dying in the frozen legacy key.
    const commit = vi.spyOn(IndexedDbCalendarRepository.prototype, 'commit');
    await act(async () => {
      useCalendarStore.getState().setWeather(campaign.code, 'rain');
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    expect(commit).toHaveBeenCalled();
    const database = await openRollkeeperDatabase();
    try {
      const document = await new IndexedDbCalendarRepository(
        database
      ).getDocument(NAMESPACE, campaign.code);
      expect(document?.payload?.weather).toBe('rain');
      expect(document?.localRevision).toBe(2);
    } finally {
      database.close();
    }
  });

  it('does not re-hydrate over a newer local edit on a repeated auth event', async () => {
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'true');
    // The device already knows the workspace, so this case isolates the
    // re-entrancy guard from the cutover-time `remember`.
    mockOwnerWorkspaceWithMemory().push(workspace);
    const fireAuthEvent = mockOwnerSessionCapturingListener();
    await seedLocalIndexedDbAuthority();
    useCalendarStore.setState(oneCalendarState());
    seedCalendarEnvelope();

    render(<CalendarSyncControls campaign={campaign} />);
    await screen.findByText(
      'Calendar loaded from the verified local IndexedDB generation.'
    );
    const openContext = vi.mocked(browserDmWorkspace.createBrowserDmWorkspace);
    expect(openContext).toHaveBeenCalledTimes(1);

    await act(async () => {
      useCalendarStore.getState().setWeather(campaign.code, 'rain');
      fireAuthEvent('TOKEN_REFRESHED', { user: { id: ACCOUNT_ID } });
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    // The guard returns before `createBrowserDmWorkspace()`, so this count is
    // the scheduling-independent witness that no second hydration pass ran:
    // it is 2 without the guard however the chain happened to interleave.
    expect(openContext).toHaveBeenCalledTimes(1);
    expect(
      useCalendarStore
        .getState()
        .calendars.find(value => value.campaignCode === campaign.code)?.weather
    ).toBe('rain');

    // …and the baseline survived the auth event, so the edit still committed.
    const database = await openRollkeeperDatabase();
    try {
      const document = await new IndexedDbCalendarRepository(
        database
      ).getDocument(NAMESPACE, campaign.code);
      expect(document?.payload?.weather).toBe('rain');
      expect(document?.localRevision).toBe(2);
    } finally {
      database.close();
    }
  });

  it('does not upload the local candidate after enrollment until the cloud generation is applied', async () => {
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'true');
    mockOwnerWorkspaceWithMemory();
    useCalendarStore.setState(oneCalendarState());
    seedCalendarEnvelope();
    const cloudPayload = {
      ...calendarPayloadFromCampaignCalendar(calendarFixture()),
      weather: 'snow' as const,
    };
    const requests: Record<string, unknown>[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (_input, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push(body);
        const respond = (value: unknown) =>
          ({ ok: true, json: async () => value }) as Response;
        if (body.action === 'preview-enrollment')
          return respond({
            authority: 'postgres',
            epoch: 1,
            previewFingerprint: 'preview-fingerprint',
            serverVersion: 1,
            schemaVersion: 1,
            payloadFingerprint: 'cloud-fingerprint',
            tombstoned: false,
            payload: cloudPayload,
          });
        if (body.action === 'enroll-device') return respond({});
        if (body.action === 'put')
          return respond({
            serverVersion: Number(body.expectedServerVersion) + 1,
            cutoverEpoch: Number(body.expectedEpoch),
            payloadFingerprint: body.payloadFingerprint,
            cloudSaved: true,
            playerView: 'pending',
          });
        throw new Error(`unexpected action ${String(body.action)}`);
      }
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CalendarSyncControls campaign={campaign} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Select Calendar/ })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Preview cloud enrollment' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Enroll this device' })
    );
    await screen.findByText(
      'Device explicitly enrolled and hydrated into its isolated IndexedDB namespace.'
    );

    // The enrollment confirm promises the local candidate "is never uploaded
    // automatically", so autosave must stay disarmed until the DM applies the
    // exact cloud generation. The 10ms window is the same one the reload case
    // uses as its positive control for a completed autosave run.
    const commit = vi.spyOn(IndexedDbCalendarRepository.prototype, 'commit');
    for (const weather of ['rain', 'fog'] as const) {
      await act(async () => {
        useCalendarStore.getState().setWeather(campaign.code, weather);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }

    expect(commit).not.toHaveBeenCalled();
    expect(requests.map(request => request.action)).not.toContain('put');
  });

  it('arms autosave when the applied cloud version is one the device already holds', async () => {
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'true');
    mockOwnerWorkspaceWithMemory();
    useCalendarStore.setState(oneCalendarState());
    seedCalendarEnvelope();
    const cloudPayload = {
      ...calendarPayloadFromCampaignCalendar(calendarFixture()),
      weather: 'snow' as const,
    };
    const cloudFingerprint = await fingerprintCalendarPayload(cloudPayload);
    const requests: Record<string, unknown>[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (_input, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push(body);
        const respond = (value: unknown) =>
          ({ ok: true, json: async () => value }) as Response;
        if (body.action === 'preview-enrollment')
          return respond({
            authority: 'postgres',
            epoch: 1,
            previewFingerprint: 'preview-fingerprint',
            serverVersion: 1,
            schemaVersion: 1,
            payloadFingerprint: cloudFingerprint,
            tombstoned: false,
            payload: cloudPayload,
          });
        if (body.action === 'enroll-device') return respond({});
        if (body.action === 'put')
          return respond({
            serverVersion: Number(body.expectedServerVersion) + 1,
            cutoverEpoch: Number(body.expectedEpoch),
            payloadFingerprint: body.payloadFingerprint,
            cloudSaved: true,
            playerView: 'pending',
          });
        throw new Error(`unexpected action ${String(body.action)}`);
      }
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CalendarSyncControls campaign={campaign} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Select Calendar/ })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Preview cloud enrollment' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Enroll this device' })
    );
    await screen.findByText(
      'Device explicitly enrolled and hydrated into its isolated IndexedDB namespace.'
    );

    // Enrollment writes exactly the previewed version into IndexedDB, so the
    // Apply button that takes the enroll button's place lands on the
    // already-has-this-version short-circuit. The store is still on the local
    // candidate, so that path has to hydrate too — skipping it would leave a
    // device whose frozen legacy key swallows every later edit.
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply exact cloud version' })
    );
    await screen.findByText(
      'This device already has the exact accepted cloud version.'
    );

    // Two edits, because a freshly armed run can only seed the baseline; the
    // second one is the falsifiable half of this assertion.
    const commit = vi.spyOn(IndexedDbCalendarRepository.prototype, 'commit');
    for (const weather of ['rain', 'fog'] as const) {
      await act(async () => {
        useCalendarStore.getState().setWeather(campaign.code, weather);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }
    expect(commit).toHaveBeenCalled();
    expect(requests.map(request => request.action)).toContain('put');
  });

  /**
   * Drives an enrolled-but-unapplied device: the cloud generation is in
   * IndexedDB while the store still shows the local candidate, which is the
   * only state both hydrating paths below start from. The second
   * preview-enrollment answers with a newer cloud version, because
   * `applyExactCloudVersion` short-circuits on a device that already holds the
   * previewed one.
   */
  async function enrollAgainstCloudGeneration(
    requests: Record<string, unknown>[]
  ) {
    const base = calendarPayloadFromCampaignCalendar(calendarFixture());
    const cloudPayload = { ...base, weather: 'snow' as const };
    const cloudFingerprint = await fingerprintCalendarPayload(cloudPayload);
    const appliedPayload = { ...base, weather: 'blizzard' as const };
    const appliedFingerprint = await fingerprintCalendarPayload(appliedPayload);
    const restoredPayload = { ...base, weather: 'cloudy' as const };
    const restoredFingerprint =
      await fingerprintCalendarPayload(restoredPayload);
    let previews = 0;
    const version = (serverVersion: number) => ({
      serverVersion,
      cutoverEpoch: 1,
      schemaVersion: 1,
      payloadFingerprint: restoredFingerprint,
      tombstoned: false,
      acceptedAt: NOW,
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (_input, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push(body);
        const respond = (value: unknown) =>
          ({ ok: true, json: async () => value }) as Response;
        if (body.action === 'preview-enrollment') {
          previews += 1;
          return respond({
            authority: 'postgres',
            epoch: 1,
            previewFingerprint: 'preview-fingerprint',
            serverVersion: previews === 1 ? 1 : 2,
            schemaVersion: 1,
            payloadFingerprint:
              previews === 1 ? cloudFingerprint : appliedFingerprint,
            tombstoned: false,
            payload: previews === 1 ? cloudPayload : appliedPayload,
          });
        }
        if (body.action === 'enroll-device') return respond({});
        if (body.action === 'history')
          return respond({ versions: [version(2), version(1)] });
        if (body.action === 'restore-version')
          return respond({
            serverVersion: 3,
            cutoverEpoch: 1,
            payloadFingerprint: restoredFingerprint,
          });
        if (body.action === 'export-version')
          return respond({
            serverVersion: 3,
            schemaVersion: 1,
            payloadFingerprint: restoredFingerprint,
            tombstoned: false,
            payload: restoredPayload,
          });
        if (body.action === 'put')
          return respond({
            serverVersion: Number(body.expectedServerVersion) + 1,
            cutoverEpoch: Number(body.expectedEpoch),
            payloadFingerprint: body.payloadFingerprint,
            cloudSaved: true,
            playerView: 'pending',
          });
        throw new Error(`unexpected action ${String(body.action)}`);
      }
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CalendarSyncControls campaign={campaign} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Select Calendar/ })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Preview cloud enrollment' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Enroll this device' })
    );
    await screen.findByText(
      'Device explicitly enrolled and hydrated into its isolated IndexedDB namespace.'
    );
  }

  it('arms autosave when the exact cloud version is applied', async () => {
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'true');
    mockOwnerWorkspaceWithMemory();
    useCalendarStore.setState(oneCalendarState());
    seedCalendarEnvelope();
    const requests: Record<string, unknown>[] = [];
    await enrollAgainstCloudGeneration(requests);

    // Two edits, because the first armed run only seeds the baseline: without
    // the `hydrated` gate the second one commits inside its own 10ms window,
    // which is what keeps this negative from passing vacuously.
    const commit = vi.spyOn(IndexedDbCalendarRepository.prototype, 'commit');
    for (const weather of ['rain', 'fog'] as const) {
      await act(async () => {
        useCalendarStore.getState().setWeather(campaign.code, weather);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }
    expect(commit).not.toHaveBeenCalled();
    expect(requests.map(request => request.action)).not.toContain('put');

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview cloud enrollment' })
    );
    // The Apply button is already on screen from the enrollment preview, so
    // wait for the newer preview to reach state before clicking it — applying
    // the version this device already holds is a no-op that never arms.
    await screen.findByText(
      'Cloud enrollment preview loaded. This device remains unenrolled.'
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply exact cloud version' })
    );
    await screen.findByText('Device hydrated from exact cloud version 2.');

    // Applying rewrote the store from IndexedDB, so it is a hydrating path:
    // the next edit must still reach IndexedDB and the cloud.
    await act(async () => {
      useCalendarStore.getState().setWeather(campaign.code, 'rain');
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    expect(commit).toHaveBeenCalled();
    expect(requests.map(request => request.action)).toContain('put');
  });

  it('arms autosave after a version restore on an enrolled device', async () => {
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'true');
    mockOwnerWorkspaceWithMemory();
    useCalendarStore.setState(oneCalendarState());
    seedCalendarEnvelope();
    const requests: Record<string, unknown>[] = [];
    await enrollAgainstCloudGeneration(requests);

    // Enrolled but never applied, so autosave is still disarmed here.
    fireEvent.click(screen.getByRole('button', { name: 'Version history' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Restore as new version' })
    );
    await screen.findByText(
      'Cloud: saved as version 3 · Player view: pending acknowledgement'
    );

    // The restore rewrote the store from IndexedDB, so it is a hydrating path
    // too — and it is the site Slice 11E missed on its first pass.
    const commit = vi.spyOn(IndexedDbCalendarRepository.prototype, 'commit');
    await act(async () => {
      useCalendarStore.getState().setWeather(campaign.code, 'rain');
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    expect(commit).toHaveBeenCalled();
    expect(requests.map(request => request.action)).toContain('put');
  });

  it('disarms autosave when a later hydration finds the local calendar tombstoned', async () => {
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'true');
    mockOwnerWorkspaceWithMemory().push(workspace);
    const fireAuthEvent = mockOwnerSessionCapturingListener();
    await seedLocalIndexedDbAuthority();
    useCalendarStore.setState(oneCalendarState());
    seedCalendarEnvelope();

    render(<CalendarSyncControls campaign={campaign} />);
    await screen.findByText(
      'Calendar loaded from the verified local IndexedDB generation.'
    );
    // Let the baseline-establishing autosave run finish before measuring.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    // Tombstone the local document and advance the local generation, so the
    // next auth event misses the re-entrancy signature and hydration reaches
    // its empty-payload branch.
    // Exactly what hydrate's verification hashes for an absent payload, so the
    // pass reaches the empty-payload branch instead of failing the fingerprint
    // check above it. Hashed before the transaction opens, because an await
    // inside one deactivates it.
    const absentPayloadFingerprint = await fingerprintCalendarPayload(
      null as unknown as CalendarPayload
    );
    const database = await openRollkeeperDatabase();
    const transaction = database.transaction(
      ['documents', 'meta'],
      'readwrite'
    );
    transaction.objectStore('documents').put({
      namespace: NAMESPACE,
      campaignId: CAMPAIGN_ID,
      legacyId: campaign.code,
      family: 'calendar',
      cutoverEpoch: 1,
      operation: 'delete',
      payload: null,
      schemaVersion: 1,
      localRevision: 2,
      baseServerVersion: 1,
      contentFingerprint: absentPayloadFingerprint,
      updatedAt: NOW,
      deletedAt: NOW,
    });
    transaction.objectStore('meta').put({
      key: `active-generation:${NAMESPACE}:calendar:${CAMPAIGN_ID}`,
      authority: 'indexedDB',
      namespace: NAMESPACE,
      campaignId: CAMPAIGN_ID,
      family: 'calendar',
      generation: GENERATION,
      epoch: 2,
      committedAt: NOW,
    });
    await transactionComplete(transaction);
    database.close();

    const commit = vi.spyOn(IndexedDbCalendarRepository.prototype, 'commit');
    await act(async () => {
      fireAuthEvent('TOKEN_REFRESHED', { user: { id: ACCOUNT_ID } });
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    // The branch ran: the tombstoned campaign is out of the store.
    expect(
      useCalendarStore
        .getState()
        .calendars.some(value => value.campaignCode === campaign.code)
    ).toBe(false);
    // …and because that pass invalidated the store, it also disarmed. Left
    // armed, the emptied store diverges from the stale payload baseline and
    // autosave writes a delete this hydration never asked for.
    expect(commit).not.toHaveBeenCalled();
  });
});
