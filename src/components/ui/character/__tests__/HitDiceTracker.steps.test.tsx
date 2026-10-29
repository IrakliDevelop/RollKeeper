import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import HitDiceTracker from '../HitDiceTracker';
afterEach(cleanup);
it('uses or restores exactly one die regardless of pip position', () => {
  const use = vi.fn();
  const restore = vi.fn();
  const all = vi.fn();
  render(
    <HitDiceTracker
      hitDicePools={{ d10: { max: 5, used: 2 } }}
      onUseHitDie={use}
      onRestoreHitDice={restore}
      onResetAllHitDice={all}
    />
  );
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Use a d10 hit die' })[0]
  );
  expect(use).toHaveBeenCalledExactlyOnceWith('d10', 1);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Restore a d10 hit die' })[1]
  );
  expect(restore).toHaveBeenCalledExactlyOnceWith('d10', 1);
  fireEvent.click(screen.getByRole('button', { name: 'Restore all hit dice' }));
  expect(all).toHaveBeenCalledOnce();
});
