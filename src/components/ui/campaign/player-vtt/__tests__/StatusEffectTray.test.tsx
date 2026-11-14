import type { ReactElement } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  render as rtlRender,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { StatusEffectTray } from '@/components/ui/campaign/player-vtt/StatusEffectTray';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState, ActiveCondition } from '@/types/character';

function seedCharacter(overrides: Partial<CharacterState> = {}) {
  const store = useCharacterStore.getState();
  const base = store.character;
  store.loadCharacterState({
    ...base,
    ...overrides,
  } as CharacterState);
}

const getChar = () => useCharacterStore.getState().character;

const makeCondition = (
  over: Partial<ActiveCondition> = {}
): ActiveCondition => ({
  id: 'poisoned-1',
  name: 'Poisoned',
  source: 'Self',
  description: '',
  stackable: false,
  count: 1,
  appliedAt: new Date().toISOString(),
  ...over,
});

// The tray's Tooltip needs the provider PlayerVttScreen wraps around the
// floating panels, and Radix measures the trigger with ResizeObserver.
function render(ui: ReactElement) {
  const result = rtlRender(<TooltipProvider>{ui}</TooltipProvider>);
  return {
    ...result,
    rerender: (next: ReactElement) =>
      result.rerender(<TooltipProvider>{next}</TooltipProvider>),
  };
}

describe('StatusEffectTray', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    seedCharacter();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.documentElement.style.removeProperty('--player-vtt-tray-height');
  });

  it('shows no concentration button while not concentrating', () => {
    seedCharacter({
      concentration: { isConcentrating: false },
    });
    render(<StatusEffectTray />);
    expect(screen.queryByText(/Concentrating on/)).toBeNull();
  });

  it('names the concentration spell on its button and ends concentration from the dialog', () => {
    seedCharacter({
      concentration: { isConcentrating: true, spellName: 'Bless' },
    });
    render(<StatusEffectTray />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Concentrating on Bless' })
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Concentrating on Bless',
    });
    const end = within(dialog).getByRole('button', {
      name: 'End concentration',
    });
    expect(end).toHaveAttribute('data-variant', 'danger');

    fireEvent.click(end);

    expect(getChar().concentration.isConcentrating).toBe(false);
  });

  it('renders a condition chip per active condition and removes it', () => {
    seedCharacter({
      conditionsAndDiseases: {
        ...getChar().conditionsAndDiseases,
        activeConditions: [makeCondition()],
      },
    });
    render(<StatusEffectTray />);

    expect(screen.getByText('Poisoned')).toBeInTheDocument();
    // The condition's book source ("Self", "XPHB", "DM") is not a spell.
    expect(screen.queryByText(/^From /)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /remove poisoned/i }));

    expect(getChar().conditionsAndDiseases.activeConditions).toHaveLength(0);
  });

  it('adds a condition from the quick-add picker', () => {
    render(<StatusEffectTray />);

    fireEvent.click(screen.getByRole('button', { name: 'Add condition' }));
    expect(
      screen.getByRole('dialog', { name: 'Add condition or buff' })
    ).toBeInTheDocument();
    const quickAdd = screen.getByRole('button', { name: /^Blinded$/ });
    expect(quickAdd).toHaveAttribute('data-variant', 'secondary');
    fireEvent.click(quickAdd);

    const conditions = getChar().conditionsAndDiseases.activeConditions;
    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toMatchObject({
      name: 'Blinded',
      source: 'Self',
      count: 1,
    });
  });

  it('publishes its own height plus 8px as --player-vtt-tray-height and removes it on unmount', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 50,
    } as DOMRect);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: () => void) {}
        observe() {
          this.callback();
        }
        unobserve() {}
        disconnect() {}
      }
    );
    const { unmount } = render(<StatusEffectTray />);

    const root = document.documentElement.style;
    expect(root.getPropertyValue('--player-vtt-tray-height')).toBe('58px');

    unmount();
    expect(root.getPropertyValue('--player-vtt-tray-height')).toBe('');
  });

  it('re-measures when the tray resizes', () => {
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ height: 50 } as DOMRect);
    let captured: (() => void) | undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: () => void) {}
        observe() {
          captured = this.callback;
        }
        unobserve() {}
        disconnect() {}
      }
    );
    render(<StatusEffectTray />);

    const root = document.documentElement.style;
    expect(root.getPropertyValue('--player-vtt-tray-height')).toBe('58px');

    rect.mockReturnValue({ height: 80 } as DOMRect);
    expect(captured).toBeDefined();
    act(() => captured?.());
    expect(root.getPropertyValue('--player-vtt-tray-height')).toBe('88px');
  });
});
