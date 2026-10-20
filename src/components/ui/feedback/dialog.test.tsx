import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

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
