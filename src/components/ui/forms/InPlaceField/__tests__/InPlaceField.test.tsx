import { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/feedback/dialog';
import { InPlaceField } from '../index';

afterEach(cleanup);

function Harness({
  editing = true,
  onCommit,
  initial = 12,
}: {
  editing?: boolean;
  onCommit?: (value: number) => void;
  initial?: number;
}) {
  const [value, setValue] = useState(initial);
  return (
    <p>
      Speed{' '}
      <InPlaceField
        label="Speed"
        value={value}
        min={1}
        max={30}
        editing={editing}
        onCommit={next => {
          setValue(next);
          onCommit?.(next);
        }}
      />{' '}
      ft
      <button type="button">Next</button>
    </p>
  );
}

const field = () => screen.getByRole('textbox', { name: 'Speed' });

async function retype(text: string) {
  const user = userEvent.setup();
  await user.click(field());
  await user.clear(field());
  if (text) await user.type(field(), text);
  return user;
}

describe('InPlaceField', () => {
  it('is plain text with no tab stop in play mode', () => {
    render(<Harness editing={false} />);

    expect(screen.queryByRole('textbox')).toBeNull();
    const text = screen.getByText('12');
    expect(text.tagName).toBe('SPAN');
    expect(text).not.toHaveAttribute('tabindex');
  });

  it('is a numeric text field named by its label in edit mode', () => {
    render(<Harness />);

    expect(field()).toHaveAttribute('type', 'text');
    expect(field()).toHaveAttribute('inputmode', 'numeric');
    expect(field()).toHaveValue('12');
  });

  it('commits on Enter, clamped to the range', async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    const user = await retype('45');
    await user.keyboard('{Enter}');

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(30);
    expect(field()).toHaveValue('30');
    expect(field()).toHaveFocus();
  });

  it('commits on blur', async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    const user = await retype('25');
    await user.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(25);
  });

  it('cancels on Escape, and the blur after it commits nothing', async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    const user = await retype('9');
    await user.keyboard('{Escape}');
    expect(field()).toHaveValue('12');
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('steps by 1 with the arrows and by 10 with Shift, committing on Enter', async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const user = userEvent.setup();
    await user.click(field());

    await user.keyboard('{ArrowUp}');
    expect(field()).toHaveValue('13');
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(field()).toHaveValue('23');
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(field()).toHaveValue('30');
    await user.keyboard('{ArrowDown}');
    expect(onCommit).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(29);
  });

  it('marks an out-of-range value invalid and announces the range', async () => {
    render(<Harness />);

    await retype('45');

    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Enter a number from 1 to 30.'
    );
    expect(field()).toHaveAccessibleDescription('Enter a number from 1 to 30.');
  });

  it('puts the old value back when left empty', async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    const user = await retype('');
    expect(screen.getByRole('status')).toHaveTextContent('Enter a number.');
    await user.tab();

    expect(field()).toHaveValue('12');
    expect(field()).not.toHaveAttribute('aria-invalid');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('does not commit an unchanged value', async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.click(field());
    await user.keyboard('{Enter}');
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('sizes itself in ch where field-sizing is missing (jsdom)', async () => {
    render(<Harness initial={5} />);
    expect(field().style.width).toBe('1ch');

    await retype('125');
    expect(field().style.width).toBe('3ch');
  });

  it('draws its cue inside the box and grows to 16px on touch', () => {
    render(<Harness />);

    expect(field()).toHaveClass(
      'border-0',
      'p-0',
      'bg-transparent',
      '[font:inherit]',
      'min-w-[2ch]',
      'shadow-[inset_0_-1.5px_0_var(--input-border)]',
      'focus:shadow-[inset_0_-2px_0_var(--ring)]',
      'aria-invalid:shadow-[inset_0_-2px_0_var(--blood-border)]',
      'pointer-coarse:text-[length:max(16px,1em)]'
    );
  });

  it('drops a draft left behind when edit mode ends without a blur', async () => {
    const onCommit = vi.fn();
    const view = render(<Harness onCommit={onCommit} />);
    const user = userEvent.setup();
    await user.click(field());
    await user.clear(field());
    await user.type(field(), '9');

    view.rerender(<Harness editing={false} onCommit={onCommit} />);
    view.rerender(<Harness onCommit={onCommit} />);

    expect(field()).toHaveValue('12');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('wraps the field in a label whose ::after is the tap target', () => {
    render(<Harness />);

    const target = field().parentElement!;
    expect(target.tagName).toBe('LABEL');
    expect(field()).toHaveClass('relative', 'z-[1]');
    expect(target).toHaveClass(
      'relative',
      'tabular-nums',
      'after:min-h-6',
      'after:min-w-6',
      'pointer-coarse:after:min-h-11',
      'pointer-coarse:after:min-w-11'
    );
  });

  it('drops the draft when Escape also closes the dialog around it', async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Edit goblin</DialogTrigger>
        <DialogContent>
          <DialogTitle>Goblin</DialogTitle>
          <DialogDescription>Small humanoid.</DialogDescription>
          <InPlaceField label="Speed" value={30} editing onCommit={onCommit} />
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByRole('button', { name: 'Edit goblin' }));
    await user.click(field());
    await user.clear(field());
    await user.type(field(), '45');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onCommit).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit goblin' })).toHaveFocus()
    );
  });
});
