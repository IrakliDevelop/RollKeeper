import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './dialog';

function renderDialog(props: {
  contentClassName?: string;
  titleClassName?: string;
}) {
  render(
    <Dialog open>
      <DialogContent className={props.contentClassName}>
        <DialogTitle className={props.titleClassName}>Long rest</DialogTitle>
        <DialogDescription>
          Recover hit points and spell slots.
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
  return screen.getByRole('dialog', { name: 'Long rest' });
}

describe('Dialog', () => {
  afterEach(cleanup);

  it('sits on the elevated surface with a 1px divider, 6px radius and the overlay shadow', () => {
    const dialog = renderDialog({});

    expect(dialog).toHaveClass(
      'bg-surface-elevated',
      'border',
      'border-divider',
      'rounded-md',
      'shadow-overlay'
    );
    expect(dialog.className).not.toMatch(
      /rounded-xl|border-2|shadow-2xl|bg-surface-raised/
    );
  });

  it('dims the page with the overlay token and no blur', () => {
    renderDialog({});

    const overlay = document.body.querySelector(
      '[data-state="open"].fixed.inset-0'
    );
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveClass('bg-surface-overlay');
    expect(overlay!.className).not.toMatch(/backdrop-blur|bg-black/);
  });

  it('enters and leaves over 180ms, easing out', () => {
    const dialog = renderDialog({});
    const overlay = document.body.querySelector(
      '[data-state="open"].fixed.inset-0'
    );

    expect(dialog).toHaveClass('duration-180', 'ease-out');
    expect(overlay).toHaveClass('duration-180', 'ease-out');
  });

  it('sets the title in the heading type step', () => {
    renderDialog({});

    const title = screen.getByRole('heading', { name: 'Long rest' });
    expect(title).toHaveClass('type-heading', 'text-heading');
    expect(title.className).not.toMatch(/text-xl|font-semibold/);
  });

  it("keeps a caller's title size alongside the heading face", () => {
    renderDialog({ titleClassName: 'text-2xl sm:text-3xl' });

    expect(screen.getByRole('heading', { name: 'Long rest' })).toHaveClass(
      'type-heading',
      'text-2xl',
      'sm:text-3xl'
    );
  });

  it("lets a caller's radius replace the object radius", () => {
    const dialog = renderDialog({ contentClassName: 'rounded-[18px] p-0' });

    expect(dialog).toHaveClass('rounded-[18px]', 'p-0');
    expect(dialog).not.toHaveClass('rounded-md');
    expect(dialog).not.toHaveClass('p-6');
  });

  it('gives the close button a 44px target and the brass focus outline', () => {
    renderDialog({});

    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveAttribute('type', 'button');
    expect(close).toHaveClass(
      'min-h-[44px]',
      'min-w-[44px]',
      'focus-visible:outline-2',
      'focus-visible:outline-ring'
    );
    expect(close.className).not.toMatch(/ring-emerald|ring-offset/);
  });
});

/** A controlled dialog opened from a plain button, like RestDialog. */
function ControlledDialog({
  onCloseAutoFocus,
  removeOpenerOnOpen = false,
  autoFocusField = false,
  modal = true,
}: {
  onCloseAutoFocus?: (event: Event) => void;
  removeOpenerOnOpen?: boolean;
  autoFocusField?: boolean;
  modal?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      {!(open && removeOpenerOnOpen) && (
        <button type="button" onClick={() => setOpen(true)}>
          Rest
        </button>
      )}
      <button type="button">Elsewhere</button>
      <Dialog open={open} onOpenChange={setOpen} modal={modal}>
        <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
          <DialogTitle>Long rest</DialogTitle>
          <DialogDescription>Recover hit points.</DialogDescription>
          {autoFocusField && <input aria-label="Note" autoFocus />}
        </DialogContent>
      </Dialog>
    </>
  );
}

describe('Dialog focus return', () => {
  afterEach(cleanup);

  it('puts focus back on the button that opened a controlled dialog', async () => {
    const user = userEvent.setup();
    render(<ControlledDialog />);

    await user.click(screen.getByRole('button', { name: 'Rest' }));
    await screen.findByRole('dialog', { name: 'Long rest' });
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Rest' })).toHaveFocus()
    );
  });

  it('puts focus back after a dialog whose field takes focus with autoFocus', async () => {
    const user = userEvent.setup();
    render(<ControlledDialog autoFocusField />);

    await user.click(screen.getByRole('button', { name: 'Rest' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Note' })).toHaveFocus()
    );
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Rest' })).toHaveFocus()
    );
  });

  it('leaves focus where a click outside a non-modal dialog put it', async () => {
    const user = userEvent.setup();
    render(<ControlledDialog modal={false} />);

    await user.click(screen.getByRole('button', { name: 'Rest' }));
    await screen.findByRole('dialog', { name: 'Long rest' });
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
  });

  it("leaves focus to a caller's handler that prevents the default", async () => {
    const user = userEvent.setup();
    const onCloseAutoFocus = vi.fn((event: Event) => {
      event.preventDefault();
      screen.getByRole('button', { name: 'Elsewhere' }).focus();
    });
    render(<ControlledDialog onCloseAutoFocus={onCloseAutoFocus} />);

    await user.click(screen.getByRole('button', { name: 'Rest' }));
    await screen.findByRole('dialog', { name: 'Long rest' });
    await user.keyboard('{Escape}');

    await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
  });

  it('falls back to the page when the opener is gone', async () => {
    const user = userEvent.setup();
    render(<ControlledDialog removeOpenerOnOpen />);

    await user.click(screen.getByRole('button', { name: 'Rest' }));
    await screen.findByRole('dialog', { name: 'Long rest' });
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(document.body));
  });
});
