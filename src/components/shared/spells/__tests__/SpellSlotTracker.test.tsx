import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SpellSlotTracker } from '../SpellSlotTracker';
import type { SpellSlots, PactMagic } from '@/types/character';

const mockSpellSlots: SpellSlots = {
  1: { max: 4, used: 1 },
  2: { max: 3, used: 0 },
  3: { max: 2, used: 2 },
  4: { max: 0, used: 0 },
  5: { max: 0, used: 0 },
  6: { max: 0, used: 0 },
  7: { max: 0, used: 0 },
  8: { max: 0, used: 0 },
  9: { max: 0, used: 0 },
};

const mockPactMagic: PactMagic = {
  slots: { max: 2, used: 1 },
  level: 3,
};

const emptySpellSlots: SpellSlots = {
  1: { max: 0, used: 0 },
  2: { max: 0, used: 0 },
  3: { max: 0, used: 0 },
  4: { max: 0, used: 0 },
  5: { max: 0, used: 0 },
  6: { max: 0, used: 0 },
  7: { max: 0, used: 0 },
  8: { max: 0, used: 0 },
  9: { max: 0, used: 0 },
};

describe('SpellSlotTracker', () => {
  it('renders Spell Slots title', () => {
    render(<SpellSlotTracker spellSlots={mockSpellSlots} />);
    expect(screen.getAllByText('Spell Slots').length).toBeGreaterThan(0);
  });

  it('shows Level 1 with 3/4 remaining', () => {
    render(<SpellSlotTracker spellSlots={mockSpellSlots} />);
    expect(screen.getAllByText('Level 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3/4').length).toBeGreaterThan(0);
  });

  it('shows Level 2 with 3/3 remaining', () => {
    render(<SpellSlotTracker spellSlots={mockSpellSlots} />);
    expect(screen.getAllByText('Level 2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3/3').length).toBeGreaterThan(0);
  });

  it('shows Level 3 with 0/2 remaining (all used)', () => {
    render(<SpellSlotTracker spellSlots={mockSpellSlots} />);
    expect(screen.getAllByText('Level 3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0/2').length).toBeGreaterThan(0);
  });

  it('does not render levels with max 0 (Level 4-9)', () => {
    render(<SpellSlotTracker spellSlots={mockSpellSlots} />);
    expect(screen.queryByText('Level 4')).not.toBeInTheDocument();
    expect(screen.queryByText('Level 5')).not.toBeInTheDocument();
    expect(screen.queryByText('Level 6')).not.toBeInTheDocument();
    expect(screen.queryByText('Level 7')).not.toBeInTheDocument();
    expect(screen.queryByText('Level 8')).not.toBeInTheDocument();
    expect(screen.queryByText('Level 9')).not.toBeInTheDocument();
  });

  it('clicking an available slot checkbox calls onSpellSlotChange', () => {
    const onChange = vi.fn();
    const { container } = render(
      <SpellSlotTracker
        spellSlots={mockSpellSlots}
        onSpellSlotChange={onChange}
      />
    );
    // Use container query to get a unique slot button.
    // Level 1 has 4 slots (1 used, 3 available). "Spell slot 4 - Available" is unique to Level 1.
    const slot = container.querySelector(
      'button[title="Spell slot 4 - Available"]'
    );
    expect(slot).not.toBeNull();
    fireEvent.click(slot!);
    // Clicking index 3 (>= used=1): newUsed = index + 1 = 4
    expect(onChange).toHaveBeenCalledWith(1, 4);
  });

  it('Reset Slots button calls onResetSpellSlots', () => {
    const onReset = vi.fn();
    render(
      <SpellSlotTracker
        spellSlots={mockSpellSlots}
        onResetSpellSlots={onReset}
      />
    );
    fireEvent.click(screen.getByText('Reset Slots'));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('renders Pact Magic section when pactMagic provided', () => {
    render(
      <SpellSlotTracker spellSlots={mockSpellSlots} pactMagic={mockPactMagic} />
    );
    expect(screen.getByText('Pact Magic')).toBeInTheDocument();
  });

  it('shows pact magic remaining 1/2', () => {
    render(
      <SpellSlotTracker spellSlots={mockSpellSlots} pactMagic={mockPactMagic} />
    );
    expect(screen.getAllByText('1/2').length).toBeGreaterThan(0);
  });

  it('Reset Pact button calls onResetPactMagic', () => {
    const onResetPact = vi.fn();
    render(
      <SpellSlotTracker
        spellSlots={mockSpellSlots}
        pactMagic={mockPactMagic}
        onResetPactMagic={onResetPact}
      />
    );
    fireEvent.click(screen.getByText('Reset Pact'));
    expect(onResetPact).toHaveBeenCalledOnce();
  });

  it('returns null when no spell slots and no pact magic', () => {
    const { container } = render(
      <SpellSlotTracker spellSlots={emptySpellSlots} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('readonly disables slot checkboxes and hides reset buttons', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const { container } = render(
      <SpellSlotTracker
        spellSlots={mockSpellSlots}
        onSpellSlotChange={onChange}
        onResetSpellSlots={onReset}
        readonly
      />
    );
    // All slot buttons should be disabled
    const slotButtons = container.querySelectorAll(
      'button[title*="Spell slot"]'
    );
    expect(slotButtons.length).toBe(9);
    slotButtons.forEach(btn => {
      expect(btn).toBeDisabled();
    });
    // Reset button should not be rendered
    expect(
      container.querySelector('button[title="Reset all spell slots"]')
    ).toBeNull();
  });

  it('compact mode shows abbreviated level labels', () => {
    render(<SpellSlotTracker spellSlots={mockSpellSlots} compact />);
    expect(screen.getAllByText('L1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('L2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('L3').length).toBeGreaterThan(0);
  });
});
