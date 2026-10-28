import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CharacterHUD from '@/components/ui/character/CharacterHUD';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CharacterState } from '@/types/character';

afterEach(cleanup);

function hudProps(character: CharacterState) {
  return {
    character,
    onShortRest: vi.fn(),
    onLongRest: vi.fn(),
    onIncrementDays: vi.fn(),
    onDecrementDays: vi.fn(),
    onToggleInspiration: vi.fn(),
    onToggleReaction: vi.fn(),
    onStopConcentration: vi.fn(),
    onNavigateToConditions: vi.fn(),
    onNavigateToCombat: vi.fn(),
    onNavigateToSpells: vi.fn(),
  };
}

function withHp(
  current: number,
  max: number,
  temporary = 0,
  overrides: Partial<CharacterState> = {}
) {
  return makeCharacter({
    ...overrides,
    hitPoints: { current, max, temporary, calculationMode: 'auto' },
  });
}

function renderHud(character: CharacterState) {
  const props = hudProps(character);
  const view = render(<CharacterHUD {...props} />);
  return { ...view, props };
}

/** The HP button; its name starts with "Hit points". */
function hpButton() {
  return screen.getByRole('button', { name: /^Hit points / });
}

describe('CharacterHUD hit points', () => {
  it.each([
    [42, 42, 'healthy', 'Healthy'],
    [32, 42, 'healthy', 'Healthy'],
    [31, 42, 'bloodied', 'Bloodied'],
    [149, 200, 'bloodied', 'Bloodied'],
    [12, 42, 'bloodied', 'Bloodied'],
    [5, 42, 'critical', 'Critical'],
    [0, 42, 'down', 'Down'],
  ])('shows %i of %i as %s', (current, max, status, word) => {
    renderHud(withHp(current, max));
    const button = hpButton();
    expect(button).toHaveAttribute('data-hp-status', status);
    expect(button).toHaveTextContent(word);
    expect(button).toHaveAccessibleName(
      `Hit points ${current} of ${max}, ${word}. Open the Combat tab`
    );
  });

  it('shows no tier without a max', () => {
    const { container } = renderHud(withHp(5, 0));
    const button = hpButton();
    const bar = container.querySelector<HTMLElement>('[data-part="bar"]');
    expect(bar?.style.width).toBe('0%');
    expect(button).not.toHaveAttribute('data-hp-status');
    expect(button).toHaveAccessibleName(
      'Hit points 5 of 0. Open the Combat tab'
    );
    for (const word of ['Healthy', 'Bloodied', 'Critical', 'Down']) {
      expect(button).not.toHaveTextContent(word);
    }
  });

  it('shows temporary HP and describes the button with it', () => {
    renderHud(withHp(30, 40, 5));
    const temp = screen.getByText('+5 temp');
    expect(hpButton()).toHaveAttribute('aria-describedby', temp.id);
    expect(hpButton()).toHaveAccessibleDescription('+5 temp');
  });

  it('hides temporary HP at 0', () => {
    renderHud(withHp(30, 40, 0));
    expect(screen.queryByText(/temp/)).toBeNull();
    expect(hpButton()).not.toHaveAttribute('aria-describedby');
  });

  it('shows the current and max values', () => {
    renderHud(withHp(30, 40));
    expect(hpButton()).toHaveTextContent('30/40');
  });

  it('fills the bar to the HP percentage', () => {
    const { container } = renderHud(withHp(21, 42));
    const bar = container.querySelector<HTMLElement>('[data-part="bar"]');
    expect(bar?.style.width).toBe('50%');
  });

  it('opens the Combat tab', () => {
    const { props } = renderHud(withHp(30, 40));
    fireEvent.click(hpButton());
    expect(props.onNavigateToCombat).toHaveBeenCalledTimes(1);
  });
});

