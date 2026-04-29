import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { makeCharacter } from '@/utils/__tests__/test-utils';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, priority, ...rest } = props as Record<string, unknown>;
    return <img {...rest} />;
  },
}));

vi.mock('@/hooks/useClassData', () => ({
  useClassData: () => ({
    classData: [],
    loading: false,
    error: null,
  }),
}));

describe('CharacterHUD', () => {
  it('renders without crashing', async () => {
    const { default: CharacterHUD } = await import(
      '@/components/ui/character/CharacterHUD'
    );
    const character = makeCharacter();
    render(
      <CharacterHUD
        character={character}
        onShortRest={vi.fn()}
        onLongRest={vi.fn()}
        onIncrementDays={vi.fn()}
        onDecrementDays={vi.fn()}
        onToggleInspiration={vi.fn()}
        onToggleReaction={vi.fn()}
        onStopConcentration={vi.fn()}
      />
    );
    expect(screen.getByTitle('AC')).toBeInTheDocument();
  });

  it('displays HP and AC values', async () => {
    const { default: CharacterHUD } = await import(
      '@/components/ui/character/CharacterHUD'
    );
    const character = makeCharacter({
      hitPoints: {
        current: 30,
        max: 40,
        temporary: 5,
        calculationMode: 'auto',
      },
    });
    render(
      <CharacterHUD
        character={character}
        onShortRest={vi.fn()}
        onLongRest={vi.fn()}
        onIncrementDays={vi.fn()}
        onDecrementDays={vi.fn()}
        onToggleInspiration={vi.fn()}
        onToggleReaction={vi.fn()}
        onStopConcentration={vi.fn()}
      />
    );
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('+5')).toBeInTheDocument();
  });
});

describe('CharacterHeader', () => {
  it('renders without crashing', async () => {
    const { CharacterHeader } = await import(
      '@/components/shared/character/CharacterHeader'
    );
    render(<CharacterHeader name="Gandalf" />);
    expect(screen.getByText('Character Information')).toBeInTheDocument();
  });

  it('displays character name and race', async () => {
    const { CharacterHeader } = await import(
      '@/components/shared/character/CharacterHeader'
    );
    render(
      <CharacterHeader
        name="Gandalf"
        race="Human"
        classInfo={{
          name: 'Wizard',
          isCustom: false,
          spellcaster: 'full',
          hitDie: 6,
        }}
        level={20}
        readonly
      />
    );
    expect(screen.getByText('Gandalf')).toBeInTheDocument();
    expect(screen.getByText('Human')).toBeInTheDocument();
    expect(screen.getByText('Level 20 Wizard')).toBeInTheDocument();
  });
});

describe('CharacterBasicInfo', () => {
  it('renders without crashing', async () => {
    const { default: CharacterBasicInfo } = await import(
      '@/components/ui/character/CharacterBasicInfo'
    );
    const character = makeCharacter();
    render(
      <CharacterBasicInfo
        character={character}
        race="Human"
        characterClass={character.class}
        level={5}
        background="Soldier"
        playerName="Tester"
        alignment="Neutral Good"
        creatureType="Humanoid"
        onUpdateRace={vi.fn()}
        onUpdateClass={vi.fn()}
        onUpdateLevel={vi.fn()}
        onUpdateBackground={vi.fn()}
        onUpdatePlayerName={vi.fn()}
        onUpdateAlignment={vi.fn()}
        onUpdateCreatureType={vi.fn()}
        onAddClassLevel={vi.fn()}
        onRemoveClassLevel={vi.fn()}
        onUpdateClassLevel={vi.fn()}
        getClassDisplayString={() => 'Fighter 5'}
      />
    );
    expect(screen.getAllByText('Character Information').length).toBeGreaterThan(
      0
    );
  });

  it('displays race and background inputs', async () => {
    const { default: CharacterBasicInfo } = await import(
      '@/components/ui/character/CharacterBasicInfo'
    );
    const character = makeCharacter();
    render(
      <CharacterBasicInfo
        character={character}
        race="Human"
        characterClass={character.class}
        level={5}
        background="Soldier"
        playerName="Tester"
        alignment="Neutral Good"
        creatureType="Humanoid"
        onUpdateRace={vi.fn()}
        onUpdateClass={vi.fn()}
        onUpdateLevel={vi.fn()}
        onUpdateBackground={vi.fn()}
        onUpdatePlayerName={vi.fn()}
        onUpdateAlignment={vi.fn()}
        onUpdateCreatureType={vi.fn()}
        onAddClassLevel={vi.fn()}
        onRemoveClassLevel={vi.fn()}
        onUpdateClassLevel={vi.fn()}
        getClassDisplayString={() => 'Fighter 5'}
      />
    );
    expect(screen.getAllByDisplayValue('Human').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('Soldier').length).toBeGreaterThan(0);
  });
});

