import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DeviceRecoveryControls } from '@/components/ui/feedback/DeviceRecoveryControls';
import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';

vi.mock('@/lib/browserRecoveryRepository', () => ({
  browserRecoveryRepository: {
    recordDownloadReceipt: vi.fn().mockResolvedValue(undefined),
    stageGeneration: vi.fn().mockResolvedValue(undefined),
    activateGeneration: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('DeviceRecoveryControls', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"characters":[]},"version":1}'
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:device-backup');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('offers a full-device Blob backup and stages imported recovery files inactive', async () => {
    const { container } = render(<DeviceRecoveryControls />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Download device backup' })
    );
    await screen.findByText('Full device backup download initiated.');
    expect(
      browserRecoveryRepository.recordDownloadReceipt
    ).toHaveBeenCalledOnce();

    const downloadedBlob = vi.mocked(URL.createObjectURL).mock
      .calls[0][0] as Blob;
    const recoveryFile = new File(
      [await downloadedBlob.text()],
      'backup.json',
      {
        type: 'application/json',
      }
    );
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [recoveryFile] },
    });

    await screen.findByRole('heading', { name: 'Recovery preview' });
    expect(browserRecoveryRepository.stageGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'inactive' })
    );
    expect(screen.getByText(/1 entr/)).toBeInTheDocument();
    expect(screen.getByText(/version 1/)).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Restore selected entries' })
      ).toBeDisabled()
    );
  });
});
