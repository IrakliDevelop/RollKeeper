import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpellManagement } from '@/components/SpellManagement';
import { useCharacterStore } from '@/store/characterStore';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import {
  clickConfirmDialogButton,
  findConfirmDialog,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';
import type { Spell } from '@/types/character';

function spell(id: string, name: string): Spell {
  return {
    id,
    name,
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    description: `${name} description`,
    createdAt: '2026-10-19T00:00:00.000Z',
    updatedAt: '2026-10-19T00:00:00.000Z',
  };
}

const spellIds = () =>
  useCharacterStore.getState().character.spells.map(s => s.id);

describe('SpellManagement — deleting a spell', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks first, and keeps spells added while the dialog was open', async () => {
    useCharacterStore.setState({
      character: {
        ...DEFAULT_CHARACTER_STATE,
        id: 'char-1',
        spells: [spell('magic-missile', 'Magic Missile')],
      },
    });
    renderConfirmDialogHost();
    render(<SpellManagement />);

    fireEvent.click(screen.getAllByTitle('Delete spell')[0]);
    const dialog = await findConfirmDialog();
    expect(dialog).toHaveAccessibleName('Delete Magic Missile?');

    // Another change lands while the player is reading the dialog.
    act(() => {
      useCharacterStore.getState().updateCharacter({
        spells: [
          ...useCharacterStore.getState().character.spells,
          spell('shield', 'Shield'),
        ],
      });
    });
    await clickConfirmDialogButton('Delete spell');

    expect(spellIds()).toEqual(['shield']);
  });

  it('keeps the spell on Cancel', async () => {
    useCharacterStore.setState({
      character: {
        ...DEFAULT_CHARACTER_STATE,
        id: 'char-1',
        spells: [spell('magic-missile', 'Magic Missile')],
      },
    });
    renderConfirmDialogHost();
    render(<SpellManagement />);

    fireEvent.click(screen.getAllByTitle('Delete spell')[0]);
    await clickConfirmDialogButton('Cancel');

    expect(spellIds()).toEqual(['magic-missile']);
  });
});
