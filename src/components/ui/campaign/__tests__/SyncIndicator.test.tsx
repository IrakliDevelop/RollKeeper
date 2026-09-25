import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SyncIndicator } from '@/components/ui/campaign/SyncIndicator';
import type { CharacterState } from '@/types/character';

afterEach(() => {
  cleanup();
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

const SHARE_SHEET_TITLE =
  'Let party members open a limited view of this character on the battle map';

function getShareSheetToggle() {
  const container = screen.getByTitle(SHARE_SHEET_TITLE);
  return within(container).getByRole('switch');
}

describe('SyncIndicator — Share sheet toggle', () => {
  it('shows the "Share sheet" label', async () => {
    render(<SyncIndicator {...baseProps()} sharePartyView={true} />);
    await openMenu();
    expect(screen.getByText('Share sheet')).toBeTruthy();
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
