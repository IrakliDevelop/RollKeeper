import { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImageLightbox } from './ImageLightbox';

const SRC = 'data:image/png;base64,cG9ydHJhaXQ=';

function renderLightbox() {
  const onClose = vi.fn();
  render(<ImageLightbox src={SRC} alt="Merchant Mo" onClose={onClose} />);
  return onClose;
}

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open portrait
      </button>
      {open && (
        <ImageLightbox
          src={SRC}
          alt="Merchant Mo"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

describe('ImageLightbox', () => {
  afterEach(cleanup);

  it('opens a dialog named for the image, with the image and no caption', () => {
    renderLightbox();

    const dialog = screen.getByRole('dialog', {
      name: 'Merchant Mo full-size image',
    });
    expect(dialog).not.toHaveAttribute('aria-describedby');
    expect(screen.getByRole('img', { name: 'Merchant Mo' })).toHaveAttribute(
      'src',
      SRC
    );
    expect(screen.queryByText(/right-click/i)).toBeNull();
  });

  it('gives the close button a 44px target', () => {
    renderLightbox();

    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveClass('min-h-[44px]', 'min-w-[44px]');
  });

  it('calls onClose once on Escape', async () => {
    const user = userEvent.setup();
    const onClose = renderLightbox();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose once from the Close button', async () => {
    const user = userEvent.setup();
    const onClose = renderLightbox();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the button that opened it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const openButton = screen.getByRole('button', { name: 'Open portrait' });

    await user.click(openButton);
    await user.keyboard('{Escape}');

    await waitFor(() => expect(openButton).toHaveFocus());
  });
});
