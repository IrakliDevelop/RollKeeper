import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_BANNER_SIZE_BYTES } from '@/utils/constants';
import {
  answerConfirmDialogs,
  clickConfirmDialogButton,
  findConfirmDialog,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';

import { BannerImageControls } from './BannerImageControls';

const OLD = 'https://rollkeeper-images.s3.amazonaws.com/old.png';
const NEW = 'https://rollkeeper-images.s3.amazonaws.com/new.png';
const FAILED = "The banner wasn't uploaded. Try again.";

function chooseFile(container: HTMLElement, file: File) {
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [file] },
  });
}

const imageFile = () => new File(['x'], 'map.png', { type: 'image/png' });

describe('BannerImageControls', () => {
  const onBannerChange = vi.fn();

  beforeEach(() => {
    onBannerChange.mockReset();
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('offers Add image when no banner is set', () => {
    render(
      <BannerImageControls campaignCode="K7QX2M" onBannerChange={vi.fn()} />
    );
    expect(
      screen.getByRole('button', { name: 'Add image' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove image' })).toBeNull();
  });

  it('offers Change image and Remove image when a banner is set', () => {
    render(
      <BannerImageControls
        bannerUrl={OLD}
        campaignCode="K7QX2M"
        onBannerChange={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Change image' })).toHaveClass(
      'lg:w-full'
    );
    expect(
      screen.getByRole('button', { name: 'Remove image' })
    ).toHaveAttribute('data-variant', 'danger');
  });

  it('rejects a file that is not an image', () => {
    const { container } = render(
      <BannerImageControls
        campaignCode="K7QX2M"
        onBannerChange={onBannerChange}
      />
    );
    chooseFile(container, new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose an image file.'
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects an image over the size limit', () => {
    const { container } = render(
      <BannerImageControls
        campaignCode="K7QX2M"
        onBannerChange={onBannerChange}
      />
    );
    const file = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: MAX_BANNER_SIZE_BYTES + 1 });
    chooseFile(container, file);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose an image under 10 MB.'
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('never shows server error text', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'S3 bucket not configured' }),
    } as Response);
    const { container } = render(
      <BannerImageControls
        campaignCode="K7QX2M"
        onBannerChange={onBannerChange}
      />
    );
    chooseFile(container, imageFile());
    expect(await screen.findByRole('alert')).toHaveTextContent(FAILED);
    expect(screen.queryByText(/S3 bucket/)).toBeNull();
    expect(onBannerChange).not.toHaveBeenCalled();
  });

  it('shows the same error when the request throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    const { container } = render(
      <BannerImageControls
        campaignCode="K7QX2M"
        onBannerChange={onBannerChange}
      />
    );
    chooseFile(container, imageFile());
    expect(await screen.findByRole('alert')).toHaveTextContent(FAILED);
    expect(onBannerChange).not.toHaveBeenCalled();
  });

  it('treats an upload response without a url as a failure', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    const { container } = render(
      <BannerImageControls
        campaignCode="K7QX2M"
        onBannerChange={onBannerChange}
      />
    );
    chooseFile(container, imageFile());
    expect(await screen.findByRole('alert')).toHaveTextContent(FAILED);
    expect(onBannerChange).not.toHaveBeenCalled();
  });

  it('clears the error on a new attempt', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ url: NEW }),
    } as Response);
    const { container } = render(
      <BannerImageControls
        campaignCode="K7QX2M"
        onBannerChange={onBannerChange}
      />
    );
    chooseFile(container, new File(['x'], 'a.txt', { type: 'text/plain' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    chooseFile(container, imageFile());
    await waitFor(() => expect(onBannerChange).toHaveBeenCalledWith(NEW));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('uploads the image and deletes the old S3 banner', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: NEW }),
      } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);
    const { container } = render(
      <BannerImageControls
        bannerUrl={OLD}
        campaignCode="K7QX2M"
        onBannerChange={onBannerChange}
      />
    );
    chooseFile(container, imageFile());
    await waitFor(() => expect(onBannerChange).toHaveBeenCalledWith(NEW));
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/banner/upload',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      `/api/banner/delete?url=${encodeURIComponent(OLD)}`,
      { method: 'DELETE' }
    );
  });

  it('keeps a successful upload when deleting the old banner fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: NEW }),
      } as Response)
      .mockRejectedValueOnce(new Error('offline'));
    const { container } = render(
      <BannerImageControls
        bannerUrl={OLD}
        campaignCode="K7QX2M"
        onBannerChange={onBannerChange}
      />
    );
    chooseFile(container, imageFile());
    await waitFor(() => expect(onBannerChange).toHaveBeenCalledWith(NEW));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('disables the buttons while the upload runs', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    const { container } = render(
      <BannerImageControls
        bannerUrl={OLD}
        campaignCode="K7QX2M"
        onBannerChange={onBannerChange}
      />
    );
    chooseFile(container, imageFile());
    expect(screen.getByRole('button', { name: 'Change image' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove image' })).toBeDisabled();
  });

  it('asks before removing the banner and keeps it on Cancel', async () => {
    renderConfirmDialogHost();
    render(
      <BannerImageControls
        bannerUrl={OLD}
        campaignCode="K7QX2M"
        onBannerChange={onBannerChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    const dialog = await findConfirmDialog();
    expect(dialog).toHaveTextContent('Remove the banner image?');
    expect(dialog).toHaveTextContent(
      'The image is removed from this page and the campaign card.'
    );
    await clickConfirmDialogButton('Cancel');
    expect(onBannerChange).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('deletes an S3 banner after confirming', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    renderConfirmDialogHost();
    answerConfirmDialogs('confirm');
    render(
      <BannerImageControls
        bannerUrl={OLD}
        campaignCode="K7QX2M"
        onBannerChange={onBannerChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    await waitFor(() => expect(onBannerChange).toHaveBeenCalledWith(undefined));
    expect(fetch).toHaveBeenCalledWith(
      `/api/banner/delete?url=${encodeURIComponent(OLD)}`,
      { method: 'DELETE' }
    );
  });

  it('removes a banner stored elsewhere without a delete call', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    renderConfirmDialogHost();
    answerConfirmDialogs('confirm');
    render(
      <BannerImageControls
        bannerUrl="/landing/battle-map.webp"
        campaignCode="K7QX2M"
        onBannerChange={onBannerChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    await waitFor(() => expect(onBannerChange).toHaveBeenCalledWith(undefined));
    expect(fetch).not.toHaveBeenCalled();
  });
});
