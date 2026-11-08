import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoSheet } from './DemoSheet';

describe('DemoSheet', () => {
  beforeEach(() => {
    // The medallions' score editor asks for (min-width: 640px).
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: true,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('changes the sample character without writing to browser storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const open = vi.fn();
    vi.stubGlobal('indexedDB', { open });
    const user = userEvent.setup();
    render(<DemoSheet />);

    expect(screen.getByText('Healthy')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Take 12 damage' }));
    expect(screen.getByText('Bloodied')).toBeInTheDocument();
    expect(screen.getByText('26')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add 5 temp HP' }));
    expect(screen.getByText('+5 temp')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Heal 7' }));
    expect(screen.getByText('33')).toBeInTheDocument();

    expect(
      screen.getByLabelText('3 of 4 level 1 slots available')
    ).toBeInTheDocument();

    const inspiration = screen.getByRole('button', {
      name: 'Heroic inspiration',
    });
    expect(inspiration).toHaveAttribute('aria-pressed', 'true');
    await user.click(inspiration);
    expect(inspiration).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Take a long rest' }));
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(
      screen.getByText('38', { selector: '.type-num-xl' })
    ).toBeInTheDocument();
    expect(screen.queryByText('+5 temp')).toBeNull();

    expect(setItem).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('absorbs damage with temporary HP first', async () => {
    const user = userEvent.setup();
    render(<DemoSheet />);
    await user.click(screen.getByRole('button', { name: 'Add 5 temp HP' }));
    await user.click(screen.getByRole('button', { name: 'Take 12 damage' }));
    expect(screen.getByText('31')).toBeInTheDocument();
    expect(screen.queryByText('+5 temp')).toBeNull();
  });
});
