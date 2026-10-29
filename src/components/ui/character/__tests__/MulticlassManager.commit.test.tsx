import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import { useCharacterStore } from '@/store/characterStore';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import MulticlassManager from '../MulticlassManager';
vi.mock('@/hooks/useClassData', () => ({
  useClassData: () => ({
    classData: [
      { name: 'Wizard', spellcasting: { type: 'full' }, hitDie: 'd6' },
    ],
    loading: false,
    error: null,
  }),
}));
vi.mock('@/components/ui/feedback/confirm-dialog', () => ({
  confirmDialog: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function character() {
  return makeCharacter({
    class: { name: 'Wizard', isCustom: false, spellcaster: 'full', hitDie: 6 },
    classes: [
      {
        className: 'Wizard',
        level: 5,
        isCustom: false,
        spellcaster: 'full',
        hitDie: 6,
      },
      {
        className: 'Fighter',
        level: 1,
        isCustom: false,
        spellcaster: 'none',
        hitDie: 10,
      },
    ],
    level: 6,
    totalLevel: 6,
    hitDicePools: { d6: { max: 5, used: 4 }, d10: { max: 1, used: 1 } },
    spellSlots: {
      ...makeCharacter().spellSlots,
      1: { max: 4, used: 4 },
      3: { max: 2, used: 2 },
    },
  });
}
it('commits a multiclass level once without losing spent dice or slots', () => {
  const c = character();
  useCharacterStore.setState({ character: c });
  render(
    <MulticlassManager
      character={c}
      onAddClassLevel={vi.fn()}
      onRemoveClassLevel={vi.fn()}
      onUpdateClassLevel={useCharacterStore.getState().updateClassLevel}
    />
  );
  const field = screen.getByRole('textbox', { name: 'Wizard level' });
  fireEvent.change(field, { target: { value: '1' } });
  expect(useCharacterStore.getState().character.classes![0].level).toBe(5);
  fireEvent.change(field, { target: { value: '12' } });
  fireEvent.blur(field);
  const saved = useCharacterStore.getState().character;
  expect(saved.classes![0].level).toBe(12);
  expect(saved.hitDicePools!.d6.used).toBe(4);
  expect(saved.spellSlots[1].used).toBe(4);
  expect(saved.spellSlots[3].used).toBe(2);
});
it('requires the danger confirmation before removing a class level', async () => {
  const remove = vi.fn();
  vi.mocked(confirmDialog)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  const user = (await import('@testing-library/user-event')).default.setup();
  render(
    <MulticlassManager
      character={character()}
      onAddClassLevel={vi.fn()}
      onRemoveClassLevel={remove}
      onUpdateClassLevel={vi.fn()}
    />
  );
  const trigger = screen.getByRole('button', {
    name: 'Remove Wizard class level',
  });
  await user.click(trigger);
  expect(remove).not.toHaveBeenCalled();
  expect(confirmDialog).toHaveBeenCalledWith({
    title: 'Remove Wizard class level?',
    confirmLabel: 'Remove class level',
    tone: 'danger',
  });
  await user.click(trigger);
  expect(remove).toHaveBeenCalledExactlyOnceWith('Wizard');
});
