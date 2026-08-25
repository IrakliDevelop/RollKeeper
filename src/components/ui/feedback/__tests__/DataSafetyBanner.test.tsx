import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataSafetyBanner } from '@/components/ui/feedback/DataSafetyBanner';
import { expectCloudProductVocabulary } from '@/test/helpers';

describe('DataSafetyBanner', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders the safety reminder and uses R17-clean product vocabulary', async () => {
    const onExport = vi.fn();
    const { container } = render(<DataSafetyBanner onExport={onExport} />);

    await screen.findByText(/saved only in this browser/i);
    expect(
      screen.getByText(/clearing browser data or switching browsers/i)
    ).toBeInTheDocument();
    // Coordinator review round 1, Minor 4: this surface's copy changed
    // ("switching devices" -> "switching browsers") with no vocabulary
    // guard and no test file at all.
    expectCloudProductVocabulary(container);
  });

  it('exports and dismisses on their respective buttons', async () => {
    const onExport = vi.fn();
    render(<DataSafetyBanner onExport={onExport} />);

    await screen.findByText(/saved only in this browser/i);
    fireEvent.click(screen.getByText('Export All'));
    expect(onExport).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() =>
      expect(screen.queryByText(/saved only in this browser/i)).toBeNull()
    );
    expect(localStorage.getItem('rollkeeper-data-warning-dismissed')).toBe(
      'true'
    );
  });

  it('stays hidden once dismissal was already persisted', () => {
    localStorage.setItem('rollkeeper-data-warning-dismissed', 'true');
    const { container } = render(<DataSafetyBanner onExport={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
