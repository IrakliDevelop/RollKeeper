import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, mocked, userEvent, waitFor, within } from 'storybook/test';
import { useClassData } from '@/hooks/useClassData';
import { useSpellsData } from '@/hooks/useSpellsData';
import { useFeatsData } from '@/hooks/useFeatsData';
import { useCharacterStore } from '@/store/characterStore';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import type { CharacterState } from '@/types/character';
import type { ProcessedClass } from '@/types/classes';
import type { ProcessedFeat } from '@/utils/featDataLoader';
import LevelUpWizard from './index';

const asiFeature = {
  name: 'Ability Score Improvement',
  level: 4,
  source: 'PHB',
  isSubclassFeature: false,
  original: '',
};

const longChoice = 'A very long option name that must wrap inside the wizard';
const choiceFeature = {
  name: 'A very long class feature name for a narrow phone dialog',
  level: 4,
  source: 'PHB',
  isSubclassFeature: false,
  original: '',
  choice: {
    count: 1,
    options: [
      { name: longChoice, entries: ['The chosen path.'] },
      { name: 'Short option', entries: ['Another path.'] },
    ],
  },
};

const feat = (id: string, name: string): ProcessedFeat => ({
  id,
  name,
  source: 'PHB',
  description: `<p>${name}</p>`,
  prerequisites: [],
  abilityIncreases: '',
  repeatable: false,
  grantsSpells: false,
  isSrd: true,
  tags: [],
});

const fighter = (source: string, richChoices = false): ProcessedClass => ({
  id: `fighter-${source}`,
  name: 'Fighter',
  source,
  hitDie: 'd10',
  primaryAbilities: [],
  spellcasting: { type: 'none' },
  proficiencies: { savingThrows: [] },
  startingEquipment: [],
  features: [
    { ...asiFeature, source },
    ...(richChoices ? [{ ...choiceFeature, source }] : []),
  ],
  subclasses: [],
  isSrd: true,
  tags: [],
});

function character(multiclass = false): CharacterState {
  return {
    ...DEFAULT_CHARACTER_STATE,
    id: 'wizard-story',
    name: 'Mira Vale',
    class: {
      name: 'Fighter',
      isCustom: false,
      hitDie: 10,
      spellcaster: 'none',
    },
    level: 3,
    totalLevel: 3,
    classes: multiclass
      ? [
          { className: 'Fighter', level: 2, isCustom: false, hitDie: 10 },
          { className: 'Rogue', level: 1, isCustom: false, hitDie: 8 },
        ]
      : [{ className: 'Fighter', level: 3, isCustom: false, hitDie: 10 }],
    abilities: { ...DEFAULT_CHARACTER_STATE.abilities, constitution: 13 },
    hitPoints: {
      ...DEFAULT_CHARACTER_STATE.hitPoints,
      max: 24,
      current: 19,
      calculationMode: 'manual',
    },
  } as CharacterState;
}

