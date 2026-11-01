import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NumberInput, NumberField } from '../NumberInput';
afterEach(cleanup);
for (const Component of [NumberInput, NumberField]) {
  it(`${Component.displayName} commits one target on Enter/blur and cancels with Escape`, () => {
    const change = vi.fn();
    render(
      <Component
        aria-label="Level"
        value={5}
        min={1}
        max={20}
        live={false}
        onChange={change}
      />
    );
    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: '1' } });
    fireEvent.change(field, { target: { value: '12' } });
    expect(change).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.blur(field);
    expect(change).toHaveBeenCalledExactlyOnceWith(12);
    fireEvent.change(field, { target: { value: '7' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    fireEvent.blur(field);
    expect(change).toHaveBeenCalledTimes(1);
  });
}

it('keeps a multiclass dialog open while Escape cancels a level draft', async () => {
  const { useState } = await import('react');
  const { Dialog, DialogContent, DialogTitle } = await import(
    '@/components/ui/feedback/dialog'
  );
  const user = (await import('@testing-library/user-event')).default.setup();
  const change = vi.fn();
  function Host() {
    const [open, setOpen] = useState(true);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Manage classes</DialogTitle>
          <NumberInput
            aria-label="Wizard level"
            value={5}
            live={false}
            onChange={change}
          />
        </DialogContent>
      </Dialog>
    );
  }
  render(<Host />);
  const field = screen.getByRole('textbox', { name: 'Wizard level' });
  await user.click(field);
  fireEvent.change(field, { target: { value: '12' } });
  await user.keyboard('{Escape}');
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(field).toHaveValue('5');
  expect(change).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
});
