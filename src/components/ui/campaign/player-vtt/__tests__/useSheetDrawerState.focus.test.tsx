import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';

import { SideDrawer } from '@/components/ui/feedback/SideDrawer';

import { useSheetDrawerState } from '../useSheetDrawerState';

afterEach(() => cleanup());

/**
 * Mirrors PlayerVttScreen's wiring: the dock's Sheet button only exists while
 * the dock is expanded, and opening the sheet collapses the dock, so the
 * button that opened the drawer is unmounted until the drawer closes.
 */
function Harness() {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const {
    sheetOpen,
    openSheet,
    openSheetFromDock,
    closeSheet,
    sheetButtonRef,
    handleSheetCloseAutoFocus,
  } = useSheetDrawerState({
    sheetReady: true,
    dockCollapsed,
    setDockCollapsed,
  });
  return (
    <>
      <button onClick={openSheet}>canvas</button>
      {!dockCollapsed && (
        <button ref={sheetButtonRef} onClick={openSheetFromDock}>
          Sheet
        </button>
      )}
      <SideDrawer
        open={sheetOpen}
        onOpenChange={next => {
          if (!next) closeSheet();
        }}
        title="sheet"
        onCloseAutoFocus={handleSheetCloseAutoFocus}
      >
        <button>inside</button>
      </SideDrawer>
    </>
  );
}

describe('useSheetDrawerState focus return', () => {
  it('focuses the re-expanded dock Sheet button after a dock-opened drawer closes', async () => {
    render(<Harness />);
    const sheetButton = screen.getByRole('button', { name: 'Sheet' });
    sheetButton.focus();
    fireEvent.click(sheetButton);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Sheet' })).toBeNull()
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sheet' })).toHaveFocus()
    );
  });

  it('returns focus to the canvas element when the canvas opened the drawer', async () => {
    render(<Harness />);
    const canvas = screen.getByRole('button', { name: 'canvas' });
    canvas.focus();
    fireEvent.click(canvas);
    await waitFor(() => expect(canvas).not.toHaveFocus());
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(canvas).toHaveFocus());
  });
});
