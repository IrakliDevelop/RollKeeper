// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DetailAbilityScores } from '@/components/ui/encounter/combat-screen/detail/DetailAbilityScores';
import type { EncounterEntity, MonsterStatBlock } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

afterEach(cleanup);

function makeActions(): EntityActions {
  return {
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
    onDamage: vi.fn(),
    onHeal: vi.fn(),
    onAddTempHp: vi.fn(),
    onSetMaxHp: vi.fn(),
    onAddCondition: vi.fn(),
    onRemoveCondition: vi.fn(),
    onSetConditionRounds: vi.fn(),
    onUseAbility: vi.fn(),
    onRestoreAbility: vi.fn(),
    onUseLegendaryAction: vi.fn(),
    onResetLegendaryActions: vi.fn(),
    onSetConcentration: vi.fn(),
    onUseLairAction: vi.fn(),
    onSetInitiative: vi.fn(),
    onLongRest: vi.fn(),
  };
}

// Mods: STR +5, DEX +4, CON +3, INT +2, WIS +1, CHA -1 — all distinct so
// every fallback "SV <mod>" string is unique in the grid.
const statBlock: MonsterStatBlock = {
  str: 20,
  dex: 18,
  con: 16,
  int: 15,
  wis: 12,
  cha: 8,
  saves: 'Dex +9, Con +8',
  skills: '',
  speed: '30 ft.',
  resistances: '',
  immunities: '',
  vulnerabilities: '',
  conditionImmunities: [],
  senses: '',
  passivePerception: 10,
  traits: [],
  actions: [],
  bonusActions: [],
  reactions: [],
  lairActions: [],
  cr: '5',
  type: 'fiend',
  size: 'Large',
  languages: 'Common',
  alignment: 'Lawful Evil',
  hpFormula: '10d10+30',
};

const monsterEntity: EncounterEntity = {
  id: 'monster-1',
  type: 'monster',
  name: 'Abhorrent Overlord',
  initiative: 12,
  initiativeModifier: 4,
  currentHp: 85,
  maxHp: 85,
  tempHp: 0,
  armorClass: 16,
  conditions: [],
  monsterStatBlock: statBlock,
};

describe('DetailAbilityScores — saves column', () => {
  it('shows the parsed save for proficient abilities (amber) and the modifier fallback for the rest (faint)', () => {
    render(
      <DetailAbilityScores entity={monsterEntity} actions={makeActions()} />
    );

    const dexSave = screen.getByText('SV +9');
    expect(dexSave).toHaveClass('text-accent-amber-text');
    const conSave = screen.getByText('SV +8');
    expect(conSave).toHaveClass('text-accent-amber-text');

    const strSave = screen.getByText('SV +5');
    expect(strSave).toHaveClass('text-faint');
    expect(screen.getByText('SV +2')).toHaveClass('text-faint'); // INT
    expect(screen.getByText('SV +1')).toHaveClass('text-faint'); // WIS
    expect(screen.getByText('SV -1')).toHaveClass('text-faint'); // CHA
  });

  it('re-renders save values when the entity saves string changes (grid derives from the prop)', () => {
    const actions = makeActions();
    const { rerender } = render(
      <DetailAbilityScores entity={monsterEntity} actions={actions} />
    );
    expect(screen.getByText('SV +9')).toBeInTheDocument();

    rerender(
      <DetailAbilityScores
        entity={{
          ...monsterEntity,
          monsterStatBlock: { ...statBlock, saves: 'Dex +12' },
        }}
        actions={actions}
      />
    );

    expect(screen.getByText('SV +12')).toBeInTheDocument();
    // CON is no longer proficient — falls back to its +3 modifier.
    expect(screen.getByText('SV +3')).toHaveClass('text-faint');
    expect(screen.queryByText('SV +8')).not.toBeInTheDocument();
  });
});
