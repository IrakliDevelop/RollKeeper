import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import CharacterBasicInfo from '../CharacterBasicInfo';
vi.mock('@/hooks/useClassData', () => ({
  useClassData: () => ({ classData: [], loading: false, error: null }),
}));
afterEach(cleanup);
const character = makeCharacter({ level: 5 });
function props() {
  return {
    character,
    race: 'Human',
    characterClass: character.class,
    level: 5,
    background: 'Soldier',
    playerName: 'Sam',
    alignment: 'Neutral',
    creatureType: 'Humanoid',
    onUpdateRace: vi.fn(),
    onUpdateClass: vi.fn(),
    onUpdateLevel: vi.fn(),
    onUpdateBackground: vi.fn(),
    onUpdatePlayerName: vi.fn(),
    onUpdateAlignment: vi.fn(),
    onUpdateCreatureType: vi.fn(),
    onAddClassLevel: vi.fn(),
    onRemoveClassLevel: vi.fn(),
    onUpdateClassLevel: vi.fn(),
    getClassDisplayString: () => 'Fighter 5',
  };
}
it('shows information without build controls in play mode', () => {
  render(<CharacterBasicInfo {...props()} editing={false} />);
  expect(
    screen.getByRole('heading', { name: 'Character information' })
  ).toBeVisible();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Manage classes' })).toBeNull();
});
it('frames read-only values without adding editable controls', () => {
  const { container } = render(
    <CharacterBasicInfo {...props()} editing={false} />
  );
  const list = container.querySelector('dl');
  expect(list).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
  expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  expect(container.querySelector('dt')).toHaveClass('type-caption');
  expect(screen.getByText('Fighter 5').closest('dd')).toHaveClass(
    'min-h-10',
    'border',
    'border-input-border'
  );
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(list?.querySelector('[tabindex]')).toBeNull();
});
it('commits level once and opens Manage classes as a dialog', () => {
  const p = props();
  render(<CharacterBasicInfo {...p} editing />);
  const level = screen.getByRole('textbox', { name: 'Level' });
  fireEvent.change(level, { target: { value: '1' } });
  fireEvent.change(level, { target: { value: '12' } });
  expect(p.onUpdateLevel).not.toHaveBeenCalled();
  fireEvent.blur(level);
  expect(p.onUpdateLevel).toHaveBeenCalledExactlyOnceWith(12);
  fireEvent.click(screen.getByRole('button', { name: 'Manage classes' }));
  expect(screen.getByRole('dialog', { name: 'Manage classes' })).toBeVisible();
});

it('retains used hit dice and slots while replacing level 5 with 12', async () => {
  const { useCharacterStore } = await import('@/store/characterStore');
  const cls = {
    name: 'Wizard',
    isCustom: false,
    spellcaster: 'full' as const,
    hitDie: 6,
  };
  useCharacterStore.setState({
    character: makeCharacter({
      class: cls,
      classes: [
        {
          className: 'Wizard',
          level: 5,
          isCustom: false,
          spellcaster: 'full',
          hitDie: 6,
        },
      ],
      level: 5,
      totalLevel: 5,
      hitDicePools: { d6: { max: 5, used: 4 } },
      spellSlots: {
        ...makeCharacter().spellSlots,
        1: { max: 4, used: 4 },
        2: { max: 3, used: 3 },
        3: { max: 2, used: 2 },
      },
    }),
  });
  const p = props();
  render(
    <CharacterBasicInfo
      {...p}
      character={useCharacterStore.getState().character}
      editing
      onUpdateLevel={useCharacterStore.getState().updateLevel}
    />
  );
  const field = screen.getByRole('textbox', { name: 'Level' });
  fireEvent.change(field, { target: { value: '1' } });
  expect(useCharacterStore.getState().character.level).toBe(5);
  fireEvent.change(field, { target: { value: '12' } });
  fireEvent.blur(field);
  const saved = useCharacterStore.getState().character;
  expect(saved.level).toBe(12);
  expect(saved.hitDicePools!.d6.used).toBe(4);
  expect(saved.spellSlots[1].used).toBe(4);
  expect(saved.spellSlots[3].used).toBe(2);
});
