import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import userEvent from '@testing-library/user-event';
import { InPlaceTextField } from '..';
import { keepOpenForInPlaceEdit } from '../../InPlaceField/keepOpenForInPlaceEdit';

afterEach(cleanup);

it('has no tab stop in play mode', () => {
  render(
    <InPlaceTextField
      label="Character name"
      value="Brin"
      editing={false}
      onCommit={vi.fn()}
    />
  );
  expect(screen.getByText('Brin')).toBeVisible();
  expect(screen.queryByRole('textbox')).toBeNull();
});

it('commits only changed drafts on Enter or blur and cancels before blur', () => {
  const commit = vi.fn();
  render(
    <InPlaceTextField
      label="Character name"
      value="Brin"
      editing
      onCommit={commit}
    />
  );
  const field = screen.getByRole('textbox', { name: 'Character name' });
  fireEvent.change(field, { target: { value: 'Thalia' } });
  expect(commit).not.toHaveBeenCalled();
  expect(field).toHaveAttribute('data-in-place-dirty');
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(commit).toHaveBeenCalledExactlyOnceWith('Thalia');
  fireEvent.blur(field);
  expect(commit).toHaveBeenCalledTimes(1);
  fireEvent.change(field, { target: { value: 'Draft' } });
  fireEvent.keyDown(field, { key: 'Escape' });
  fireEvent.blur(field);
  expect(field).toHaveValue('Brin');
  expect(commit).toHaveBeenCalledTimes(1);
  fireEvent.change(field, { target: { value: 'Vane' } });
  fireEvent.blur(field);
  expect(commit).toHaveBeenLastCalledWith('Vane');
});

it('lets the dirty field own the first Escape and the parent own the second', () => {
  render(
    <InPlaceTextField
      label="Character name"
      value="Brin"
      editing
      onCommit={vi.fn()}
    />
  );
  const field = screen.getByRole('textbox');
  fireEvent.change(field, { target: { value: 'Draft' } });
  const first = new KeyboardEvent('keydown', {
    key: 'Escape',
    cancelable: true,
  });
  Object.defineProperty(first, 'target', { value: field });
  keepOpenForInPlaceEdit(first);
  expect(first.defaultPrevented).toBe(true);
  fireEvent.keyDown(field, { key: 'Escape' });
  const second = new KeyboardEvent('keydown', {
    key: 'Escape',
    cancelable: true,
  });
  Object.defineProperty(second, 'target', { value: field });
  keepOpenForInPlaceEdit(second);
  expect(second.defaultPrevented).toBe(false);
});

it('discards a draft on leaving edit mode and accepts external values', () => {
  const commit = vi.fn();
  const props = { label: 'Character name', value: 'Brin', onCommit: commit };
  const { rerender } = render(<InPlaceTextField {...props} editing />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Draft' } });
  rerender(<InPlaceTextField {...props} editing={false} />);
  rerender(<InPlaceTextField {...props} value="Synced" editing />);
  expect(screen.getByRole('textbox')).toHaveValue('Synced');
  expect(commit).not.toHaveBeenCalled();
});

it('cancels the name on first Escape and closes the actual dialog on second Escape', async () => {
  function Harness() {
    const [open, setOpen] = useState(true);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Character</DialogTitle>
          <InPlaceTextField
            label="Character name"
            value="Brin"
            editing
            onCommit={vi.fn()}
          />
        </DialogContent>
      </Dialog>
    );
  }
  render(<Harness />);
  const field = await screen.findByRole('textbox');
  await userEvent.clear(field);
  await userEvent.type(field, 'Draft');
  await userEvent.keyboard('{Escape}');
  expect(field).toHaveValue('Brin');
  expect(screen.getByRole('dialog')).toBeVisible();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('preserves a dirty draft across incoming values and cancels to the latest committed name', () => {
  const commit = vi.fn();
  const { rerender } = render(
    <InPlaceTextField
      label="Character name"
      value="Brin"
      editing
      onCommit={commit}
    />
  );
  const field = screen.getByRole('textbox');
  fireEvent.change(field, { target: { value: 'Draft' } });
  rerender(
    <InPlaceTextField
      label="Character name"
      value="Synced"
      editing
      onCommit={commit}
    />
  );
  expect(field).toHaveValue('Draft');
  fireEvent.keyDown(field, { key: 'Escape' });
  fireEvent.blur(field);
  expect(field).toHaveValue('Synced');
  expect(commit).not.toHaveBeenCalled();
});
it('commits a preserved draft once against the latest incoming name', () => {
  const commit = vi.fn();
  const { rerender } = render(
    <InPlaceTextField
      label="Character name"
      value="Brin"
      editing
      onCommit={commit}
    />
  );
  const field = screen.getByRole('textbox');
  fireEvent.change(field, { target: { value: 'Draft' } });
  rerender(
    <InPlaceTextField
      label="Character name"
      value="Synced"
      editing
      onCommit={commit}
    />
  );
  fireEvent.keyDown(field, { key: 'Enter' });
  fireEvent.blur(field);
  expect(commit).toHaveBeenCalledExactlyOnceWith('Draft');
});
it('leaves Enter and Escape to an active text composition', () => {
  const commit = vi.fn();
  render(
    <InPlaceTextField
      label="Character name"
      value="Brin"
      editing
      onCommit={commit}
    />
  );
  const field = screen.getByRole('textbox');
  fireEvent.change(field, { target: { value: '明' } });
  fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
  expect(commit).not.toHaveBeenCalled();
  fireEvent.keyDown(field, { key: 'Escape', isComposing: true });
  expect(field).toHaveValue('明');
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(commit).toHaveBeenCalledExactlyOnceWith('明');
});
