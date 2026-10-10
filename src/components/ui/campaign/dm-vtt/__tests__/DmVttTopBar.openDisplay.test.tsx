import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DmVttTopBar } from '../DmVttTopBar';

const saved = process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED;

function renderBar() {
  return render(
    <DmVttTopBar
      campaignCode="CAMP"
      battleMapId="map-1"
      dmId="dm-1"
      mapName="Map"
      status="live"
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
  if (saved === undefined)
    delete process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED;
  else process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = saved;
});

describe('DmVttTopBar Open display (PR05 E12)', () => {
  it('under Table v1 opens the campaign display and shows a blocked-popup message', async () => {
    process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = 'true';
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

  it('flag off keeps the legacy map-pinned launcher', () => {
    delete process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED;
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Open display' }));
    expect(open).toHaveBeenCalledWith('', '_blank');
  });
});
