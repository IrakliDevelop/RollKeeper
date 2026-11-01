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

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});

const updateName = vi.fn();
function Harness({ name = 'Brin' }: { name?: string } = {}) {
  const mode = useSheetModeState('c1');
  return (
    <SheetModeProvider value={mode}>
      <CharacterSheetHeader
        characterId="c1"
        characterName={name}
        characterRace="Dwarf"
        characterClass="Fighter 3"
        characterLevel={3}
        characterAlignment=""
        characterCreatureType="Humanoid"
        saveStatus="saved"
        lastSaved={null}
        hasUnsavedChanges={false}
        onManualSave={vi.fn()}
        onExport={vi.fn()}
        onShowResetModal={vi.fn()}
        onUpdateName={updateName}
      />
    </SheetModeProvider>
  );
}

const editSwitch = () => screen.getByRole('switch', { name: 'Edit sheet' });

describe('CharacterSheetHeader modes', () => {
  it('starts in play mode: name as text, no notice', () => {
    render(<Harness />);
    expect(editSwitch()).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByPlaceholderText('Thalia Vane')).toBeNull();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Brin' })
    ).toBeVisible();
    expect(screen.queryByText('Editing sheet')).toBeNull();
  });

  it('edits the name and shows the notice while the switch is on', () => {
    render(<Harness />);
    fireEvent.click(editSwitch());
    expect(editSwitch()).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByPlaceholderText('Thalia Vane')).toHaveValue('Brin');
    expect(screen.getByText('Editing sheet')).toBeVisible();
    fireEvent.click(editSwitch());
    expect(screen.queryByPlaceholderText('Thalia Vane')).toBeNull();
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
  });

  it('publishes the bar height for sticky content and jump targets', () => {
    const { unmount } = render(<Harness />);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--app-header-height')).toMatch(/px$/);
    unmount();
    expect(root.style.getPropertyValue('--app-header-height')).toBe('');
  });

  it('keeps the notice inside the sticky bar', () => {
    render(<Harness />);
    fireEvent.click(editSwitch());
    expect(editSwitch().closest('header')).toContainElement(
      screen.getByText('Editing sheet')
    );
  });

  it('names the back link "Characters"', () => {
    render(<Harness />);
    expect(screen.getByRole('link', { name: 'Characters' })).toHaveAttribute(
      'href',
      '/player'
    );
  });

  it('has a separate home link and a crumb without a nested button', () => {
    render(<Harness />);
    expect(
      screen.getByRole('link', { name: 'RollKeeper home' })
    ).toHaveAttribute('href', '/');
    expect(
      screen.getByRole('link', { name: 'Characters' }).querySelector('button')
    ).toBeNull();
  });

  it('keeps the bar save status for screen readers on phones', () => {
    render(<Harness />);
    const bar = editSwitch().closest('header')!;
    expect(within(bar).getByText('All changes saved')).toHaveClass('sr-only');
  });
});

it('has one banner, a named identity section and one text identity line', () => {
  render(<Harness />);
  expect(screen.getAllByRole('banner')).toHaveLength(1);
  const head = screen.getByRole('region', { name: 'Brin' });
  expect(within(head).getByText('Dwarf · Fighter 3 · Humanoid')).toBeVisible();
});
it('keeps the name local until blur and cancels with Escape', () => {
  updateName.mockClear();
  render(<Harness />);
  fireEvent.click(editSwitch());
  const field = screen.getByRole('textbox', { name: 'Character name' });
  fireEvent.change(field, { target: { value: 'Draft' } });
  expect(updateName).not.toHaveBeenCalled();
  fireEvent.keyDown(field, { key: 'Escape' });
  fireEvent.blur(field);
  expect(updateName).not.toHaveBeenCalled();
  fireEvent.change(field, { target: { value: 'Thalia' } });
  fireEvent.blur(field);
  expect(updateName).toHaveBeenCalledExactlyOnceWith('Thalia');
});
it('keeps sheet actions in the header and leaves import on the dashboard', async () => {
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: 'Character' });
  expect(trigger.closest('header')).toBeTruthy();
  fireEvent.click(trigger);
  for (const name of [
    'Export character',
    'Share with QR code',
    'Reset character',
  ])
    expect(await screen.findByRole('button', { name })).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Import' })
  ).not.toBeInTheDocument();
});

it('preserves the approved unnamed fallback without inserting it into the editable name', () => {
  render(<Harness name="" />);
  expect(
    screen.getByRole('heading', { level: 2, name: 'Unnamed character' })
  ).toBeVisible();
  fireEvent.click(editSwitch());
  expect(screen.getByRole('textbox', { name: 'Character name' })).toHaveValue(
    ''
  );
});
