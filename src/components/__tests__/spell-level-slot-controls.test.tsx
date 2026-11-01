import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { QuickSpells } from '@/components/QuickSpells';
import { SpellManagement } from '@/components/SpellManagement';
import { useCharacterStore } from '@/store/characterStore';
import { makeWizard } from '@/utils/__tests__/test-utils';
import type { Spell } from '@/types/character';

const spell: Spell = {
  id: 'shield',
  name: 'Shield',
  level: 1,
  school: 'Abjuration',
  castingTime: '1 reaction',
  range: 'Self',
  duration: '1 round',
  components: { verbal: true, somatic: true, material: false },
  description: 'Protects the caster.',
  isPrepared: true,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify([]))
  );
  const character = makeWizard();
  useCharacterStore.setState({
    character: makeWizard({
      spells: [spell, { ...spell, id: 'moonbeam', name: 'Moonbeam', level: 2 }],
      spellbook: { ...character.spellbook, favoriteSpells: [] },
      spellSlots: {
        ...character.spellSlots,
        1: { max: 3, used: 1 },
        2: { max: 2, used: 0 },
      },
    }),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

for (const surface of ['quick spells', 'spell management'] as const) {
  describe(`${surface} slot controls`, () => {
    function show() {
      render(
        surface === 'quick spells' ? (
          <QuickSpells
            showAttackRoll={vi.fn()}
            showSavingThrow={vi.fn()}
            showDamageRoll={vi.fn()}
          />
        ) : (
          <SpellManagement editing={false} />
        )
      );
      return screen.getByRole('region', { name: 'Level 1' });
    }
    it('spends and restores one slot without changing other levels or collapsing the spells', () => {
      const section = show();
      expect(
        within(section).getByRole('group', {
          name: '2 of 3 level 1 slots available',
        })
      ).toBeVisible();
      fireEvent.click(
        within(section).getAllByRole('button', {
          name: 'Spend a level 1 slot',
        })[0]
      );
      expect(useCharacterStore.getState().character.spellSlots[1].used).toBe(2);
      expect(
        within(section).getByRole('group', {
          name: '1 of 3 level 1 slots available',
        })
      ).toBeVisible();
      expect(
        within(section).getByRole('button', { expanded: true })
      ).toBeVisible();
      fireEvent.click(
        within(section).getAllByRole('button', {
          name: 'Restore a level 1 slot',
        })[0]
      );
      expect(useCharacterStore.getState().character.spellSlots[1].used).toBe(1);
      expect(useCharacterStore.getState().character.spellSlots[2]).toEqual({
        max: 2,
        used: 0,
      });
    });
    it('keeps the slots usable while the level is collapsed and handles empty/full pools', () => {
      const section = show();
      fireEvent.click(within(section).getByRole('button', { expanded: true }));
      for (let n = 0; n < 2; n++)
        fireEvent.click(
          within(section).getAllByRole('button', {
            name: 'Spend a level 1 slot',
          })[0]
        );
      expect(useCharacterStore.getState().character.spellSlots[1].used).toBe(3);
      expect(
        within(section).queryByRole('button', { name: 'Spend a level 1 slot' })
      ).not.toBeInTheDocument();
      for (let n = 0; n < 3; n++)
        fireEvent.click(
          within(section).getAllByRole('button', {
            name: 'Restore a level 1 slot',
          })[0]
        );
      expect(useCharacterStore.getState().character.spellSlots[1].used).toBe(0);
      expect(
        within(section).queryByRole('button', {
          name: 'Restore a level 1 slot',
        })
      ).not.toBeInTheDocument();
      expect(
        within(section).getByRole('button', { expanded: false })
      ).toBeVisible();
    });
  });
}
