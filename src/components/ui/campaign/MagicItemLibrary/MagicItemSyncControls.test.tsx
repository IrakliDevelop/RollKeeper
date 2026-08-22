import 'fake-indexeddb/auto';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as localDatabase from '@/lib/indexeddb/localDatabase';
import * as browserDmWorkspace from '@/lib/supabase/browserDmWorkspace';
import { useMagicItemLibraryStore } from '@/store/magicItemLibraryStore';

import { MagicItemSyncControls } from './MagicItemSyncControls';

const campaign = { code: 'SYNTH1', name: 'Magic items', createdAt: 'now' };

const workspace = {
  namespace: 'user:11111111-1111-4111-8111-111111111111' as const,
  localId: 'legacy:SYNTH1',
  legacyId: 'SYNTH1',
  name: 'Magic items',
  creationKind: 'import_fork' as const,
  sourceFingerprint: 'source',
  createdAt: 'created',
  family: 'workspace_identity' as const,
  cloudId: '22222222-2222-4222-8222-222222222222',
  displayCode: 'A1B2C3D4E5F6',
  membershipAuthority: 'legacy' as const,
  familyAuthorities: 'legacy' as const,
  liveRuntimeAuthority: 'redis_relay' as const,
  acknowledgedAt: 'acknowledged',
};

function mockOwnerWorkspace() {
  vi.spyOn(browserDmWorkspace, 'createBrowserDmWorkspace').mockResolvedValue({
    accountId: '11111111-1111-4111-8111-111111111111',
    accountLabel: 'fake@example.test',
    list: vi.fn().mockResolvedValue([]),
    discover: vi.fn().mockResolvedValue([workspace]),
    remember: vi.fn(),
    create: vi.fn(),
    forkLegacy: vi.fn(),
    close: vi.fn(),
  });
}

function seedOneItemEnvelope() {
  const now = '2026-08-22T00:00:00.000Z';
  localStorage.setItem(
    'rollkeeper-dm-magic-item-library',
    JSON.stringify({
      version: 1,
      state: {
        itemsByCampaign: {
          SYNTH1: [
            {
              id: 'magic-1',
              campaignCode: 'SYNTH1',
              name: 'Cloak of Elvenkind',
              category: 'wondrous item',
              rarity: 'uncommon',
              description: 'A shifting grey cloak.',
              properties: [],
              requiresAttunement: true,
              tags: ['cloak'],
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      },
    })
  );
}

async function selectWorkspaceAndPreview() {
  render(<MagicItemSyncControls campaign={campaign} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Find owner workspaces' })
  );
  fireEvent.click(
    await screen.findByRole('button', { name: /Select Magic items/ })
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Preview exact manifest' })
    ).toBeVisible()
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Preview exact manifest' })
  );
}

describe('MagicItemSyncControls gates', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    // The persisted store rewrites its envelope on every setState, so the
    // reset has to happen before the storage is cleared.
    useMagicItemLibraryStore.setState({ itemsByCampaign: {} });
    localStorage.clear();
  });

  it('renders nothing and performs zero storage, IndexedDB, cookie, or network work by default', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const open = vi.spyOn(indexedDB, 'open');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cookieBefore = document.cookie;
    const { container } = render(<MagicItemSyncControls campaign={campaign} />);
    expect(container).toBeEmptyDOMElement();
    await Promise.resolve();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookieBefore);
  });

  it('workspace discovery and selection do not open the magic item repository', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    seedOneItemEnvelope();
    const open = vi
      .spyOn(localDatabase, 'openRollkeeperDatabase')
      .mockRejectedValue(new Error('must not open'));
    render(<MagicItemSyncControls campaign={campaign} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Select Magic items/ })
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
    expect(open).not.toHaveBeenCalled();

    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:magic-item-recovery');
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
      'magic-item-backup.json',
      { type: 'application/json' }
    );
    fireEvent.change(
      screen.getByLabelText('Downloaded magic item recovery file'),
      { target: { files: [recoveryFile] } }
    );
    await screen.findByText(/family selection was cancelled/);
    expect(
      screen.getByRole('button', { name: 'Prepare IndexedDB' })
    ).toBeDisabled();
    fireEvent.change(
      screen.getByLabelText('Downloaded magic item recovery file'),
      { target: { files: [recoveryFile] } }
    );
    await screen.findByText(
      'Recovery file verified and magic item library selected. LocalStorage remains authoritative.'
    );
    expect(
      screen.getByRole('button', { name: 'Prepare IndexedDB' })
    ).toBeEnabled();
    expect(open).not.toHaveBeenCalled();
  });

  it('blocks cutover when the legacy envelope was never persisted', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    mockOwnerWorkspace();
    localStorage.removeItem('rollkeeper-dm-magic-item-library');
    await selectWorkspaceAndPreview();

    expect(
      await screen.findByText(
        /incomplete-envelope: rollkeeper-dm-magic-item-library has never been persisted on this device/
      )
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Confirm local cutover' })
    ).toBeNull();
  });
});