const meta: Meta<typeof LevelUpWizard> = {
  title: 'Character/LevelUpWizard',
  component: LevelUpWizard,
  args: { isOpen: true, onClose: fn() },
  parameters: { a11y: { test: 'error' } },
  beforeEach: ({ parameters }) => {
    mocked(useClassData).mockReturnValue({
      classData: [
        fighter('PHB', parameters.richChoices === true),
        fighter('PHB2024', parameters.richChoices === true),
        ...(parameters.multiclass === true
          ? [
              { ...fighter('PHB'), id: 'rogue-PHB', name: 'Rogue' },
              { ...fighter('PHB2024'), id: 'rogue-PHB2024', name: 'Rogue' },
            ]
          : []),
      ],
      loading: false,
      error: null,
    });
    mocked(useSpellsData).mockReturnValue({
      spells: [],
      loading: false,
      error: null,
      searchResults: () => [],
      getSpellById: () => undefined,
      getSpellByName: () => undefined,
    });
    mocked(useFeatsData).mockReturnValue({
      feats:
        parameters.richChoices === true
          ? [feat('one', 'Alert'), feat('two', 'Athlete')]
          : [],
      loading: false,
      error: null,
      searchResults: () => [],
      getFeatByName: () => undefined,
    });
    useCharacterStore.setState({
      character: character(parameters.multiclass === true),
    });
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Edition: Story = {};

export const ASI: Story = {
  play: async () => {
    const page = within(document.body);
    await userEvent.click(page.getByRole('radio', { name: /2024 rules/i }));
    await waitFor(() =>
      expect(
        page.getByRole('heading', { name: /Choose your rules edition/i })
      ).toBeVisible()
    );
    await userEvent.click(page.getByRole('button', { name: 'Next' }));
    expect(
      page.getByRole('heading', { name: 'Ability Score Improvement' })
    ).toBeVisible();
    expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  },
};

export const ASIValidation: Story = {
  play: async () => {
    const page = within(document.body);
    await userEvent.click(page.getByRole('radio', { name: /2024 rules/i }));
    await userEvent.click(page.getByRole('button', { name: 'Next' }));
    const next = page.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
    await userEvent.click(
      page.getByRole('button', { name: 'Raise constitution' })
    );
    expect(next).toBeDisabled();
    await userEvent.click(
      page.getByRole('button', { name: 'Raise constitution' })
    );
    expect(next).toBeEnabled();
    await userEvent.click(page.getByRole('button', { name: 'Take a feat' }));
    expect(next).toBeDisabled();
  },
};

export const HPReview: Story = {
  play: async () => {
    const page = within(document.body);
    await userEvent.click(page.getByRole('radio', { name: /2024 rules/i }));
    await userEvent.click(page.getByRole('button', { name: 'Next' }));
    await userEvent.click(
      page.getByRole('button', { name: 'Raise constitution' })
    );
    await userEvent.click(
      page.getByRole('button', { name: 'Raise constitution' })
    );
    await userEvent.click(page.getByRole('button', { name: 'Next' }));
    await userEvent.type(
      page.getByRole('textbox', { name: /Hit die roll/i }),
      '5'
    );
    expect(page.getByText('Total HP gained: +10')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Next' }));
    expect(page.getByText(/\+10 \(d10/)).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Level up' }));
    expect(useCharacterStore.getState().character.hitPoints.max).toBe(34);
    expect(useCharacterStore.getState().character.hitPoints.current).toBe(29);
  },
};

export const Multiclass: Story = {
  parameters: { multiclass: true },
  play: async () => {
    const page = within(document.body);
    await userEvent.click(page.getByRole('radio', { name: /Fighter/ }));
    await waitFor(() =>
      expect(
        page.getByRole('heading', {
          name: 'Choose the class that gains a level',
        })
      ).toBeVisible()
    );
    await userEvent.click(page.getByRole('button', { name: 'Next' }));
    expect(
      page.getByRole('heading', { name: 'Choose your rules edition' })
    ).toBeVisible();
    await userEvent.click(page.getByRole('radio', { name: /2024 rules/i }));
    await userEvent.click(page.getByRole('button', { name: 'Back' }));
    await userEvent.click(page.getByRole('radio', { name: /Rogue/ }));
    await userEvent.click(page.getByRole('button', { name: 'Next' }));
    expect(page.getByRole('radio', { name: /2024 rules/i })).not.toBeChecked();
    expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  },
};

export const RichChoices: Story = {
  parameters: { richChoices: true },
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  play: async () => {
    const page = within(document.body);
    await userEvent.click(page.getByRole('radio', { name: /2024 rules/i }));
    await userEvent.click(page.getByRole('button', { name: 'Next' }));
    const option = page.getByRole('radio', { name: longChoice });
    await userEvent.click(option);
    expect(option).toBeChecked();
    const dialog = page.getByRole('dialog');
    expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth);
    await userEvent.click(page.getByRole('button', { name: 'Next' }));
    await userEvent.click(page.getByRole('button', { name: 'Take a feat' }));
    const first = page.getByRole('radio', { name: 'Alert' });
    await userEvent.click(first);
    expect(first).toBeChecked();
    first.focus();
    expect(document.activeElement).toBe(first);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(
      page.getByRole('radio', { name: 'Athlete' })
    );
    await userEvent.keyboard(' ');
    await waitFor(() =>
      expect(page.getByRole('radio', { name: 'Athlete' })).toBeChecked()
    );
  },
};
