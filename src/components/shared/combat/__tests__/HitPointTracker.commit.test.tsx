import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HitPointTracker } from '../HitPointTracker';
afterEach(cleanup);
it('does not change the HP tier or send a target while typing', () => {
  const target = vi.fn();
  const { container } = render(
    <HitPointTracker
      hitPoints={{
        current: 9,
        max: 40,
        temporary: 3,
        calculationMode: 'manual',
      }}
      onSetCurrentHitPoints={target}
    />
  );
  const field = screen.getByRole('textbox', { name: 'Current HP' });
  fireEvent.change(field, { target: { value: '1' } });
  fireEvent.change(field, { target: { value: '15' } });
  expect(container.querySelector('[data-hp-status]')).toHaveAttribute(
    'data-hp-status',
    'critical'
  );
  expect(target).not.toHaveBeenCalled();
  fireEvent.keyDown(field, { key: 'Enter' });
  fireEvent.blur(field);
  expect(target).toHaveBeenCalledExactlyOnceWith(15);
});
it('cancels a max HP draft on leaving edit mode', () => {
  const update = vi.fn();
  const p = {
    hitPoints: {
      current: 9,
      max: 40,
      temporary: 0,
      calculationMode: 'manual' as const,
    },
    onUpdateHitPoints: update,
  };
  const { rerender } = render(<HitPointTracker {...p} editing />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Max HP' }), {
    target: { value: '52' },
  });
  rerender(<HitPointTracker {...p} editing={false} />);
  rerender(<HitPointTracker {...p} editing />);
  expect(screen.getByRole('textbox', { name: 'Max HP' })).toHaveValue('40');
  expect(update).not.toHaveBeenCalled();
});
it('uses single-step death save pips with action labels', () => {
  const save = vi.fn();
  const update = vi.fn();
  render(
    <HitPointTracker
      hitPoints={{
        current: 0,
        max: 40,
        temporary: 0,
        calculationMode: 'manual',
        deathSaves: { successes: 1, failures: 0, isStabilized: false },
      }}
      onMakeDeathSave={save}
      onUpdateHitPoints={update}
    />
  );
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Mark a death save success' })[1]
  );
  expect(save).toHaveBeenCalledExactlyOnceWith(true, false);
  const clear = screen.getByRole('button', {
    name: 'Clear a death save success',
  });
  expect(clear).not.toHaveAttribute('aria-pressed');
  fireEvent.click(clear);
  expect(update).toHaveBeenCalledWith({
    deathSaves: { successes: 0, failures: 0, isStabilized: false },
  });
});

it('cancels a dirty HP draft on first Escape and closes its parent on second', async () => {
  const { useState } = await import('react');
  const { Dialog, DialogContent, DialogTitle } = await import(
    '@/components/ui/feedback/dialog'
  );
  const user = (await import('@testing-library/user-event')).default.setup();
  const target = vi.fn();
  function Host() {
    const [open, setOpen] = useState(true);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Hit points</DialogTitle>
          <HitPointTracker
            hitPoints={{
              current: 9,
              max: 40,
              temporary: 0,
              calculationMode: 'manual',
            }}
            onSetCurrentHitPoints={target}
          />
        </DialogContent>
      </Dialog>
    );
  }
  render(<Host />);
  const field = screen.getByRole('textbox', { name: 'Current HP' });
  await user.click(field);
  fireEvent.change(field, { target: { value: '15' } });
  await user.keyboard('{Escape}');
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(field).toHaveValue('9');
  expect(target).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
});

it.each([
  ['Damage', 'Damage'],
  ['Heal', 'Heal'],
  ['Add temp HP', 'Add temp HP'],
])(
  'preserves the positive amount minimum before %s on blur',
  (_label, button) => {
    const action = vi.fn();
    render(
      <HitPointTracker
        hitPoints={{
          current: 25,
          max: 40,
          temporary: 5,
          calculationMode: 'manual',
        }}
        onApplyDamage={action}
        onApplyHealing={action}
        onAddTemporaryHP={action}
      />
    );
    const field = screen.getByRole('textbox', { name: 'HP amount' });
    fireEvent.change(field, { target: { value: '0' } });
    fireEvent.blur(field);
    expect(field).toHaveValue('1');
    fireEvent.change(field, { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect(action).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect(action).toHaveBeenCalledExactlyOnceWith(8);
    expect(field).toHaveValue('');
  }
);

it('keeps empty and negative amounts unchanged when halving or doubling', () => {
  render(
    <HitPointTracker
      hitPoints={{
        current: 25,
        max: 40,
        temporary: 5,
        calculationMode: 'manual',
      }}
      onApplyDamage={vi.fn()}
    />
  );
  const field = screen.getByRole('textbox', { name: 'HP amount' });
  for (const name of [
    'Halve damage (resistance)',
    'Double damage (vulnerability)',
  ]) {
    fireEvent.click(screen.getByRole('button', { name }));
    expect(field).toHaveValue('');
  }
  fireEvent.change(field, { target: { value: '-2' } });
  fireEvent.click(
    screen.getByRole('button', { name: 'Double damage (vulnerability)' })
  );
  expect(field).toHaveValue('-2');
});
