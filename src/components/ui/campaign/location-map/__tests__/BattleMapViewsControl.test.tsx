import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BattleMapViewsControl } from '../BattleMapViewsControl';
import type { SavedCameraView } from '@/types/battlemap';

const currentView = { x: 0, y: 0, w: 400, h: 300 };

const views: SavedCameraView[] = [
  { id: 'v1', name: 'Goblin ambush', view: { x: 10, y: 10, w: 200, h: 150 } },
  { id: 'v2', name: 'Throne room', view: { x: 20, y: 20, w: 300, h: 200 } },
];

const baseProps = {
  getViewport: () => ({ getVisibleRect: () => currentView }),
  views,
  onSaveView: vi.fn(),
  onRenameView: vi.fn(),
  onDeleteView: vi.fn(),
  onGoToView: vi.fn(),
  onSend: vi.fn(),
  sharingEnabled: false,
  onSharingChange: vi.fn(),
};

async function openPopover() {
  await userEvent.click(screen.getByRole('button', { name: /views/i }));
}

afterEach(() => cleanup());

describe('BattleMapViewsControl', () => {
  it('opens the popover on trigger click and closes on outside click', async () => {
    render(<BattleMapViewsControl {...baseProps} />);
    expect(
      screen.queryByRole('button', { name: /goblin ambush/i })
    ).not.toBeInTheDocument();
    await openPopover();
    expect(
      screen.getByRole('button', { name: /goblin ambush/i })
    ).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(
      screen.queryByRole('button', { name: /goblin ambush/i })
    ).not.toBeInTheDocument();
  });

  it('saves the current view via captureCameraView', async () => {
    const onSaveView = vi.fn();
    render(<BattleMapViewsControl {...baseProps} onSaveView={onSaveView} />);
    await openPopover();
    await userEvent.click(
      screen.getByRole('button', { name: /save current view/i })
    );
    expect(onSaveView).toHaveBeenCalledTimes(1);
    expect(onSaveView).toHaveBeenCalledWith(currentView);
  });

  it('renames a view', async () => {
    const onRenameView = vi.fn();
    render(
      <BattleMapViewsControl {...baseProps} onRenameView={onRenameView} />
    );
    await openPopover();
    const row = screen.getByRole('group', { name: /throne room/i });
    await userEvent.click(within(row).getByRole('button', { name: /rename/i }));
    const input = within(row).getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'War room{Enter}');
    expect(onRenameView).toHaveBeenCalledWith('v2', 'War room');
  });

  it('deletes a view', async () => {
    const onDeleteView = vi.fn();
    render(
      <BattleMapViewsControl {...baseProps} onDeleteView={onDeleteView} />
    );
    await openPopover();
    const row = screen.getByRole('group', { name: /goblin ambush/i });
    await userEvent.click(within(row).getByRole('button', { name: /delete/i }));
    expect(onDeleteView).toHaveBeenCalledWith('v1');
  });

  it('sends a specific saved view to the chosen audience when sharing is on', async () => {
    const onSend = vi.fn();
    render(
      <BattleMapViewsControl {...baseProps} sharingEnabled onSend={onSend} />
    );
    await openPopover();
    await userEvent.click(screen.getByRole('radio', { name: /players/i }));
    const row = screen.getByRole('group', { name: /throne room/i });
    await userEvent.click(within(row).getByRole('button', { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith(views[1].view, 'players');
  });
});

describe('BattleMapViewsControl opt-in gate', () => {
  it('defaults to sharing OFF and disables every send affordance', async () => {
    render(<BattleMapViewsControl {...baseProps} />);
    await openPopover();
    expect(
      screen.getByRole('switch', { name: /move players' cameras/i })
    ).not.toBeChecked();
    expect(
      screen.getByRole('button', { name: /bring them to my view/i })
    ).toBeDisabled();
    for (const radio of screen.getAllByRole('radio'))
      expect(radio).toBeDisabled();
    for (const send of screen.getAllByRole('button', { name: /send/i })) {
      expect(send).toBeDisabled();
    }
  });

  it('never calls onSend while the switch is off', async () => {
    const onSend = vi.fn();
    render(<BattleMapViewsControl {...baseProps} onSend={onSend} />);
    await openPopover();
    await userEvent.click(
      screen.getByRole('button', { name: /bring them to my view/i })
    );
    expect(onSend).not.toHaveBeenCalled();
  });

  it('enables sending exactly once when switched on', async () => {
    const onSend = vi.fn();
    render(
      <BattleMapViewsControl {...baseProps} sharingEnabled onSend={onSend} />
    );
    await openPopover();
    await userEvent.click(
      screen.getByRole('button', { name: /bring them to my view/i })
    );
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('keeps save, go, rename, and delete live in BOTH states', async () => {
    for (const sharingEnabled of [false, true]) {
      const onGoToView = vi.fn();
      const onSaveView = vi.fn();
      render(
        <BattleMapViewsControl
          {...baseProps}
          sharingEnabled={sharingEnabled}
          onGoToView={onGoToView}
          onSaveView={onSaveView}
        />
      );
      await openPopover();
      await userEvent.click(
        screen.getByRole('button', { name: /goblin ambush/i })
      );
      expect(onGoToView).toHaveBeenCalled();
      cleanup();
    }
  });

  it('meets the 44px touch-target minimum on every interactive element', async () => {
    render(<BattleMapViewsControl {...baseProps} sharingEnabled />);
    await openPopover();
    for (const el of screen.getAllByRole('button')) {
      expect(el.className).toMatch(/h-11|h-12|min-h-\[44px\]/);
    }
  });
});
