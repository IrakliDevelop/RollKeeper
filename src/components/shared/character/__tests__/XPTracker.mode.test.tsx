import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { XPTracker } from '../XPTracker';
afterEach(cleanup);
it('keeps Add XP live while gating Set XP to edit mode', () => {
  const add = vi.fn();
  const set = vi.fn();
  const p = { currentXP: 100, currentLevel: 1, onAddXP: add, onSetXP: set };
  const { rerender } = render(<XPTracker {...p} editing={false} />);
  expect(screen.queryByRole('switch', { name: 'Set XP' })).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: 'XP to add' }), {
    target: { value: '300' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(add).toHaveBeenCalledWith(300);
  rerender(<XPTracker {...p} editing />);
  fireEvent.click(screen.getByRole('switch', { name: 'Set XP' }));
  expect(screen.getByRole('textbox', { name: 'Total XP' })).toBeVisible();
  rerender(<XPTracker {...p} editing={false} />);
  expect(screen.queryByRole('textbox', { name: 'Total XP' })).toBeNull();
});
