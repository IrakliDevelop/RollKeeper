import type { ReactElement } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render as rtlRender,
  screen,
  fireEvent,
  cleanup,
} from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { DockResources } from '@/components/ui/campaign/player-vtt/CharacterDock/DockResources';
import { getResourceDefinitionById } from '@/utils/classResources';
import type { CharacterAbilities } from '@/types/character';

const abilities: CharacterAbilities = {
  strength: 16,
  dexterity: 14,
  constitution: 14,
  intelligence: 8,
  wisdom: 12,
  charisma: 10,
};

function activeResource(id: string, classLevel: number, usesExpended = 0) {
  const definition = getResourceDefinitionById(id)!;
  const ctx = { classLevel, abilities, proficiencyBonus: 2 };
  const maxUses = definition.getMaxUses(ctx);
  return {
    definition,
    classLevel,
    maxUses,
    die: definition.getDie?.(classLevel),
    usesExpended,
    usesRemaining: maxUses - usesExpended,
    description: definition.getDescription?.(ctx),
  };
}

// DockResources' Tooltips need the provider PlayerVttScreen wraps around the
// floating panels, and Radix measures the trigger with ResizeObserver.
function render(ui: ReactElement) {
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DockResources', () => {
  it('renders nothing for no resources', () => {
    const { container } = render(
      <DockResources resources={[]} onSpend={vi.fn()} onRestore={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('names the section and shows the remaining count', () => {
    render(
      <DockResources
        resources={[activeResource('rage', 3, 1)]}
        onSpend={vi.fn()}
        onRestore={vi.fn()}
      />
    );
    expect(
      screen.getByRole('heading', { name: 'Resources' })
    ).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('spends and restores through the named buttons', () => {
    const onSpend = vi.fn();
    const onRestore = vi.fn();
    render(
      <DockResources
        resources={[activeResource('rage', 3, 1)]}
        onSpend={onSpend}
        onRestore={onRestore}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Spend Rage' }));
    expect(onSpend).toHaveBeenCalledWith('rage');
    fireEvent.click(screen.getByRole('button', { name: 'Restore Rage' }));
    expect(onRestore).toHaveBeenCalledWith('rage');
  });

  it('disables Spend at zero left', () => {
    const r = activeResource('rage', 3);
    render(
      <DockResources
        resources={[{ ...r, usesExpended: r.maxUses, usesRemaining: 0 }]}
        onSpend={vi.fn()}
        onRestore={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Spend Rage' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Restore Rage' })).toBeEnabled();
  });

  it('disables Restore at max', () => {
    render(
      <DockResources
        resources={[activeResource('rage', 3)]}
        onSpend={vi.fn()}
        onRestore={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Restore Rage' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Spend Rage' })).toBeEnabled();
  });

  it('carries no title attribute and no text glyphs for the steppers', () => {
    const { container } = render(
      <DockResources
        resources={[activeResource('rage', 3, 1)]}
        onSpend={vi.fn()}
        onRestore={vi.fn()}
      />
    );
    expect(container.querySelector('[title]')).toBeNull();
    expect(container.textContent).not.toContain('−');
    expect(container.textContent).not.toContain('+');
  });
});