describe('CharacterHUD damage flash', () => {
  function flashLayer() {
    return hpButton().querySelector('[data-hp-flash]');
  }

  it('does not flash on load', () => {
    renderHud(withHp(5, 42));
    expect(flashLayer()).not.toHaveClass('animate-rk-hp-flash');
  });

  it('flashes when HP drops', () => {
    const { rerender, props } = renderHud(withHp(42, 42));
    rerender(<CharacterHUD {...props} character={withHp(31, 42)} />);
    expect(flashLayer()).toHaveClass('animate-rk-hp-flash');
  });

  it('does not flash on healing', () => {
    const { rerender, props } = renderHud(withHp(31, 42));
    rerender(<CharacterHUD {...props} character={withHp(42, 42)} />);
    expect(flashLayer()).not.toHaveClass('animate-rk-hp-flash');
  });

  it('replays on the next hit but not on a heal', () => {
    const { rerender, props } = renderHud(withHp(42, 42));
    rerender(<CharacterHUD {...props} character={withHp(31, 42)} />);
    const first = flashLayer();
    rerender(<CharacterHUD {...props} character={withHp(36, 42)} />);
    expect(flashLayer()).toBe(first);
    rerender(<CharacterHUD {...props} character={withHp(20, 42)} />);
    expect(flashLayer()).not.toBe(first);
    expect(flashLayer()).toHaveClass('animate-rk-hp-flash');
  });

  it('does not flash when only temporary HP drops', () => {
    const { rerender, props } = renderHud(withHp(30, 40, 5));
    rerender(<CharacterHUD {...props} character={withHp(30, 40, 0)} />);
    expect(flashLayer()).not.toHaveClass('animate-rk-hp-flash');
  });

  it('does not flash for another character', () => {
    const { rerender, props } = renderHud(withHp(42, 42));
    rerender(
      <CharacterHUD
        {...props}
        character={withHp(10, 42, 0, { id: 'other-character' })}
      />
    );
    expect(flashLayer()).not.toHaveClass('animate-rk-hp-flash');
  });

  it('keeps focus on the HP button through a hit', () => {
    const { rerender, props } = renderHud(withHp(42, 42));
    hpButton().focus();
    rerender(<CharacterHUD {...props} character={withHp(31, 42)} />);
    expect(hpButton()).toHaveFocus();
  });
});

const wizardClass = {
  name: 'Wizard',
  isCustom: false,
  spellcaster: 'full' as const,
  hitDie: 6,
};

