import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';

import { SideDrawer } from '@/components/ui/feedback/SideDrawer';
import { InPlaceField } from '@/components/ui/forms/InPlaceField';

afterEach(() => cleanup());

describe('SideDrawer', () => {
  it('renders an accessible dialog when open', () => {
    render(
      <SideDrawer open onOpenChange={vi.fn()} title="Kaelen sheet">
        <p>body</p>
      </SideDrawer>
    );
    expect(
      screen.getByRole('dialog', { name: 'Kaelen sheet' })
    ).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('floats on the elevated surface with the overlay shadow and no radius', () => {
    render(
      <SideDrawer open onOpenChange={vi.fn()} title="Kaelen sheet">
        <p>body</p>
      </SideDrawer>
    );

    const drawer = screen.getByRole('dialog', { name: 'Kaelen sheet' });
    expect(drawer).toHaveClass(
      'bg-surface-elevated',
      'border-l',
      'border-divider',
      'shadow-overlay'
    );
    expect(drawer.className).not.toMatch(
      /shadow-2xl|bg-surface-raised|rounded/
    );
  });

  it('renders nothing when closed', () => {
    render(
      <SideDrawer open={false} onOpenChange={vi.fn()} title="t">
        <p>body</p>
      </SideDrawer>
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape', () => {
    const onOpenChange = vi.fn();
    render(
      <SideDrawer open onOpenChange={onOpenChange} title="t">
        <p>body</p>
      </SideDrawer>
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stays open when onEscapeKeyDown prevents the default', () => {
    const onOpenChange = vi.fn();
    const onEscapeKeyDown = vi.fn((e: KeyboardEvent) => e.preventDefault());
    render(
      <SideDrawer
        open
        onOpenChange={onOpenChange}
        onEscapeKeyDown={onEscapeKeyDown}
        title="t"
      >
        <p>body</p>
      </SideDrawer>
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onEscapeKeyDown).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('is non-modal: no overlay blocks the page', () => {
    render(
      <>
        <button>map</button>
        <SideDrawer open onOpenChange={vi.fn()} title="t">
          <p>body</p>
        </SideDrawer>
      </>
    );
    expect(screen.getByRole('button', { name: 'map' })).not.toHaveAttribute(
      'aria-hidden'
    );
  });

  it('returns focus to the element focused at open after Escape closes it', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>opener</button>
          <SideDrawer open={open} onOpenChange={setOpen} title="t">
            <button>inside</button>
          </SideDrawer>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'opener' });
    opener.focus();
    fireEvent.click(opener);
    await waitFor(() => expect(opener).not.toHaveFocus());
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('lets onCloseAutoFocus take over focus placement', async () => {
    const onCloseAutoFocus = vi.fn((e: Event) => e.preventDefault());
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>opener</button>
          <SideDrawer
            open={open}
            onOpenChange={setOpen}
            title="t"
            onCloseAutoFocus={onCloseAutoFocus}
          >
            <button>inside</button>
          </SideDrawer>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'opener' });
    opener.focus();
    fireEvent.click(opener);
    await waitFor(() => expect(opener).not.toHaveFocus());
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalled());
    expect(opener).not.toHaveFocus();
  });

  it('keeps the drawer open on the first Escape of an in-place edit, closes on the second', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SideDrawer open onOpenChange={onOpenChange} title="Goblin sheet">
        <InPlaceField label="Speed" value={30} editing onCommit={vi.fn()} />
      </SideDrawer>
    );
    const speed = screen.getByRole('textbox', { name: 'Speed' });
    await user.click(speed);
    await user.type(speed, '5');
    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(speed).toHaveValue('30');
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
