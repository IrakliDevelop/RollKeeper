import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import type { CharacterState } from '@/types/character';
import type { ProcessedClass, ProcessedSubclass } from '@/types/classes';
import { useLevelUpWizard } from './LevelUpWizard.hooks';

const subclass = (source: string): ProcessedSubclass => ({
  id: `champion-${source}`,
  name: 'Champion',
  shortName: 'Champion',
  source,
  parentClassName: 'Fighter',
  parentClassSource: source,
  features: [],
  tags: [],
});

const fighter = (source: string): ProcessedClass => ({
  id: `fighter-${source}`,
  name: 'Fighter',
  source,
  hitDie: 'd10',
  primaryAbilities: [],
  spellcasting: { type: 'none' },
  proficiencies: { savingThrows: [] },
  startingEquipment: [],
  features: [
    {
      name: 'Martial Archetype',
      level: 3,
      source,
      isSubclassFeature: false,
      original: '',
    },
  ],
  subclasses: [subclass(source)],
  isSrd: true,
  tags: [],
});

vi.mock('@/hooks/useClassData', () => ({
  useClassData: () => ({
    classData: [fighter('PHB'), fighter('XPHB')],
    loading: false,
    error: null,
  }),
}));
vi.mock('@/hooks/useSpellsData', () => ({
  useSpellsData: () => ({ spells: [], loading: false, error: null }),
}));

describe('useLevelUpWizard edition choice', () => {
  beforeEach(() => {
    useCharacterStore.setState({
      character: {
        ...DEFAULT_CHARACTER_STATE,
        id: 'edition-reset',
        level: 2,
        totalLevel: 2,
        classes: [
          { className: 'Fighter', level: 2, isCustom: false, hitDie: 10 },
        ],
      } as CharacterState,
    });
  });

  it('clears choices made for the previous edition when the edition changes', () => {
    const character = useCharacterStore.getState().character;
    const { result } = renderHook(() => useLevelUpWizard(character));

    act(() => result.current.setSelectedEdition('PHB'));
    act(() => result.current.setSelectedSubclass(subclass('PHB')));
    act(() =>
      result.current.setFeatureChoices({ 'Fighting Style': 'Dueling' })
    );
    expect(result.current.state.selectedSubclass?.source).toBe('PHB');

    act(() => result.current.setSelectedEdition('XPHB'));
    expect(result.current.state.selectedEdition).toBe('XPHB');
    expect(result.current.state.selectedSubclass).toBeUndefined();
    expect(result.current.state.featureChoices).toEqual({});
  });

  it('keeps choices when the same edition is picked again', () => {
    const character = useCharacterStore.getState().character;
    const { result } = renderHook(() => useLevelUpWizard(character));

    act(() => result.current.setSelectedEdition('PHB'));
    act(() => result.current.setSelectedSubclass(subclass('PHB')));
    act(() => result.current.setSelectedEdition('PHB'));
    expect(result.current.state.selectedSubclass?.source).toBe('PHB');
  });
});
