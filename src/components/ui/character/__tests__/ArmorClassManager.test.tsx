import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ArmorClassManager from '../ArmorClassManager';
import { makeCharacter } from '@/utils/__tests__/test-utils';

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
    expect(screen.getByTestId('base-ac-value')).toHaveTextContent('17');
    // Same wrapper as the design-system Input, so it lands where the field does.
    expect(screen.getByTestId('base-ac-value').parentElement).toHaveClass(
      'w-full'
    );
  });

  it('keeps temp AC and shield bonus fields in play mode', () => {
    renderAc(false);
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
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
