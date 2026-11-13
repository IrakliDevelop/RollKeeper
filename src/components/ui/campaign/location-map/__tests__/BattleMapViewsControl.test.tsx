import { useState } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  waitFor,
  within,
} from '@testing-library/react';
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

function getTrigger() {
  return screen.getByRole('button', { name: /^views$/i });
}

function getDialog() {
  return screen.getByRole('dialog', { name: 'Views' });
}

function expectFocusInsideDialog() {
  expect(getDialog().contains(document.activeElement)).toBe(true);
}

/** Owns the list so a confirmed delete really removes the row. */
function DeletingHarness() {
  const [list, setList] = useState(views);
  return (
    <BattleMapViewsControl
      {...baseProps}
      views={list}
      onDeleteView={id => setList(l => l.filter(v => v.id !== id))}
    />
  );
}

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

describe('BattleMapViewsControl', () => {
  it('opens a named Radix popover from an outline trigger', async () => {
    const { container } = render(
      <div data-testid="cramped-toolbar" className="overflow-hidden">
        <BattleMapViewsControl {...baseProps} />
      </div>
    );
    const trigger = getTrigger();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('data-variant', 'ghost');
    expect(trigger).not.toHaveAttribute('data-selected');

    await userEvent.click(trigger);
    const popover = getDialog();
    expect(popover).toHaveAttribute('data-testid', 'battle-map-views-popover');
    expect(document.body.contains(popover)).toBe(true);
    expect(container.contains(popover)).toBe(false);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('data-selected', 'true');
    expect(trigger).toHaveAttribute('data-variant', 'ghost');

    await userEvent.click(
      within(popover).getByRole('button', { name: /save current view/i })
    );
    expect(getDialog()).toBeInTheDocument();
  });

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
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /goblin ambush/i })
      ).not.toBeInTheDocument()
    );
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
      expect(
        screen.getByRole('button', { name: /save current view/i })
      ).toHaveFocus();
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

    it('Escape cancels the open save field before closing the popover', async () => {
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
        screen.getByRole('button', { name: /save current view/i })
      ).toHaveFocus();
      expectFocusInsideDialog();
      expect(getDialog()).toBeInTheDocument();

      // Tab stays inside the popover instead of dismissing it.
      await userEvent.tab();
      expect(getDialog()).toBeInTheDocument();
      expectFocusInsideDialog();

      await userEvent.keyboard('{Escape}');
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      );
      await waitFor(() => expect(getTrigger()).toHaveFocus());
      expect(onSaveView).not.toHaveBeenCalled();
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
      ).toHaveFocus();
      expectFocusInsideDialog();
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
    // Focus returns to the row (its name button), not to <body>.
    expect(
      within(row).getByRole('button', { name: /throne room/i })
    ).toHaveFocus();
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
        within(row).getByRole('button', { name: /^delete view$/i })
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
        within(row).getByRole('button', { name: /^delete view$/i })
      );
      await userEvent.click(
        within(row).getByRole('button', { name: 'Delete' })
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
        within(rowA).getByRole('button', { name: /^delete view$/i })
      );
      await userEvent.click(
        within(rowB).getByRole('button', { name: /^delete view$/i })
      );
      expect(onDeleteView).not.toHaveBeenCalled();
      // Row A should have disarmed back to its single delete button.
      expect(
        within(rowA).getByRole('button', { name: /^delete view$/i })
      ).toBeInTheDocument();
      // Row B is now armed and needs a second click to confirm.
      await userEvent.click(
        within(rowB).getByRole('button', { name: 'Delete' })
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
        within(row).getByRole('button', { name: /^delete view$/i })
      );
      await userEvent.click(
        within(row).getByRole('button', { name: 'Cancel' })
      );
      expect(onDeleteView).not.toHaveBeenCalled();
      expect(
        within(row).getByRole('button', { name: /^delete view$/i })
      ).toBeInTheDocument();
    });

    it('arms delete as text buttons', async () => {
      const onDeleteView = vi.fn();
      render(
        <BattleMapViewsControl
          {...baseProps}
          sharingEnabled
          onDeleteView={onDeleteView}
        />
      );
      await openPopover();
      const row = screen.getByRole('group', { name: /goblin ambush/i });
      const trash = within(row).getByRole('button', { name: 'Delete view' });
      expect(trash).toHaveAttribute('data-variant', 'danger');
      await userEvent.click(trash);

      const confirm = within(row).getByRole('button', { name: 'Delete' });
      expect(confirm).toHaveAttribute('data-variant', 'danger-solid');
      expect(confirm).toHaveTextContent('Delete');
      const cancel = within(row).getByRole('button', { name: 'Cancel' });
      expect(cancel).toHaveTextContent('Cancel');
      expect(
        within(row).queryByRole('button', { name: 'Send view' })
      ).not.toBeInTheDocument();
      expect(
        within(row).queryByRole('button', { name: 'Rename view' })
      ).not.toBeInTheDocument();
      expect(
        within(row).queryByRole('button', { name: 'Delete view' })
      ).not.toBeInTheDocument();
      // The view's own button stays so the DM can see what they are deleting.
      expect(
        within(row).getByRole('button', { name: /goblin ambush/i })
      ).toBeInTheDocument();

      await userEvent.click(cancel);
      expect(onDeleteView).not.toHaveBeenCalled();
      expect(
        within(row).getByRole('button', { name: 'Send view' })
      ).toBeInTheDocument();
      expect(
        within(row).getByRole('button', { name: 'Rename view' })
      ).toBeInTheDocument();
      expect(
        within(row).queryByRole('button', { name: 'Delete' })
      ).not.toBeInTheDocument();

      await userEvent.click(
        within(row).getByRole('button', { name: 'Delete view' })
      );
      await userEvent.click(
        within(row).getByRole('button', { name: 'Delete' })
      );
      expect(onDeleteView).toHaveBeenCalledTimes(1);
      expect(onDeleteView).toHaveBeenCalledWith('v1');
    });

    it('Enter on the trash arms the delete and lands focus on Cancel', async () => {
      const onDeleteView = vi.fn();
      render(
        <BattleMapViewsControl {...baseProps} onDeleteView={onDeleteView} />
      );
      await openPopover();
      const row = screen.getByRole('group', { name: /goblin ambush/i });
      const trash = within(row).getByRole('button', { name: 'Delete view' });
      trash.focus();
      expect(trash).toHaveFocus();

      await userEvent.keyboard('{Enter}');
      expect(onDeleteView).not.toHaveBeenCalled();
      expect(within(row).getByRole('button', { name: 'Cancel' })).toHaveFocus();

      // A second Enter lands on the safe choice and restores the row.
      await userEvent.keyboard('{Enter}');
      expect(onDeleteView).not.toHaveBeenCalled();
      expect(
        within(row).queryByRole('button', { name: 'Delete' })
      ).not.toBeInTheDocument();
      expect(
        within(row).getByRole('button', { name: /goblin ambush/i })
      ).toHaveFocus();
      expectFocusInsideDialog();
    });

    it('keeps focus inside the popover after a keyboard delete removes the row', async () => {
      render(<DeletingHarness />);
      await openPopover();
      const row = screen.getByRole('group', { name: /goblin ambush/i });
      within(row).getByRole('button', { name: 'Delete view' }).focus();
      await userEvent.keyboard('{Enter}');
      await userEvent.tab({ shift: true });
      expect(within(row).getByRole('button', { name: 'Delete' })).toHaveFocus();

      await userEvent.keyboard('{Enter}');
      expect(
        screen.queryByRole('group', { name: /goblin ambush/i })
      ).not.toBeInTheDocument();
      expect(getDialog()).toBeInTheDocument();
      // The row is gone, so focus lands on the one control that is always
      // there, not on the content div (no container focus ring).
      expect(
        screen.getByRole('button', { name: 'Save current view' })
      ).toHaveFocus();
    });
  });

  describe('Escape and closing', () => {
    it('Escape cancels an open rename before closing', async () => {
      const onRenameView = vi.fn();
      render(
        <BattleMapViewsControl {...baseProps} onRenameView={onRenameView} />
      );
      await openPopover();
      const row = screen.getByRole('group', { name: /throne room/i });
      await userEvent.click(
        within(row).getByRole('button', { name: 'Rename view' })
      );
      expect(
        screen.getByRole('textbox', { name: 'Rename view' })
      ).toBeInTheDocument();

      await userEvent.keyboard('{Escape}');
      expect(
        screen.queryByRole('textbox', { name: 'Rename view' })
      ).not.toBeInTheDocument();
      expect(getDialog()).toBeInTheDocument();
      expect(
        within(row).getByRole('button', { name: 'Rename view' })
      ).toBeInTheDocument();
      expect(
        within(row).getByRole('button', { name: /throne room/i })
      ).toHaveFocus();
      expectFocusInsideDialog();

      await userEvent.keyboard('{Escape}');
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      );
      await waitFor(() => expect(getTrigger()).toHaveFocus());
      expect(onRenameView).not.toHaveBeenCalled();
    });

    it('Escape disarms an armed delete before closing', async () => {
      const onDeleteView = vi.fn();
      render(
        <BattleMapViewsControl {...baseProps} onDeleteView={onDeleteView} />
      );
      await openPopover();
      const row = screen.getByRole('group', { name: /goblin ambush/i });
      await userEvent.click(
        within(row).getByRole('button', { name: 'Delete view' })
      );
      expect(
        within(row).getByRole('button', { name: 'Delete' })
      ).toBeInTheDocument();

      await userEvent.keyboard('{Escape}');
      expect(
        within(row).queryByRole('button', { name: 'Delete' })
      ).not.toBeInTheDocument();
      expect(
        within(row).getByRole('button', { name: 'Delete view' })
      ).toBeInTheDocument();
      expect(
        within(row).getByRole('button', { name: /goblin ambush/i })
      ).toHaveFocus();
      expectFocusInsideDialog();
      expect(getDialog()).toBeInTheDocument();

      await userEvent.keyboard('{Escape}');
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      );
      await waitFor(() => expect(getTrigger()).toHaveFocus());
      expect(onDeleteView).not.toHaveBeenCalled();
    });

    it('closing by an outside click clears an open rename', async () => {
      render(<BattleMapViewsControl {...baseProps} />);
      await openPopover();
      const row = screen.getByRole('group', { name: /throne room/i });
      await userEvent.click(
        within(row).getByRole('button', { name: 'Rename view' })
      );
      expect(
        screen.getByRole('textbox', { name: 'Rename view' })
      ).toBeInTheDocument();

      await userEvent.click(document.body);
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      );

      await openPopover();
      expect(getDialog()).toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', { name: 'Rename view' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Delete' })
      ).not.toBeInTheDocument();
    });

    it('closing from the trigger clears an armed delete and an open save field', async () => {
      render(<BattleMapViewsControl {...baseProps} />);
      await openPopover();
      await openSaveInput();
      const row = screen.getByRole('group', { name: /goblin ambush/i });
      await userEvent.click(
        within(row).getByRole('button', { name: 'Delete view' })
      );
      // Arming the delete leaves the save field alone; both are open.
      expect(
        screen.getByRole('textbox', { name: /view name/i })
      ).toBeInTheDocument();
      expect(
        within(row).getByRole('button', { name: 'Delete' })
      ).toBeInTheDocument();

      await userEvent.click(getTrigger());
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      );

      await openPopover();
      expect(getDialog()).toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', { name: /view name/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Delete' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', { name: 'Rename view' })
      ).not.toBeInTheDocument();
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
        within(row).getByRole('button', { name: /^delete view$/i })
      );
      await userEvent.click(
        within(row).getByRole('button', { name: 'Delete' })
      );
      expect(onDeleteView).toHaveBeenCalledWith('v2');

      cleanup();
    }
  });

  it('Send stays disabled while sharing is off', async () => {
    const onSend = vi.fn();
    render(<BattleMapViewsControl {...baseProps} onSend={onSend} />);
    await openPopover();
    const row = screen.getByRole('group', { name: /goblin ambush/i });
    const send = within(row).getByRole('button', { name: 'Send view' });
    expect(send).toBeDisabled();
    await userEvent.click(send);
    expect(onSend).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /bring them to my view/i })
    ).toBeDisabled();

    // Rename and an armed delete hide Send for the row; it never fires.
    await userEvent.click(
      within(row).getByRole('button', { name: 'Rename view' })
    );
    expect(
      within(row).queryByRole('button', { name: 'Send view' })
    ).not.toBeInTheDocument();
    await userEvent.click(
      within(row).getByRole('button', { name: 'Cancel rename' })
    );
    await userEvent.click(
      within(row).getByRole('button', { name: 'Delete view' })
    );
    expect(
      within(row).queryByRole('button', { name: 'Send view' })
    ).not.toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('every popover button is a design-system Button', async () => {
    render(<BattleMapViewsControl {...baseProps} sharingEnabled />);
    await openPopover();
    const expectAllButtonsHaveVariant = () => {
      for (const button of within(getDialog()).getAllByRole('button')) {
        expect(button).toHaveAttribute('data-variant');
      }
    };
    expectAllButtonsHaveVariant();

    await openSaveInput();
    const row = screen.getByRole('group', { name: /throne room/i });
    await userEvent.click(
      within(row).getByRole('button', { name: 'Rename view' })
    );
    expectAllButtonsHaveVariant();

    await userEvent.click(
      within(row).getByRole('button', { name: 'Cancel rename' })
    );
    await userEvent.click(
      within(row).getByRole('button', { name: 'Delete view' })
    );
    expectAllButtonsHaveVariant();
  });
});