describe('CharacterHUD stats', () => {
  it('captions every stat in full', () => {
    renderHud(withHp(30, 40));
    for (const caption of ['AC', 'Initiative', 'Speed', 'Proficiency']) {
      expect(screen.getByText(caption, { exact: true })).toBeVisible();
    }
    for (const old of ['Init', 'Prof', 'Spd']) {
      expect(screen.queryByText(old, { exact: true })).toBeNull();
    }
  });

  it('keeps the order HP, AC, initiative, speed, proficiency', () => {
    renderHud(withHp(30, 40));
    const order = ['AC', 'Initiative', 'Speed', 'Proficiency'].map(text =>
      screen.getByText(text, { exact: true })
    );
    order.unshift(hpButton());
    for (let i = 1; i < order.length; i++) {
      expect(
        order[i - 1].compareDocumentPosition(order[i]) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  });

  it('opens the Combat tab from AC', () => {
    const { props } = renderHud(withHp(30, 40));
    fireEvent.click(screen.getByRole('button', { name: /^\d+ AC$/ }));
    expect(props.onNavigateToCombat).toHaveBeenCalledTimes(1);
  });

  it('shows initiative and proficiency as text, not buttons', () => {
    renderHud(withHp(30, 40));
    for (const caption of ['Initiative', 'Proficiency']) {
      expect(
        screen.getByText(caption, { exact: true }).closest('button')
      ).toBeNull();
    }
  });

  it('shows the speed in feet', () => {
    renderHud(withHp(30, 40));
    expect(screen.getByRole('button', { name: '30ft Speed' })).toBeVisible();
  });

  it('still opens and closes the speed popover', () => {
    const props = hudProps(withHp(30, 40));
    render(<CharacterHUD {...props} onUpdateCharacter={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '30ft Speed' }));
    expect(screen.getByText('Walk')).toBeVisible();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Walk')).toBeNull();
  });

  it('shows spell tiles for a caster, opening the Spells tab', () => {
    const { props } = renderHud(withHp(30, 40, 0, { class: wizardClass }));
    fireEvent.click(screen.getByRole('button', { name: /Spell attack$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Spell save DC$/ }));
    expect(props.onNavigateToSpells).toHaveBeenCalledTimes(2);
  });

  it('shows no spell tiles for a non-caster', () => {
    renderHud(withHp(30, 40));
    expect(screen.queryByText('Spell attack')).toBeNull();
    expect(screen.queryByText('Spell save DC')).toBeNull();
  });
});

function activeCondition(name: string) {
  return {
    id: `condition-${name}`,
    name,
    source: 'XPHB',
    description: '',
    stackable: false,
    count: 1,
    appliedAt: '2026-10-28T00:00:00.000Z',
  };
}

function withConditions(
  names: string[],
  overrides: Partial<CharacterState> = {}
) {
  const base = withHp(30, 40, 0, overrides);
  return {
    ...base,
    conditionsAndDiseases: {
      ...base.conditionsAndDiseases,
      activeConditions: names.map(activeCondition),
    },
  };
}

describe('CharacterHUD concentration and conditions', () => {
  it('names the concentration spell and ends it from the chip', () => {
    const { props } = renderHud(
      withHp(30, 40, 0, {
        concentration: { isConcentrating: true, spellName: 'Hold Person' },
      })
    );
    expect(screen.getByText('Concentrating on Hold Person')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'End concentration' }));
    expect(props.onStopConcentration).toHaveBeenCalledTimes(1);
  });

  it('falls back to "spell" without a spell name', () => {
    renderHud(withHp(30, 40, 0, { concentration: { isConcentrating: true } }));
    expect(screen.getByText('Concentrating on spell')).toBeVisible();
  });

  it('only ends concentration from the X', () => {
    const { props } = renderHud(
      withHp(30, 40, 0, {
        concentration: { isConcentrating: true, spellName: 'Bless' },
      })
    );
    fireEvent.click(screen.getByText('Concentrating on Bless'));
    expect(props.onStopConcentration).not.toHaveBeenCalled();
  });

  it('counts conditions and opens the Combat tab', () => {
    const { props } = renderHud(
      withConditions(['Poisoned', 'Prone', 'Blinded'])
    );
    const count = screen.getByRole('button', {
      name: '3 conditions. Open the Combat tab',
    });
    expect(count).toHaveTextContent('3');
    expect(count).not.toHaveAttribute('title');
    expect(count).not.toHaveClass('animate-condition-pulse');
    fireEvent.click(count);
    expect(props.onNavigateToConditions).toHaveBeenCalledTimes(1);
  });

  it('says "1 condition" for one', () => {
    renderHud(withConditions(['Poisoned']));
    expect(
      screen.getByRole('button', { name: '1 condition. Open the Combat tab' })
    ).toBeVisible();
  });

  it('shows no count without conditions', () => {
    renderHud(withConditions([]));
    expect(screen.queryByRole('button', { name: /condition/ })).toBeNull();
  });
});

describe('CharacterHUD speed tile and sheet mode', () => {
  it('is a plain tile in play mode, with no popover', () => {
    const props = hudProps(withHp(30, 40));
    render(
      <CharacterHUD {...props} editing={false} onUpdateCharacter={vi.fn()} />
    );
    expect(screen.queryByRole('button', { name: /Speed$/ })).toBeNull();
    expect(screen.queryByTitle('Click to edit speeds')).toBeNull();
    fireEvent.click(screen.getByText('Speed'));
    expect(screen.queryByText('Walk')).toBeNull();
  });

  it('shows the same speed text in play mode', () => {
    const props = hudProps(withHp(30, 40));
    const { container } = render(<CharacterHUD {...props} editing={false} />);
    expect(container).toHaveTextContent('30ft Speed');
  });

  it('opens the popover in edit mode', () => {
    const props = hudProps(withHp(30, 40));
    render(<CharacterHUD {...props} editing onUpdateCharacter={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '30ft Speed' }));
    expect(screen.getByText('Walk')).toBeVisible();
  });

  it('closes the popover when play mode starts, so edit mode reopens it shut', () => {
    const props = hudProps(withHp(30, 40));
    const onUpdateCharacter = vi.fn();
    const { rerender } = render(
      <CharacterHUD {...props} editing onUpdateCharacter={onUpdateCharacter} />
    );
    fireEvent.click(screen.getByRole('button', { name: '30ft Speed' }));
    expect(screen.getByText('Walk')).toBeVisible();

    rerender(
      <CharacterHUD
        {...props}
        editing={false}
        onUpdateCharacter={onUpdateCharacter}
      />
    );
    rerender(
      <CharacterHUD {...props} editing onUpdateCharacter={onUpdateCharacter} />
    );

    expect(screen.queryByText('Walk')).toBeNull();
  });
});
