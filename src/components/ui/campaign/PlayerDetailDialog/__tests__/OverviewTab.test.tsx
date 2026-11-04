import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { SWAP_ANIMATION } from '@/components/ui/game/abilityNumbers';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import { calculateCharacterArmorClass } from '@/utils/calculations';
import { HP_STATUS_LABELS, hpStatus } from '@/utils/hpState';
import type { CharacterState } from '@/types/character';
import { OverviewTab } from '../OverviewTab';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fighter(overrides: Partial<CharacterState> = {}): CharacterState {
  const base = makeCharacter();
  return {
    ...base,
    level: 5,
    totalLevel: 5,
    abilities: {
      strength: 16,
      dexterity: 14,
      constitution: 15,
      intelligence: 8,
      wisdom: 12,
      charisma: 10,
    },
    savingThrows: {
      ...base.savingThrows,
      strength: { proficient: true },
      dexterity: { proficient: false, customModifier: 1 },
    },
    ...overrides,
  };
}

describe('OverviewTab abilities', () => {
  it('shows the six abilities as a ledger row with every save', () => {
    const { container } = render(
      <OverviewTab name="Thorin" char={fighter()} counterValue={0} />
    );
    expect(container.querySelectorAll('[data-ledger-cell]')).toHaveLength(6);
    // Level 5: proficiency bonus +3.
    expect(
      screen.getByRole('img', { name: 'Strength saving throw +6, proficient' })
    ).toHaveTextContent('Save +6');
    expect(
      screen.getByRole('img', { name: 'Dexterity saving throw +3' })
    ).toHaveTextContent('Save +3');
    expect(
      screen.getByRole('img', { name: 'Strength: modifier +3, score 16' })
    ).toBeInTheDocument();
  });

  it('is read-only: no rolls, no score editor', () => {
    render(<OverviewTab name="Thorin" char={fighter()} counterValue={0} />);
    expect(screen.queryByRole('button', { name: /^Roll / })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /^Strength: modifier/ })
    ).toBeNull();
  });

  it('heads the row "Abilities" with the DM’s own "Scores large" switch', () => {
    const { container } = render(
      <OverviewTab name="Thorin" char={fighter()} counterValue={0} />
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'Abilities' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Ability Scores')).toBeNull();
    const row = container.querySelector('[data-ledger-row]')!;
    expect(row).toHaveAttribute('data-display', 'modifier');
    fireEvent.click(screen.getByRole('switch', { name: 'Scores large' }));
    expect(row).toHaveAttribute('data-display', 'score');
    expect(
      JSON.parse(localStorage.getItem('rollkeeper-ui-prefs') ?? '{}')
    ).toEqual({ abilityDisplay: 'score' });
  });

  it('reads an older character without saving throws', () => {
    const old = fighter({
      savingThrows: undefined as unknown as CharacterState['savingThrows'],
    });
    render(<OverviewTab name="Thorin" char={old} counterValue={0} />);
    expect(
      screen.getByRole('img', { name: 'Strength saving throw +3' })
    ).toBeInTheDocument();
  });

  it('uses the total level for a multiclass character’s saves', () => {
    render(
      <OverviewTab
        name="Thorin"
        char={fighter({ level: 1, totalLevel: 5 })}
        counterValue={0}
      />
    );
    expect(
      screen.getByRole('img', { name: 'Strength saving throw +6, proficient' })
    ).toBeInTheDocument();
  });

  it('animates a swap made with its own switch', () => {
    const { container } = render(
      <OverviewTab name="Thorin" char={fighter()} counterValue={0} />
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Scores large' }));
    expect(
      container.querySelector('[data-number="large"]')!.className
    ).toContain(SWAP_ANIMATION);
  });
});

function skillsSection(): HTMLElement {
  return screen
    .getByRole('heading', { level: 3, name: 'Skills' })
    .closest('section')!;
}

function encumbranceSection(): HTMLElement {
  return screen
    .getByRole('heading', { level: 3, name: 'Encumbrance' })
    .closest('section')!;
}

