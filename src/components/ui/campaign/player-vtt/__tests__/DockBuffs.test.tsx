import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { DockBuffs } from '@/components/ui/campaign/player-vtt/CharacterDock/DockBuffs';
import type { TemporaryBuff } from '@/types/character';

function buff(partial: Partial<TemporaryBuff>): TemporaryBuff {
  return {
    id: 'b1',
    name: 'Mage Armor',
    effects: [{ id: 'e1', targetStat: 'ac', mode: 'set', value: 13 }],
    isActive: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...partial,
  };
}

const LONG_SUMMARY = '+5 AC · resistance: fire, cold, lightning';

afterEach(cleanup);

// Rendered bare on purpose: EffectsTab mounts DockBuffs without a
// TooltipProvider, so DockBuffs must render no Tooltip.
describe('DockBuffs', () => {
  it('renders nothing for no buffs', () => {
    const { container } = render(
      <DockBuffs buffs={[]} onToggleBuff={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('names the section', () => {
    render(<DockBuffs buffs={[buff({})]} onToggleBuff={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Buffs' })).toBeInTheDocument();
  });

  it('marks the active buff pressed and the inactive one not', () => {
    render(
      <DockBuffs
        buffs={[
          buff({ id: 'b1', name: 'Mage Armor', isActive: true }),
          buff({ id: 'b2', name: 'Shield', isActive: false }),
        ]}
        onToggleBuff={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /mage armor/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: /shield/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('shows the full effect summary as text, with no title attribute', () => {
    const { container } = render(
      <DockBuffs
        buffs={[
          buff({
            id: 'b3',
            name: 'Warding Bond',
            effects: [
              { id: 'e1', targetStat: 'ac', mode: 'add', value: 5 },
              {
                id: 'e2',
                targetStat: 'damageResistance',
                mode: 'grant',
                value: 0,
                targetDamageType: 'fire, cold, lightning',
              },
            ],
          }),
        ]}
        onToggleBuff={vi.fn()}
      />
    );
    expect(screen.getByText(LONG_SUMMARY)).toBeInTheDocument();
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('toggles a buff by id', () => {
    const onToggleBuff = vi.fn();
    render(
      <DockBuffs
        buffs={[buff({ id: 'b2', name: 'Shield' })]}
        onToggleBuff={onToggleBuff}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /shield/i }));
    expect(onToggleBuff).toHaveBeenCalledWith('b2');
  });
});
