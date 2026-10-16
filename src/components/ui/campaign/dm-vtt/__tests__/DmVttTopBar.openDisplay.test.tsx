import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DmVttTopBar } from '../DmVttTopBar';

function renderBar() {
  return render(
    <DmVttTopBar
      campaignCode="CAMP"
      battleMapId="map-1"
      dmId="dm-1"
      mapName="Map"
      gridMode="hex"
      onSetGridMode={() => {}}
      mode="play"
      onModeChange={() => {}}
    />
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DmVttTopBar Open display (PR05 E12)', () => {
  it('opens the campaign display and shows a blocked-popup message', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Open display' }));
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(
      await screen.findByText(
        'Your browser blocked the new window. Allow pop-ups for this site, then press Open display again.'
      )
    ).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('DmVttTopBar privacy label (PR08 repair 07)', () => {
  it('says the original map is private instead of a relay status chip', () => {
    renderBar();
    expect(
      screen.getByText("Private. Players don't see this map.")
    ).toBeVisible();
    expect(screen.queryByText('Connecting…')).toBeNull();
    expect(screen.queryByText('Live')).toBeNull();
  });
});