describe('MulticlassManager', () => {
  it('renders without crashing', async () => {
    const { default: MulticlassManager } = await import(
      '@/components/ui/character/MulticlassManager'
    );
    const character = makeCharacter({
      classes: [
        { className: 'Fighter', level: 3, spellcaster: 'none', hitDie: 10 },
        { className: 'Wizard', level: 2, spellcaster: 'full', hitDie: 6 },
      ],
    });
    render(
      <MulticlassManager
        character={character}
        onAddClassLevel={vi.fn()}
        onRemoveClassLevel={vi.fn()}
        onUpdateClassLevel={vi.fn()}
      />
    );
    expect(screen.getByText('Multiclass Levels')).toBeInTheDocument();
  });

  it('displays class names and total level', async () => {
    const { default: MulticlassManager } = await import(
      '@/components/ui/character/MulticlassManager'
    );
    const character = makeCharacter({
      classes: [
        { className: 'Fighter', level: 3, spellcaster: 'none', hitDie: 10 },
        { className: 'Wizard', level: 2, spellcaster: 'full', hitDie: 6 },
      ],
    });
    render(
      <MulticlassManager
        character={character}
        onAddClassLevel={vi.fn()}
        onRemoveClassLevel={vi.fn()}
        onUpdateClassLevel={vi.fn()}
      />
    );
    expect(screen.getAllByText('Fighter').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Wizard').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Total Character Level:').length
    ).toBeGreaterThan(0);
  });
});

describe('ArmorClassManager', () => {
  it('renders without crashing', async () => {
    const { default: ArmorClassManager } = await import(
      '@/components/ui/character/ArmorClassManager'
    );
    const character = makeCharacter();
    render(
      <ArmorClassManager
        character={character}
        onUpdateArmorClass={vi.fn()}
        onUpdateTempArmorClass={vi.fn()}
        onToggleTempAC={vi.fn()}
        onToggleShield={vi.fn()}
        onUpdateShieldBonus={vi.fn()}
      />
    );
    expect(
      screen.getByText('ARMOR CLASS', { exact: false })
    ).toBeInTheDocument();
  });

  it('displays AC sections', async () => {
    const { default: ArmorClassManager } = await import(
      '@/components/ui/character/ArmorClassManager'
    );
    const character = makeCharacter({ armorClass: 18 });
    render(
      <ArmorClassManager
        character={character}
        onUpdateArmorClass={vi.fn()}
        onUpdateTempArmorClass={vi.fn()}
        onToggleTempAC={vi.fn()}
        onToggleShield={vi.fn()}
        onUpdateShieldBonus={vi.fn()}
      />
    );
    expect(screen.getAllByText('Total AC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Base AC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Temp AC').length).toBeGreaterThan(0);
  });
});

