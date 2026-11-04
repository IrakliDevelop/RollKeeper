import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeCharacter, makeWizard } from '@/utils/__tests__/test-utils';
import { exportCharacterStateToFile } from '@/utils/fileOperations';
import type { CampaignPlayerData } from '@/types/campaign';
import type { CharacterState, Spell } from '@/types/character';
import { PlayerDetailDialog } from '../index';

vi.mock('@/utils/fileOperations', () => ({
  exportCharacterStateToFile: vi.fn(),
}));

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
  vi.clearAllMocks();
});

function makeSpell(
  overrides: Partial<Spell> & Pick<Spell, 'name' | 'level'>
): Spell {
  return {
    id: `spell-${overrides.name.toLowerCase().replace(/\s+/g, '-')}`,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    description: 'Test spell description.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const emptySlots = {
  1: { max: 0, used: 0 },
  2: { max: 0, used: 0 },
  3: { max: 0, used: 0 },
  4: { max: 0, used: 0 },
  5: { max: 0, used: 0 },
  6: { max: 0, used: 0 },
  7: { max: 0, used: 0 },
  8: { max: 0, used: 0 },
  9: { max: 0, used: 0 },
};

function playerFor(character: CharacterState): CampaignPlayerData {
  return {
    playerId: 'p1',
    playerName: 'Sam',
    characterId: 'c1',
    characterName: character.name,
    lastSynced: '2026-07-19T10:00:00.000Z',
    characterData: character,
  };
}

function caster(): CharacterState {
  return makeWizard({
    name: 'Aria',
    spellSlots: { ...emptySlots, 1: { max: 4, used: 1 } },
    spells: [makeSpell({ name: 'Magic Missile', level: 1 })],
  });
}

function renderDialog(
  player: CampaignPlayerData,
  props: Partial<React.ComponentProps<typeof PlayerDetailDialog>> = {}
) {
  return render(
    <PlayerDetailDialog
      open
      onOpenChange={vi.fn()}
      player={player}
      {...props}
    />
  );
}

describe('PlayerDetailDialog header', () => {
  it('names race, classes, alignment and player in one line', () => {
    const base = makeCharacter();
    renderDialog(
      playerFor({
        ...base,
        name: 'Thorin',
        race: 'Dwarf',
        alignment: 'Lawful good',
        classes: [
          { className: 'Fighter', level: 3, isCustom: false, hitDie: 10 },
          { className: 'Wizard', level: 2, isCustom: false, hitDie: 6 },
        ],
      })
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'Dwarf Fighter 3 / Wizard 2 · Lawful good · Played by Sam'
    );
    expect(screen.getByRole('heading', { name: 'Thorin' })).toBeInTheDocument();
  });

  it('leaves out a missing race and alignment', () => {
    const base = makeCharacter();
    renderDialog(
      playerFor({
        ...base,
        race: '',
        alignment: '',
        classes: undefined as unknown as CharacterState['classes'],
        class: { ...base.class, name: 'Rogue' },
        level: 4,
        totalLevel: 4,
      })
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'Rogue 4 · Played by Sam'
    );
    expect(screen.queryByText(/Unknown|Unaligned/)).toBeNull();
  });

  it('falls back to the level when no class is known', () => {
    const base = makeCharacter();
    renderDialog(
      playerFor({
        ...base,
        race: '',
        alignment: '',
        classes: [],
        class: { ...base.class, name: '' },
        level: 2,
        totalLevel: 2,
      })
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'Level 2 · Played by Sam'
    );
  });

  it('exports the character and offers Message only with a handler', async () => {
    const user = userEvent.setup();
    const character = makeCharacter();
    const { rerender } = renderDialog(playerFor(character));
    await user.click(screen.getByRole('button', { name: 'Export character' }));
    expect(exportCharacterStateToFile).toHaveBeenCalledWith(character);
    expect(screen.queryByRole('button', { name: 'Message' })).toBeNull();

    const onSendMessage = vi.fn();
    rerender(
      <PlayerDetailDialog
        open
        onOpenChange={vi.fn()}
        player={playerFor(character)}
        onSendMessage={onSendMessage}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Message' }));
    expect(onSendMessage).toHaveBeenCalledTimes(1);
  });
});

describe('PlayerDetailDialog tabs', () => {
  it('shows Overview, Spells and Inventory as tabs labelled Character sheet', () => {
    renderDialog(playerFor(caster()));
    const list = screen.getByRole('tablist', { name: 'Character sheet' });
    expect(list).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: 'Spells' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Inventory' })).toBeInTheDocument();
  });

  it('has no Spells tab for a character without spells or slots', () => {
    renderDialog(playerFor(makeCharacter()));
    expect(screen.queryByRole('tab', { name: 'Spells' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Inventory' })).toBeInTheDocument();
  });

  it('opens on Overview again after closing on Spells', async () => {
    const user = userEvent.setup();
    const player = playerFor(caster());
    const { rerender } = renderDialog(player);
    await user.click(screen.getByRole('tab', { name: 'Spells' }));
    expect(screen.getByRole('tab', { name: 'Spells' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    rerender(
      <PlayerDetailDialog open={false} onOpenChange={vi.fn()} player={player} />
    );
    rerender(
      <PlayerDetailDialog open onOpenChange={vi.fn()} player={player} />
    );
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('falls back to Overview when the Spells tab goes away', async () => {
    const user = userEvent.setup();
    const { rerender } = renderDialog(playerFor(caster()));
    await user.click(screen.getByRole('tab', { name: 'Spells' }));
    const nonCaster = makeCharacter({
      name: 'Aria',
      spells: [],
      spellSlots: { ...emptySlots },
    });
    rerender(
      <PlayerDetailDialog
        open
        onOpenChange={vi.fn()}
        player={playerFor(nonCaster)}
      />
    );
    expect(screen.queryByRole('tab', { name: 'Spells' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Overview');
  });
});
