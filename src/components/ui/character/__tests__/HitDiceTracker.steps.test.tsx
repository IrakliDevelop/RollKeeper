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

const noop = vi.fn();

it('has no per-die bulk buttons, only pips and the restore-all-dice trailing button', () => {
  render(
    <HitDiceTracker
      hitDicePools={{ d10: { max: 5, used: 2 }, d8: { max: 3, used: 0 } }}
      onUseHitDie={noop}
      onRestoreHitDice={noop}
      onResetAllHitDice={noop}
    />
  );
  expect(screen.queryAllByRole('button', { name: /^Use \d/ })).toHaveLength(0);
  expect(
    screen.queryAllByRole('button', { name: /^Restore (1|all) d/ })
  ).toHaveLength(0);
  expect(
    screen.getAllByRole('button', { name: /^(Use|Restore) a d\d+ hit die$/ })
  ).toHaveLength(8);
  expect(
    screen.getByRole('button', { name: 'Restore all hit dice' })
  ).toBeTruthy();
});

it('keeps the die label, pips and availability on one row per die', () => {
  render(
    <HitDiceTracker
      hitDicePools={{ d10: { max: 5, used: 2 } }}
      onUseHitDie={noop}
      onRestoreHitDice={noop}
      onResetAllHitDice={noop}
    />
  );
  const row = screen.getByRole('group', {
    name: 'd10 hit dice: 3 of 5 available',
  });
  expect(row.className).toContain('flex-wrap');
  expect(row.className).toContain('py-2');
  expect(row.textContent).toContain('3 / 5');
  expect(row.querySelectorAll('button')).toHaveLength(5);
});

it('shows the empty state and no restore-all button with no pools', () => {
  render(
    <HitDiceTracker
      hitDicePools={{}}
      onUseHitDie={noop}
      onRestoreHitDice={noop}
      onResetAllHitDice={noop}
    />
  );
  expect(screen.getByText('Add a class level to get hit dice.')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});