describe('CombatStats', () => {
  it('renders without crashing', async () => {
    const { default: CombatStats } = await import(
      '@/components/ui/character/CombatStats'
    );
    const character = makeCharacter();
    render(
      <CombatStats
        character={character}
        getInitiativeModifier={() => 2}
        onUpdateInitiative={vi.fn()}
        onResetInitiativeToDefault={vi.fn()}
        onUpdateSpeed={vi.fn()}
        onUpdateCharacter={vi.fn()}
        onToggleReaction={vi.fn()}
        onResetReaction={vi.fn()}
        onRollInitiative={vi.fn()}
      />
    );
    expect(screen.getByText('INITIATIVE')).toBeInTheDocument();
  });

  it('displays speed and reaction sections', async () => {
    const { default: CombatStats } = await import(
      '@/components/ui/character/CombatStats'
    );
    const character = makeCharacter();
    render(
      <CombatStats
        character={character}
        getInitiativeModifier={() => 2}
        onUpdateInitiative={vi.fn()}
        onResetInitiativeToDefault={vi.fn()}
        onUpdateSpeed={vi.fn()}
        onUpdateCharacter={vi.fn()}
        onToggleReaction={vi.fn()}
        onResetReaction={vi.fn()}
        onRollInitiative={vi.fn()}
      />
    );
    expect(screen.getAllByText('SPEED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('REACTION').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
  });
});

describe('Skills', () => {
  it('renders without crashing', async () => {
    const { default: Skills } = await import(
      '@/components/ui/character/Skills'
    );
    const character = makeCharacter();
    render(
      <Skills
        skills={character.skills}
        jackOfAllTrades={false}
        proficiencyBonus={3}
        getSkillModifier={() => 2}
        onUpdateSkillProficiency={vi.fn()}
        onUpdateSkillExpertise={vi.fn()}
        onToggleJackOfAllTrades={vi.fn()}
        onRollSkillCheck={vi.fn()}
      />
    );
    expect(screen.getByText('Skills')).toBeInTheDocument();
  });

  it('displays skill names', async () => {
    const { default: Skills } = await import(
      '@/components/ui/character/Skills'
    );
    const character = makeCharacter();
    render(
      <Skills
        skills={character.skills}
        jackOfAllTrades={false}
        proficiencyBonus={3}
        getSkillModifier={() => 2}
        onUpdateSkillProficiency={vi.fn()}
        onUpdateSkillExpertise={vi.fn()}
        onToggleJackOfAllTrades={vi.fn()}
        onRollSkillCheck={vi.fn()}
      />
    );
    expect(screen.getAllByText('Athletics').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Perception').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Stealth').length).toBeGreaterThan(0);
  });
});

describe('AbilityScoreDisplay', () => {
  it('renders without crashing', async () => {
    const { AbilityScoreDisplay } = await import(
      '@/components/shared/stats/AbilityScoreDisplay'
    );
    const character = makeCharacter();
    render(<AbilityScoreDisplay abilities={character.abilities} readonly />);
    expect(screen.getByText('Ability Scores')).toBeInTheDocument();
  });

  it('displays ability scores and modifiers', async () => {
    const { AbilityScoreDisplay } = await import(
      '@/components/shared/stats/AbilityScoreDisplay'
    );
    const abilities = {
      strength: 16,
      dexterity: 14,
      constitution: 14,
      intelligence: 10,
      wisdom: 12,
      charisma: 8,
    };
    render(<AbilityScoreDisplay abilities={abilities} readonly />);
    expect(screen.getAllByText('STR').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DEX').length).toBeGreaterThan(0);
    expect(screen.getAllByText('16').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+3').length).toBeGreaterThan(0);
  });
});

describe('DaysSpentTracker', () => {
  it('renders without crashing', async () => {
    const { default: DaysSpentTracker } = await import(
      '@/components/ui/character/DaysSpentTracker'
    );
    render(
      <DaysSpentTracker
        daysSpent={10}
        onUpdateDays={vi.fn()}
        onIncrementDays={vi.fn()}
      />
    );
    expect(screen.getByText('Campaign Days')).toBeInTheDocument();
  });

  it('displays day count and week breakdown', async () => {
    const { default: DaysSpentTracker } = await import(
      '@/components/ui/character/DaysSpentTracker'
    );
    render(
      <DaysSpentTracker
        daysSpent={10}
        onUpdateDays={vi.fn()}
        onIncrementDays={vi.fn()}
      />
    );
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 week/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3 days/).length).toBeGreaterThan(0);
  });
});
