import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SyncIndicator } from '@/components/ui/campaign/SyncIndicator';
import type { CharacterState } from '@/types/character';
import {
  clickConfirmDialogButton,
  findConfirmDialog,
  queryConfirmDialog,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function baseProps() {
  return {
    syncStatus: 'synced' as const,
    lastSyncedAt: null,
    campaignCode: 'ABCD',
    campaignName: 'Test Campaign',
    autoSync: true,
    syncEnabled: true,
    onSyncNow: vi.fn(),
    onToggleAutoSync: vi.fn(),
    onLeaveCampaign: vi.fn(),
    characterData: {} as CharacterState,
    shareHpWithParty: true,
    onToggleShareHp: vi.fn(),
    sharePartyView: true,
    onSharePartyViewChange: vi.fn(),
  };
}

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /test campaign/i }));
  return user;
}

function getShareSheetToggle() {
  return screen.getByRole('switch', { name: 'Share sheet with party' });
}

describe('SyncIndicator — Share sheet toggle', () => {
  it('shows the "Share sheet with party" label', async () => {
    render(<SyncIndicator {...baseProps()} sharePartyView={true} />);
    await openMenu();
    expect(screen.getByText('Share sheet with party')).toBeTruthy();
  });

  it('reflects sharePartyView=true as checked', async () => {
    render(<SyncIndicator {...baseProps()} sharePartyView={true} />);
    await openMenu();
    expect(getShareSheetToggle()).toHaveAttribute('aria-checked', 'true');
  });

  it('reflects sharePartyView=false as unchecked', async () => {
    render(<SyncIndicator {...baseProps()} sharePartyView={false} />);
    await openMenu();
    expect(getShareSheetToggle()).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onSharePartyViewChange with the new boolean on click', async () => {
    const onSharePartyViewChange = vi.fn();
    render(
      <SyncIndicator
        {...baseProps()}
        sharePartyView={true}
        onSharePartyViewChange={onSharePartyViewChange}
      />
    );
    const user = await openMenu();
    await user.click(getShareSheetToggle());
    expect(onSharePartyViewChange).toHaveBeenCalledWith(false);
  });
});

describe('SyncIndicator — switches', () => {
  it('labels the three switches and describes Share sheet', async () => {
    render(<SyncIndicator {...baseProps()} />);
    await openMenu();
    expect(
      screen.getByRole('switch', { name: 'Auto-sync' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'Share HP with party' })
    ).toHaveAttribute('aria-checked', 'true');
    expect(getShareSheetToggle()).toHaveAccessibleDescription(
      'Let party members open a limited view of this character on the battle map'
    );
  });

  it('shows Sync now only when auto-sync is off', async () => {
    const { unmount } = render(
      <SyncIndicator {...baseProps()} autoSync={false} />
    );
    await openMenu();
    expect(
      screen.getByRole('button', { name: 'Sync now' })
    ).toBeInTheDocument();
    unmount();

    render(<SyncIndicator {...baseProps()} autoSync={true} />);
    await openMenu();
    expect(screen.queryByRole('button', { name: 'Sync now' })).toBeNull();
  });
});

describe('SyncIndicator — popover', () => {
  it('opens a Campaign sync popover and closes it on Escape, returning focus', async () => {
    render(<SyncIndicator {...baseProps()} />);
    const user = await openMenu();
    const trigger = screen.getByRole('button', { name: /test campaign/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('data-selected', 'true');
    expect(
      screen.getByRole('dialog', { name: 'Campaign sync' })
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('dialog', { name: 'Campaign sync' })
    ).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe('SyncIndicator — state word', () => {
  it.each([
    [
      'synced',
      '2026-11-13T10:00:00.000Z',
      'Synced',
      /^Synced (just now|\d+[smh] ago)$/,
    ],
    ['idle', null, 'Not synced', /^Not synced$/],
    ['syncing', null, 'Syncing…', /^Syncing…$/],
    ['error', '2026-11-13T10:00:00.000Z', 'Sync failed', /^Sync failed$/],
  ])('shows the %s state word in the trigger', (status, last, short, full) => {
    render(
      <SyncIndicator
        {...baseProps()}
        syncStatus={status as never}
        lastSyncedAt={last}
      />
    );
    const trigger = screen.getByRole('button', { name: /test campaign/i });
    expect(
      within(trigger).getAllByText(short, { exact: true }).length
    ).toBeGreaterThan(0);
    expect(within(trigger).getAllByText(full).length).toBeGreaterThan(0);
  });
});

describe('SyncIndicator — Leave campaign', () => {
  it('closes the menu, asks, and leaves only when confirmed', async () => {
    renderConfirmDialogHost();
    const props = baseProps();
    render(<SyncIndicator {...props} />);

    let user = await openMenu();
    await user.click(screen.getByRole('button', { name: 'Leave campaign' }));
    expect(await findConfirmDialog()).toHaveAccessibleName(
      'Leave this campaign?'
    );
    // The menu closed before the dialog opened.
    expect(
      screen.queryByRole('dialog', { name: 'Campaign sync' })
    ).not.toBeInTheDocument();
    expect(
      within(await findConfirmDialog()).getByRole('button', {
        name: 'Leave campaign',
      })
    ).toHaveAttribute('data-variant', 'danger-solid');
    await clickConfirmDialogButton('Cancel');
    expect(props.onLeaveCampaign).not.toHaveBeenCalled();
    // Focus returns to the button that opened the menu, not to the page body.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /test campaign/i })
      ).toHaveFocus()
    );

    user = await openMenu();
    await user.click(screen.getByRole('button', { name: 'Leave campaign' }));
    await clickConfirmDialogButton('Leave campaign');
    expect(props.onLeaveCampaign).toHaveBeenCalledTimes(1);
    expect(queryConfirmDialog()).toBeNull();
  });
});
