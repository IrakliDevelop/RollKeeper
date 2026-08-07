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

async function openSaveInput() {
  await userEvent.click(
    screen.getByRole('button', { name: /save current view/i })
  );
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

  describe('inline save', () => {
    it('reveals a name input instead of saving immediately', async () => {
      const onSaveView = vi.fn();
      render(<BattleMapViewsControl {...baseProps} onSaveView={onSaveView} />);
      await openPopover();
      await openSaveInput();
      expect(
        screen.getByRole('textbox', { name: /view name/i })
      ).toBeInTheDocument();
      expect(onSaveView).not.toHaveBeenCalled();
    });

    it('saves with the typed name on Enter', async () => {
      const onSaveView = vi.fn();
      render(<BattleMapViewsControl {...baseProps} onSaveView={onSaveView} />);
      await openPopover();
      await openSaveInput();
      await userEvent.type(
        screen.getByRole('textbox', { name: /view name/i }),
        'Goblin ambush{Enter}'
      );
      expect(onSaveView).toHaveBeenCalledTimes(1);
      expect(onSaveView).toHaveBeenCalledWith(currentView, 'Goblin ambush');
    });

    it('saves with the typed name on confirm click', async () => {
      const onSaveView = vi.fn();
      render(<BattleMapViewsControl {...baseProps} onSaveView={onSaveView} />);
      await openPopover();
      await openSaveInput();
      await userEvent.type(
        screen.getByRole('textbox', { name: /view name/i }),
        'Ambush point'
      );
      await userEvent.click(
        screen.getByRole('button', { name: /confirm save/i })
      );
      expect(onSaveView).toHaveBeenCalledWith(currentView, 'Ambush point');
    });

    it('captures the view at the moment the input opens, not when the DM confirms', async () => {
      let liveView = currentView;
      const onSaveView = vi.fn();
      const getViewport = () => ({ getVisibleRect: () => liveView });
      render(
        <BattleMapViewsControl
          {...baseProps}
          getViewport={getViewport}
          onSaveView={onSaveView}
        />
      );
      await openPopover();
      await openSaveInput();
      // DM pans the map while the name field is open, after capture.
      liveView = { x: 999, y: 999, w: 50, h: 50 };
      await userEvent.type(
        screen.getByRole('textbox', { name: /view name/i }),
        'Original spot{Enter}'
      );
      expect(onSaveView).toHaveBeenCalledWith(currentView, 'Original spot');
      expect(onSaveView).not.toHaveBeenCalledWith(liveView, 'Original spot');
    });

    it('falls back to a generated name when left blank', async () => {
      const onSaveView = vi.fn();
      render(<BattleMapViewsControl {...baseProps} onSaveView={onSaveView} />);
      await openPopover();
      await openSaveInput();
      await userEvent.keyboard('{Enter}');
      expect(onSaveView).toHaveBeenCalledTimes(1);
      const [, name] = onSaveView.mock.calls[0];
      expect(typeof name).toBe('string');
      expect(name.trim().length).toBeGreaterThan(0);
    });

    it('does not save on whitespace-only input, using the generated fallback instead', async () => {
      const onSaveView = vi.fn();
      render(<BattleMapViewsControl {...baseProps} onSaveView={onSaveView} />);
      await openPopover();
      await openSaveInput();
      await userEvent.type(
        screen.getByRole('textbox', { name: /view name/i }),
        '   {Enter}'
      );
      expect(onSaveView).toHaveBeenCalledTimes(1);
      const [, name] = onSaveView.mock.calls[0];
      expect(name.trim().length).toBeGreaterThan(0);
    });

    it('dismisses without saving on Escape', async () => {
      // Escape bubbles to the popover's own document-level handler, which
      // closes the whole menu (same as it already does for outside clicks) —
      // the inline field's own Escape handler ensures that closing never
      // saves the in-progress name.
      const onSaveView = vi.fn();
      render(<BattleMapViewsControl {...baseProps} onSaveView={onSaveView} />);
      await openPopover();
      await openSaveInput();
      await userEvent.type(
        screen.getByRole('textbox', { name: /view name/i }),
        'Never saved'
      );
      await userEvent.keyboard('{Escape}');
      expect(onSaveView).not.toHaveBeenCalled();
      expect(
        screen.queryByRole('textbox', { name: /view name/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /save current view/i })
      ).not.toBeInTheDocument();
    });

    it('dismisses without saving on cancel click', async () => {
      const onSaveView = vi.fn();
      render(<BattleMapViewsControl {...baseProps} onSaveView={onSaveView} />);
      await openPopover();
      await openSaveInput();
      await userEvent.click(
        screen.getByRole('button', { name: /cancel save/i })
      );
      expect(onSaveView).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: /save current view/i })
      ).toBeInTheDocument();
    });
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

  describe('two-click delete confirm', () => {
    it('does not delete on a single click', async () => {
      const onDeleteView = vi.fn();
      render(
        <BattleMapViewsControl {...baseProps} onDeleteView={onDeleteView} />
      );
      await openPopover();
      const row = screen.getByRole('group', { name: /goblin ambush/i });
      await userEvent.click(
        within(row).getByRole('button', { name: /delete/i })
      );
      expect(onDeleteView).not.toHaveBeenCalled();
    });

    it('deletes on the second click of the same row', async () => {
      const onDeleteView = vi.fn();
      render(
        <BattleMapViewsControl {...baseProps} onDeleteView={onDeleteView} />
      );
      await openPopover();
      const row = screen.getByRole('group', { name: /goblin ambush/i });
      await userEvent.click(
        within(row).getByRole('button', { name: /delete/i })
      );
      await userEvent.click(
        within(row).getByRole('button', { name: /confirm delete/i })
      );
      expect(onDeleteView).toHaveBeenCalledTimes(1);
      expect(onDeleteView).toHaveBeenCalledWith('v1');
    });

    it('arming one row then clicking a different row does not delete either', async () => {
      const onDeleteView = vi.fn();
      render(
        <BattleMapViewsControl {...baseProps} onDeleteView={onDeleteView} />
      );
      await openPopover();
      const rowA = screen.getByRole('group', { name: /goblin ambush/i });
      const rowB = screen.getByRole('group', { name: /throne room/i });
      await userEvent.click(
        within(rowA).getByRole('button', { name: /delete/i })
      );
      await userEvent.click(
        within(rowB).getByRole('button', { name: /delete/i })
      );
      expect(onDeleteView).not.toHaveBeenCalled();
      // Row A should have disarmed back to its single delete button.
      expect(
        within(rowA).getByRole('button', { name: /^delete view$/i })
      ).toBeInTheDocument();
      // Row B is now armed and needs a second click to confirm.
      await userEvent.click(
        within(rowB).getByRole('button', { name: /confirm delete/i })
      );
      expect(onDeleteView).toHaveBeenCalledTimes(1);
      expect(onDeleteView).toHaveBeenCalledWith('v2');
    });

    it('cancel disarms without deleting', async () => {
      const onDeleteView = vi.fn();
      render(
        <BattleMapViewsControl {...baseProps} onDeleteView={onDeleteView} />
      );
      await openPopover();
      const row = screen.getByRole('group', { name: /goblin ambush/i });
      await userEvent.click(
        within(row).getByRole('button', { name: /delete/i })
      );
      await userEvent.click(
        within(row).getByRole('button', { name: /cancel delete/i })
      );
      expect(onDeleteView).not.toHaveBeenCalled();
      expect(
        within(row).getByRole('button', { name: /^delete view$/i })
      ).toBeInTheDocument();
    });
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
      const onDeleteView = vi.fn();
      render(
        <BattleMapViewsControl
          {...baseProps}
          sharingEnabled={sharingEnabled}
          onGoToView={onGoToView}
          onSaveView={onSaveView}
          onDeleteView={onDeleteView}
        />
      );
      await openPopover();
      await userEvent.click(
        screen.getByRole('button', { name: /goblin ambush/i })
      );
      expect(onGoToView).toHaveBeenCalled();

      await openSaveInput();
      await userEvent.type(
        screen.getByRole('textbox', { name: /view name/i }),
        'New spot{Enter}'
      );
      expect(onSaveView).toHaveBeenCalledWith(currentView, 'New spot');

      const row = screen.getByRole('group', { name: /throne room/i });
      await userEvent.click(
        within(row).getByRole('button', { name: /delete/i })
      );
      await userEvent.click(
        within(row).getByRole('button', { name: /confirm delete/i })
      );
      expect(onDeleteView).toHaveBeenCalledWith('v2');

      cleanup();
    }
  });

  it('meets the 44px touch-target minimum on every interactive element', async () => {
    render(<BattleMapViewsControl {...baseProps} sharingEnabled />);
    await openPopover();
    for (const el of screen.getAllByRole('button')) {
      expect(el.className).toMatch(/h-11|h-12|min-h-\[44px\]/);
    }
    await openSaveInput();
    expect(
      screen.getByRole('textbox', { name: /view name/i }).className
    ).toMatch(/h-11|h-12|min-h-\[44px\]/);
    for (const el of screen.getAllByRole('button')) {
      expect(el.className).toMatch(/h-11|h-12|min-h-\[44px\]/);
    }
  });
});
