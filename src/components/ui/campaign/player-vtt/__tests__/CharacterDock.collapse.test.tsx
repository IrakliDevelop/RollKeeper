import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render as rtlRender,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';

import { SideDrawer } from '@/components/ui/feedback/SideDrawer';
import { TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

import { CharacterDock } from '../CharacterDock';
import { useSheetDrawerState } from '../useSheetDrawerState';

const baseProps = {
  addToast: vi.fn(),
  onCastPlacement: vi.fn(),
  connectionLive: true,
  hasPendingPlacement: false,
  onCancelPlacement: vi.fn(),
};

// The dock's Tooltips need the provider PlayerVttScreen wraps around the
// floating panels, and Radix measures the trigger with ResizeObserver.
function render(ui: React.ReactElement) {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>);
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  const base = useCharacterStore.getState().character;
  useCharacterStore.getState().loadCharacterState({
    ...base,
    name: 'Dock Hero',
    race: 'Elf',
    class: { ...base.class, name: '' },
    level: 3,
    totalLevel: 3,
  } as CharacterState);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness({ initial }: { initial: boolean }) {
  const [collapsed, setCollapsed] = useState(initial);
  return (
    <CharacterDock
      {...baseProps}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed(v => !v)}
    />
  );
}

function DrawerHarness() {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const {
    sheetOpen,
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
      <CharacterDock
        {...baseProps}
        collapsed={dockCollapsed}
        onToggleCollapsed={() => setDockCollapsed(v => !v)}
        onOpenSheet={openSheetFromDock}
        sheetButtonRef={sheetButtonRef}
      />
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

describe('CharacterDock collapsed pill', () => {
  it('is a plain "Character" button that reports it is collapsed', () => {
    render(<Harness initial />);
    const pill = screen.getByRole('button', { name: 'Character' });
    expect(pill).toHaveAttribute('aria-expanded', 'false');
    expect(pill).not.toHaveAttribute('title');
    expect(screen.queryByText('CHAR')).toBeNull();
  });
});

describe('CharacterDock header', () => {
  it('names the panel with the character and falls back to "Unknown class"', () => {
    render(<Harness initial={false} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Dock Hero' })
    ).toBeInTheDocument();
    expect(screen.getByText('Elf · Unknown class 3')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Collapse character dock' })
    ).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('CharacterDock focus handoff', () => {
  it('moves focus between the collapse button and the pill', () => {
    render(<Harness initial={false} />);
    const collapse = screen.getByRole('button', {
      name: 'Collapse character dock',
    });
    collapse.focus();
    fireEvent.click(collapse);
    expect(screen.getByRole('button', { name: 'Character' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    expect(
      screen.getByRole('button', { name: 'Collapse character dock' })
    ).toHaveFocus();
  });
});

describe('CharacterDock with the sheet drawer', () => {
  it('keeps focus in the drawer while open and returns it to the Sheet button on close', async () => {
    render(<DrawerHarness />);
    const sheetButton = screen.getByRole('button', {
      name: 'Open character sheet',
    });
    sheetButton.focus();
    fireEvent.click(sheetButton);

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Character' })).toBeVisible()
    );
    expect(screen.getByRole('button', { name: 'Character' })).not.toHaveFocus();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Open character sheet' })
      ).toHaveFocus()
    );
    expect(screen.queryByRole('button', { name: 'Character' })).toBeNull();
  });
});
