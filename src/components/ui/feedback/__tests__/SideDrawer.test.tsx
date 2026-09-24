import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { SideDrawer } from '@/components/ui/feedback/SideDrawer';

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
});
