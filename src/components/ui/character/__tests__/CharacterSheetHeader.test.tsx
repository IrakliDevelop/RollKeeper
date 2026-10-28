import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CharacterSheetHeader from '../CharacterSheetHeader';
import { SheetModeProvider, useSheetModeState } from '../SheetMode';

vi.mock('@/components/auth/HeaderTrailing', () => ({
  HeaderTrailing: () => null,
}));
vi.mock('../QRShareDialog', () => ({ QRShareDialog: () => null }));

afterEach(cleanup);

function Harness() {
  const mode = useSheetModeState('c1');
  return (
    <SheetModeProvider value={mode}>
      <CharacterSheetHeader
        characterId="c1"
        characterName="Brin"
        characterRace="Dwarf"
        characterClass="Fighter"
        characterLevel={3}
        characterAlignment=""
        characterCreatureType="Humanoid"
        saveStatus="saved"
        lastSaved={null}
        hasUnsavedChanges={false}
        onManualSave={vi.fn()}
        onExport={vi.fn()}
        onShowResetModal={vi.fn()}
        onUpdateName={vi.fn()}
        onAddToast={vi.fn()}
      />
    </SheetModeProvider>
  );
}

const editSwitch = () => screen.getByRole('switch', { name: 'Edit sheet' });

describe('CharacterSheetHeader modes', () => {
  it('starts in play mode: name as text, no notice', () => {
    render(<Harness />);
    expect(editSwitch()).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByPlaceholderText('Character Name')).toBeNull();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Brin' })
    ).toBeVisible();
    expect(screen.queryByText('Editing sheet')).toBeNull();
  });

  it('edits the name and shows the notice while the switch is on', () => {
    render(<Harness />);
    fireEvent.click(editSwitch());
    expect(editSwitch()).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByPlaceholderText('Character Name')).toHaveValue('Brin');
    expect(screen.getByText('Editing sheet')).toBeVisible();
    fireEvent.click(editSwitch());
    expect(screen.queryByPlaceholderText('Character Name')).toBeNull();
    expect(screen.queryByText('Editing sheet')).toBeNull();
  });

  it('has no Edit/View button any more', () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: /^(Edit|View)$/ })).toBeNull();
    expect(screen.queryByTitle(/Switch to (edit|view) mode/)).toBeNull();
  });

  it('keeps the bar in place on scroll, with no hover strip', () => {
    render(<Harness />);
    const bar = editSwitch().closest('header');
    Object.defineProperty(window, 'scrollY', {
      value: 500,
      configurable: true,
    });
    fireEvent.scroll(window);
    expect(bar).not.toHaveClass('-translate-y-full');
    expect(bar).toHaveClass('sticky');
    expect(screen.queryByTitle('Hover to show header')).toBeNull();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('keeps the notice inside the sticky bar', () => {
    render(<Harness />);
    fireEvent.click(editSwitch());
    expect(editSwitch().closest('header')).toContainElement(
      screen.getByText('Editing sheet')
    );
  });

  it('names the back link "Back to Characters"', () => {
    render(<Harness />);
    expect(
      screen.getByRole('link', { name: 'Back to Characters' })
    ).toHaveAttribute('href', '/player');
  });

  it('keeps the bar save status for screen readers on phones', () => {
    render(<Harness />);
    const bar = editSwitch().closest('header')!;
    expect(within(bar).getByText('All changes saved')).toHaveClass('sr-only');
  });
});
