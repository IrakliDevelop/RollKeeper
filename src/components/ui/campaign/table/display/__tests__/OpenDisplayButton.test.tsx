import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CampaignDisplayLauncher,
  OpenDisplayButton,
} from '../OpenDisplayButton';

const CAPABILITY = 'Cap5Synthetic_display-capability_0123456789';
const saved = process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({ capability: CAPABILITY, displayGeneration: 4 })
    )
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (saved === undefined)
    delete process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED;
  else process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = saved;
});

describe('Open display launcher button (E12)', () => {
  it('opens the window synchronously and reports a blocked popup', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<OpenDisplayButton code="CAMP" dmId="dm-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open display' }));
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(
      await screen.findByText(
        'Your browser blocked the new window. Allow pop-ups for this site, then press Open display again.'
      )
    ).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports success to the caller and clears an earlier message', async () => {
    const win = {
      opener: window,
      location: { replace: vi.fn() },
      close: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
    const onLaunched = vi.fn();
    render(
      <OpenDisplayButton code="CAMP" dmId="dm-1" onLaunched={onLaunched} />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open display' }));
    });
    expect(win.location.replace).toHaveBeenCalledWith(
      `/table-display/CAMP#k=${CAPABILITY}`
    );
    expect(onLaunched).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')?.textContent ?? '').toBe('');
  });
});

describe('campaign dashboard launcher gate (E12)', () => {
  it('renders only with the existing Table v1 public flag', () => {
    delete process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED;
    const { container } = render(
      <CampaignDisplayLauncher code="CAMP" dmId="dm-1" />
    );
    expect(container.innerHTML).toBe('');
    cleanup();
    process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = 'true';
    render(<CampaignDisplayLauncher code="CAMP" dmId="dm-1" />);
    expect(screen.getByRole('button', { name: 'Open display' })).toBeVisible();
  });
});