/** The `dd` that follows a vitals `dt`. */
function vital(term: string): HTMLElement {
  return screen.getByText(term, { selector: 'dt' })
    .nextElementSibling as HTMLElement;
}

describe('OverviewTab vitals and status', () => {
  it('shows HP, AC, speed, initiative and proficiency bonus', () => {
    const char = fighter({
      hitPoints: {
        current: 30,
        max: 44,
        temporary: 5,
        calculationMode: 'auto',
      },
      speed: 30,
    });
    const { rerender } = render(
      <OverviewTab name="Thorin" char={char} counterValue={0} />
    );
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('/ 44 HP')).toBeInTheDocument();
    expect(screen.getByText('+5 temp HP')).toBeInTheDocument();
    expect(
      screen.getByText(HP_STATUS_LABELS[hpStatus(30, 44)])
    ).toBeInTheDocument();
    expect(vital('AC')).toHaveTextContent(
      String(calculateCharacterArmorClass(char))
    );
    expect(vital('Speed')).toHaveTextContent('30 ft');
    expect(vital('Initiative')).toHaveTextContent('+2');
    expect(vital('Proficiency bonus')).toHaveTextContent('+3');
    expect(screen.queryByText('temporary AC')).toBeNull();

    rerender(
      <OverviewTab
        name="Thorin"
        char={{ ...char, isTempACActive: true }}
        counterValue={0}
      />
    );
    expect(screen.getByText('temporary AC')).toBeInTheDocument();
  });

  it('shows max 0 HP as Down', () => {
    render(
      <OverviewTab
        name="Thorin"
        char={fighter({
          hitPoints: {
            current: 0,
            max: 0,
            temporary: 0,
            calculationMode: 'auto',
          },
        })}
        counterValue={0}
      />
    );
    expect(screen.getByText('/ 0 HP')).toBeInTheDocument();
    expect(screen.getByText('Down')).toBeInTheDocument();
  });

  it('labels heroic inspiration with its count', () => {
    const { rerender } = render(
      <OverviewTab
        name="Thorin"
        char={fighter({ heroicInspiration: { count: 2, maxCount: 3 } })}
        counterValue={0}
      />
    );
    const two = screen.getByRole('img', { name: 'Heroic inspiration 2' });
    expect(two.querySelectorAll('span.rounded-full')).toHaveLength(2);

    rerender(
      <OverviewTab
        name="Thorin"
        char={fighter({ heroicInspiration: { count: 0, maxCount: 3 } })}
        counterValue={0}
      />
    );
    const none = screen.getByRole('img', { name: 'Heroic inspiration 0' });
    expect(none.querySelectorAll('span.rounded-full')).toHaveLength(0);
    expect(none).toHaveTextContent('0');
  });

  it('steps the counter with named buttons', () => {
    const onAdjust = vi.fn();
    const { rerender } = render(
      <OverviewTab
        name="Thorin"
        char={fighter()}
        customCounterLabel="Desperation"
        counterValue={0}
        onAdjustCounter={onAdjust}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Remove 1 Desperation from Thorin' })
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Add 1 Desperation to Thorin' })
    );
    expect(onAdjust).toHaveBeenCalledWith(1);

    rerender(
      <OverviewTab
        name="Thorin"
        char={fighter()}
        customCounterLabel="Desperation"
        counterValue={0}
      />
    );
    expect(screen.queryByRole('button', { name: /Desperation/ })).toBeNull();
  });

  it('heads each group as a level 3 section', () => {
    const { container, rerender } = render(
      <OverviewTab name="Thorin" char={fighter()} counterValue={0} />
    );
    for (const name of ['Abilities', 'Skills', 'Encumbrance']) {
      expect(
        screen.getByRole('heading', { level: 3, name })
      ).toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { name: 'Conditions' })).toBeNull();

    const base = fighter();
    rerender(
      <OverviewTab
        name="Thorin"
        char={{
          ...base,
          conditionsAndDiseases: {
            ...base.conditionsAndDiseases,
            activeConditions: [
              {
                id: 'c1',
                name: 'Poisoned',
                stackable: false,
                count: 1,
              } as CharacterState['conditionsAndDiseases']['activeConditions'][number],
            ],
          },
        }}
        counterValue={0}
      />
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'Conditions' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Status' })).toBeNull();
    expect(container.querySelector('.uppercase')).toBeNull();
  });

  it('marks skill proficiency with dots', () => {
    const base = fighter();
    render(
      <OverviewTab
        name="Thorin"
        char={fighter({
          jackOfAllTrades: true,
          skills: {
            ...base.skills,
            athletics: { proficient: true, expertise: false },
            stealth: { proficient: true, expertise: true },
          },
        })}
        counterValue={0}
      />
    );
    const skills = skillsSection();
    expect(skills.querySelector('[data-level="proficient"]')).not.toBeNull();
    expect(skills.querySelector('[data-level="expertise"]')).not.toBeNull();
    expect(skills.querySelector('[data-level="half"]')).not.toBeNull();
  });

  it('shows concentration and conditions as chips, diseases in blood', () => {
    const base = fighter();
    render(
      <OverviewTab
        name="Thorin"
        char={{
          ...base,
          concentration: { isConcentrating: true, spellName: 'Bless' },
          conditionsAndDiseases: {
            ...base.conditionsAndDiseases,
            activeConditions: [
              {
                id: 'c1',
                name: 'Poisoned',
                stackable: false,
                count: 1,
              } as CharacterState['conditionsAndDiseases']['activeConditions'][number],
            ],
            activeDiseases: [
              {
                id: 'd1',
                name: 'Sewer plague',
              } as CharacterState['conditionsAndDiseases']['activeDiseases'][number],
            ],
          },
        }}
        counterValue={0}
      />
    );
    expect(screen.getByText('Concentrating on Bless')).toBeInTheDocument();
    expect(screen.getByText('Poisoned')).toBeInTheDocument();
    expect(
      screen.getByText('Sewer plague').closest('[data-variant]')
    ).toHaveAttribute('data-variant', 'danger');
  });

  it('words attunement and encumbrance plainly', () => {
    const { rerender } = render(
      <OverviewTab
        name="Thorin"
        char={fighter({ attunementSlots: { used: 1, max: 3 } })}
        counterValue={0}
      />
    );
    expect(
      screen.getByText('1 of 3 attunement slots used')
    ).toBeInTheDocument();
    expect(screen.queryByText('Normal')).toBeNull();
    expect(
      within(encumbranceSection()).getByText(/ lb\.$/)
    ).toBeInTheDocument();

    rerender(
      <OverviewTab
        name="Thorin"
        char={fighter({
          inventoryItems: [
            { id: 'i1', name: 'Anvil', weight: 500, quantity: 1 },
          ] as unknown as CharacterState['inventoryItems'],
        })}
        counterValue={0}
      />
    );
    expect(screen.getByText('Over capacity')).toBeInTheDocument();
  });

  it('draws an empty bar at zero carrying capacity', () => {
    const base = fighter();
    render(
      <OverviewTab
        name="Thorin"
        char={fighter({ abilities: { ...base.abilities, strength: 0 } })}
        counterValue={0}
      />
    );
    // HpReadout's bar is also bg-surface-inset, so scope to the section.
    const track = encumbranceSection().querySelector('.bg-surface-inset')!;
    expect((track.firstElementChild as HTMLElement).style.width).toBe('0%');
  });

  it('reads an older synced blob', () => {
    const old = fighter({
      senses: {} as unknown as CharacterState['senses'],
      currency: undefined as unknown as CharacterState['currency'],
      conditionsAndDiseases:
        undefined as unknown as CharacterState['conditionsAndDiseases'],
      attunementSlots:
        undefined as unknown as CharacterState['attunementSlots'],
    });
    render(<OverviewTab name="Thorin" char={old} counterValue={0} />);
    expect(
      screen.getByRole('heading', { level: 3, name: 'Encumbrance' })
    ).toBeInTheDocument();
    for (const name of ['Currency', 'Conditions', 'Attunement']) {
      expect(screen.queryByRole('heading', { name })).toBeNull();
    }
  });
});
