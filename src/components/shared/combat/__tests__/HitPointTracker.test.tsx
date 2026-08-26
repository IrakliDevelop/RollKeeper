import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { HitPointTracker } from '../HitPointTracker';
import { HitPoints } from '@/types/character';

const baseHitPoints: HitPoints = {
  current: 25,
  max: 40,
  temporary: 5,
  calculationMode: 'auto',
  deathSaves: { successes: 0, failures: 0, isStabilized: false },
};

const dyingHitPoints: HitPoints = {
  current: 0,
  max: 40,
  temporary: 0,
  calculationMode: 'auto',
  deathSaves: { successes: 0, failures: 0, isStabilized: false },
};

describe('HitPointTracker', () => {
  it('renders current HP, max HP, and temp HP values', () => {
    render(<HitPointTracker hitPoints={baseHitPoints} />);
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
    expect(screen.getByDisplayValue('40')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();
  });

  it('renders "Hit Points" title', () => {
    render(<HitPointTracker hitPoints={baseHitPoints} />);
    expect(screen.getAllByText('Hit Points').length).toBeGreaterThan(0);
  });

  it('shows "Alive" status text for healthy character', () => {
    render(<HitPointTracker hitPoints={baseHitPoints} />);
    expect(screen.getAllByText(/Alive/).length).toBeGreaterThan(0);
  });

  it('calls onApplyDamage when damage is applied', () => {
    const onApplyDamage = vi.fn();
    const { container } = render(
      <HitPointTracker
        hitPoints={baseHitPoints}
        onApplyDamage={onApplyDamage}
      />
    );
    const damageInput = container.querySelector(
      'input[placeholder="Amount"]'
    ) as HTMLInputElement;
    fireEvent.change(damageInput, { target: { value: '10' } });
    const buttons = container.querySelectorAll('button');
    const dmgButton = Array.from(buttons).find(b =>
      b.textContent?.includes('Dmg')
    );
    fireEvent.click(dmgButton!);
    expect(onApplyDamage).toHaveBeenCalledWith(10);
  });

  it('calls onApplyHealing when healing is applied', () => {
    const onApplyHealing = vi.fn();
    const { container } = render(
      <HitPointTracker
        hitPoints={baseHitPoints}
        onApplyHealing={onApplyHealing}
      />
    );
    const inputs = container.querySelectorAll('input[placeholder="Amount"]');
    fireEvent.change(inputs[1], { target: { value: '5' } });
    const buttons = container.querySelectorAll('button');
    const healButton = Array.from(buttons).find(b =>
      b.textContent?.includes('Heal')
    );
    fireEvent.click(healButton!);
    expect(onApplyHealing).toHaveBeenCalledWith(5);
  });

  it('calls onAddTemporaryHP when temp HP is applied', () => {
    const onAddTemporaryHP = vi.fn();
    const { container } = render(
      <HitPointTracker
        hitPoints={baseHitPoints}
        onAddTemporaryHP={onAddTemporaryHP}
      />
    );
    const inputs = container.querySelectorAll('input[placeholder="Amount"]');
    fireEvent.change(inputs[2], { target: { value: '8' } });
    const buttons = container.querySelectorAll('button');
    const tempButton = Array.from(buttons).find(b =>
      b.textContent?.includes('Temp')
    );
    fireEvent.click(tempButton!);
    expect(onAddTemporaryHP).toHaveBeenCalledWith(8);
  });

  it('clears damage input after applying damage', () => {
    const onApplyDamage = vi.fn();
    const { container } = render(
      <HitPointTracker
        hitPoints={baseHitPoints}
        onApplyDamage={onApplyDamage}
      />
    );
    const damageInput = container.querySelector(
      'input[placeholder="Amount"]'
    ) as HTMLInputElement;
    fireEvent.change(damageInput, { target: { value: '10' } });
    const buttons = container.querySelectorAll('button');
    const dmgButton = Array.from(buttons).find(b =>
      b.textContent?.includes('Dmg')
    );
    fireEvent.click(dmgButton!);
    expect(damageInput.value).toBe('');
  });

  it('shows death saves section when character is dying', () => {
    render(
      <HitPointTracker
        hitPoints={dyingHitPoints}
        onMakeDeathSave={vi.fn()}
        onUpdateHitPoints={vi.fn()}
      />
    );
    expect(screen.getAllByText('Death Saving Throws').length).toBeGreaterThan(
      0
    );
  });

  it('calls onMakeDeathSave(true, false) when success circle is clicked', () => {
    const onMakeDeathSave = vi.fn();
    const { container } = render(
      <HitPointTracker
        hitPoints={dyingHitPoints}
        onMakeDeathSave={onMakeDeathSave}
        onUpdateHitPoints={vi.fn()}
      />
    );
    const successButtons = container.querySelectorAll(
      'button[title="Click to add success"]'
    );
    fireEvent.click(successButtons[0]);
    expect(onMakeDeathSave).toHaveBeenCalledWith(true, false);
  });

  it('calls onMakeDeathSave(false, false) when failure circle is clicked', () => {
    const onMakeDeathSave = vi.fn();
    const { container } = render(
      <HitPointTracker
        hitPoints={dyingHitPoints}
        onMakeDeathSave={onMakeDeathSave}
        onUpdateHitPoints={vi.fn()}
      />
    );
    const failButtons = container.querySelectorAll(
      'button[title="Click to add failure"]'
    );
    fireEvent.click(failButtons[0]);
    expect(onMakeDeathSave).toHaveBeenCalledWith(false, false);
  });

  it('calls onMakeDeathSave(true, true) when Natural 20 button is clicked', () => {
    const onMakeDeathSave = vi.fn();
    const { container } = render(
      <HitPointTracker
        hitPoints={dyingHitPoints}
        onMakeDeathSave={onMakeDeathSave}
        onUpdateHitPoints={vi.fn()}
      />
    );
    const buttons = container.querySelectorAll('button');
    const nat20Button = Array.from(buttons).find(b =>
      b.textContent?.includes('Natural 20')
    );
    fireEvent.click(nat20Button!);
    expect(onMakeDeathSave).toHaveBeenCalledWith(true, true);
  });

  it('shows "Dead" text when character has 3 death save failures', () => {
    const deadHitPoints: HitPoints = {
      ...dyingHitPoints,
      deathSaves: { successes: 0, failures: 3, isStabilized: false },
    };
    render(<HitPointTracker hitPoints={deadHitPoints} />);
    expect(screen.getAllByText(/Dead/).length).toBeGreaterThan(0);
  });

  it('shows "Stabilized" text when character is stabilized', () => {
    const stabilizedHitPoints: HitPoints = {
      ...dyingHitPoints,
      deathSaves: { successes: 3, failures: 0, isStabilized: true },
    };
    render(<HitPointTracker hitPoints={stabilizedHitPoints} />);
    expect(screen.getAllByText(/Stabilized/).length).toBeGreaterThan(0);
  });

  it('calls onResetDeathSaves when reset button is clicked', () => {
    const onResetDeathSaves = vi.fn();
    render(
      <HitPointTracker
        hitPoints={dyingHitPoints}
        onMakeDeathSave={vi.fn()}
        onResetDeathSaves={onResetDeathSaves}
        onUpdateHitPoints={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTitle('Reset death saves'));
    expect(onResetDeathSaves).toHaveBeenCalled();
  });

  it('hides damage/healing/temp controls in readonly mode', () => {
    const { container } = render(
      <HitPointTracker hitPoints={baseHitPoints} readonly />
    );
    expect(
      container.querySelectorAll('input[placeholder="Amount"]')
    ).toHaveLength(0);
    const buttons = container.querySelectorAll('button');
    const dmgButton = Array.from(buttons).find(b =>
      b.textContent?.includes('Dmg')
    );
    expect(dmgButton).toBeUndefined();
  });

  it('shows "Dying" status text when character is at 0 HP and not stabilized', () => {
    render(<HitPointTracker hitPoints={dyingHitPoints} />);
    expect(screen.getAllByText(/Dying/).length).toBeGreaterThan(0);
  });
});
