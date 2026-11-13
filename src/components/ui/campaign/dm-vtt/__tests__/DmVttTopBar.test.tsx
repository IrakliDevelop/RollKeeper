import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DmVttTopBar } from '@/components/ui/campaign/dm-vtt/DmVttTopBar';
import { TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { openTvDisplay } from '@/lib/openTvDisplay';

import type { BattleMapConnectionStatus } from '@/lib/battlemapSync';

vi.mock('@/lib/openTvDisplay', () => ({ openTvDisplay: vi.fn() }));

const baseProps = {
  campaignCode: 'ABC123',
  battleMapId: 'bm1',
  dmId: 'dm1',
  mapName: 'Crypt',
  status: 'live' as BattleMapConnectionStatus,
  gridMode: 'square' as const,
  onSetGridMode: vi.fn(),
  mode: 'play' as const,
  onModeChange: vi.fn(),
};

function renderTopBar(overrides: Partial<typeof baseProps> = {}) {
  return render(
    <TooltipProvider>
      <DmVttTopBar {...baseProps} {...overrides} />
    </TooltipProvider>
  );
}

describe('DmVttTopBar', () => {
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
    vi.clearAllMocks();
  });

  it('marks the current grid type and mode with aria-pressed', async () => {
    const user = userEvent.setup();
    const onSetGridMode = vi.fn();
    renderTopBar({ onSetGridMode });

    const grid = screen.getByRole('group', { name: 'Grid type' });
    const square = within(grid).getByRole('button', { name: 'Square' });
    const hex = within(grid).getByRole('button', { name: 'Hex' });
    expect(square).toHaveAttribute('aria-pressed', 'true');
    expect(hex).toHaveAttribute('aria-pressed', 'false');

    const modeGroup = screen.getByRole('group', { name: 'Mode' });
    const play = within(modeGroup).getByRole('button', { name: 'Play' });
    const setup = within(modeGroup).getByRole('button', { name: 'Setup' });
    expect(play).toHaveAttribute('aria-pressed', 'true');
    expect(setup).toHaveAttribute('aria-pressed', 'false');

    for (const button of [square, hex, play, setup]) {
      expect(button).toHaveAttribute('data-variant', 'secondary');
    }

    await user.click(hex);
    expect(onSetGridMode).toHaveBeenCalledWith('hex');
  });

  it.each([
    ['live', 'Live'],
    ['connecting', 'Connecting…'],
    ['offline', 'Offline'],
    ['denied', 'Denied'],
    ['unsupported', 'Sync unavailable'],
  ] as const)('shows the %s status word', (status, word) => {
    renderTopBar({ status });
    const text = screen.getByText(word, { exact: true });
    expect(text.closest('.sr-only')).toBeNull();
    expect(screen.getByTestId('live-sync-chip')).toHaveTextContent(word);
  });

  it('links back to battle maps and opens the TV display', async () => {
    const user = userEvent.setup();
    renderTopBar();

    const back = screen.getByRole('link', { name: 'Back to battle maps' });
    expect(back).toHaveAttribute('href', '/dm/campaign/ABC123/battlemaps');
    expect(back.querySelector('button')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Back to battle maps' })
    ).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Open TV display' }));
    expect(openTvDisplay).toHaveBeenCalledWith('ABC123', 'bm1', 'dm1');
  });
});
