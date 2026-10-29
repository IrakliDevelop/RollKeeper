import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ArmorClassManager from '../ArmorClassManager';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CharacterState, TemporaryBuff } from '@/types/character';

afterEach(cleanup);

function renderAc(editing?: boolean) {
  const character = makeCharacter({
    armorClass: 17,
    tempArmorClass: 0,
    shieldBonus: 2,
  });
  return render(
    <ArmorClassManager
      character={character}
      editing={editing}
      onUpdateArmorClass={vi.fn()}
      onUpdateTempArmorClass={vi.fn()}
      onSetTempACActive={vi.fn()}
      onSetShieldEquipped={vi.fn()}
      onUpdateShieldBonus={vi.fn()}
    />
  );
}

describe('ArmorClassManager sheet mode', () => {
  it('edits base AC by default (the map dock dialog relies on it)', () => {
    renderAc();
    expect(screen.getByDisplayValue('17')).toBeInTheDocument();
  });

  it('shows base AC as text in play mode', () => {
    renderAc(false);
    expect(screen.queryByDisplayValue('17')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Base AC' })).toBeNull();
  });

  it('keeps temp AC live and gates shield bonus in play mode', () => {
    renderAc(false);
    expect(
      screen.getByRole('textbox', { name: 'Temp AC' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Shield bonus' })).toBeNull();
  });

  it('drops an uncommitted base AC draft when leaving edit mode without a blur', () => {
    const character = makeCharacter({
      armorClass: 17,
      tempArmorClass: 0,
      shieldBonus: 2,
    });
    const onUpdateArmorClass = vi.fn();
    const props = {
      character,
      onUpdateArmorClass,
      onUpdateTempArmorClass: vi.fn(),
      onSetTempACActive: vi.fn(),
      onSetShieldEquipped: vi.fn(),
      onUpdateShieldBonus: vi.fn(),
    };
    const { rerender } = render(<ArmorClassManager {...props} editing />);
    fireEvent.change(screen.getByDisplayValue('17'), {
      target: { value: '25' },
    });

    rerender(<ArmorClassManager {...props} editing={false} />);
    rerender(<ArmorClassManager {...props} editing />);

    expect(screen.getByDisplayValue('17')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('25')).toBeNull();
    expect(onUpdateArmorClass).not.toHaveBeenCalled();
  });
});

function makeBuff(
  effects: TemporaryBuff['effects'],
  name = 'Shield of Faith'
): TemporaryBuff {
  return {
    id: 'buff-1',
    name,
    effects,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function renderLedger(overrides: Partial<CharacterState> = {}, editing = true) {
  const handlers = {
    onUpdateArmorClass: vi.fn(),
    onUpdateTempArmorClass: vi.fn(),
    onSetTempACActive: vi.fn(),
    onSetShieldEquipped: vi.fn(),
    onUpdateShieldBonus: vi.fn(),
  };
  const character = makeCharacter({
    armorClass: 14,
    tempArmorClass: 0,
    isTempACActive: false,
    shieldBonus: 3,
    isWearingShield: true,
    ...overrides,
  });
  render(
    <ArmorClassManager
      character={character}
      editing={editing}
      layout="ledger"
      {...handlers}
    />
  );
  return handlers;
}

describe('ArmorClassManager ledger layout', () => {
  it('shows the total in the shield with its Total caption', () => {
    renderLedger();
    const shield = document.querySelector('[data-ac-shield]');
    expect(shield).toHaveTextContent('17');
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('shows the base AC and names both switches by their captions', () => {
    renderLedger();
    expect(screen.getByDisplayValue('14')).toBeInTheDocument();
    expect(screen.getByText('Base AC')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Shield' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Temp AC' })).not.toBeChecked();
  });

  it('toggles the shield from its caption text', () => {
    const { onSetShieldEquipped } = renderLedger();
    fireEvent.click(screen.getByText('Shield'));
    expect(onSetShieldEquipped).toHaveBeenCalledWith(false);
  });

  it('toggles temp AC from its caption text', () => {
    const { onSetTempACActive } = renderLedger();
    fireEvent.click(screen.getByText('Temp AC'));
    expect(onSetTempACActive).toHaveBeenCalledWith(true);
  });

  it('has no equation or helper lines', () => {
    renderLedger();
    expect(screen.queryByText(/14 \+ 3 = 17/)).toBeNull();
    expect(screen.queryByText('Armor and Dexterity')).toBeNull();
    expect(
      screen.queryByText('Bonuses from spells and temporary magical effects')
    ).toBeNull();
    expect(screen.queryByText('Shield bonus to AC')).toBeNull();
  });

  it('mutes the parts that are switched off', () => {
    renderLedger({ isWearingShield: false });
    const shieldPart = screen.getByDisplayValue('3').closest('div');
    expect(shieldPart).toHaveClass('text-muted');
    const basePart = screen.getByDisplayValue('14').closest('div');
    expect(basePart).toHaveClass('text-heading');
  });

  it('shows the additive buff line when an active buff adds AC', () => {
    renderLedger({
      temporaryBuffs: [
        makeBuff([{ id: 'e1', targetStat: 'ac', mode: 'add', value: 2 }]),
      ],
    });
    expect(screen.getByText(/\+ 2 \(From temporary buffs\)/)).toBeVisible();
  });

  it('shows override and floor buff lines', () => {
    renderLedger({
      temporaryBuffs: [
        makeBuff(
          [
            { id: 'e1', targetStat: 'ac', mode: 'set', value: 13 },
            { id: 'e2', targetStat: 'ac', mode: 'floor', value: 16 },
          ],
          'Mage Armor'
        ),
      ],
    });
    expect(screen.getByText('13 (Mage Armor)')).toBeInTheDocument();
    expect(
      screen.getByText('Minimum AC 16 from Mage Armor')
    ).toBeInTheDocument();
  });

  it('shows no buff lines without active AC buffs', () => {
    renderLedger();
    expect(screen.queryByText(/From temporary buffs/)).toBeNull();
    expect(screen.queryByText(/Minimum AC/)).toBeNull();
  });

  it('shows base AC and shield bonus as text in play mode but keeps temp AC a field', () => {
    renderLedger({}, false);
    expect(screen.queryByRole('textbox', { name: 'Base AC' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Shield bonus' })).toBeNull();
    expect(
      screen.getByRole('textbox', { name: 'Temp AC' })
    ).toBeInTheDocument();
  });

  it('keeps the rows layout the default', () => {
    renderAc();
    expect(screen.getByText('Armor and Dexterity')).toBeInTheDocument();
  });
});
