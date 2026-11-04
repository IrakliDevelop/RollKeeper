import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyCodeButton } from './CopyCodeButton';

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

describe('CopyCodeButton', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('names the button with the code and shows the code', () => {
    render(<CopyCodeButton code="K7QX2M" />);
    const button = screen.getByRole('button', { name: 'Copy code K7QX2M' });
    expect(button).toHaveTextContent('K7QX2M');
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('copies the code and announces it', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<CopyCodeButton code="K7QX2M" />);
    await user.click(screen.getByRole('button', { name: 'Copy code K7QX2M' }));
    expect(writeText).toHaveBeenCalledWith('K7QX2M');
    expect(
      await screen.findByRole('button', { name: 'Code K7QX2M copied' })
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Code K7QX2M copied');
  });

  it('returns to the copy label after two seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyCodeButton code="K7QX2M" />);
    await user.click(screen.getByRole('button', { name: 'Copy code K7QX2M' }));
    expect(
      await screen.findByRole('button', { name: 'Code K7QX2M copied' })
    ).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(
      screen.getByRole('button', { name: 'Copy code K7QX2M' })
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('does not claim copied when the clipboard rejects', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    stubClipboard(writeText);
    render(<CopyCodeButton code="K7QX2M" />);
    await user.click(screen.getByRole('button', { name: 'Copy code K7QX2M' }));
    expect(writeText).toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Copy code K7QX2M' })
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('clears its timer on unmount', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(<CopyCodeButton code="K7QX2M" />);
    await user.click(screen.getByRole('button', { name: 'Copy code K7QX2M' }));
    await screen.findByRole('button', { name: 'Code K7QX2M copied' });
    unmount();
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(2000);
      });
    }).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
