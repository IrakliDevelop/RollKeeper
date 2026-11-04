import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CampaignPlayerData } from '@/types/campaign';
import type { CharacterState } from '@/types/character';

import { PlayerRosterRow, playerDisplayName } from './PlayerRosterRow';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // `fill` and `priority` are next/image-only props that are not valid
    // native <img> attributes; drop them before spreading onto the stub.
    const rest = { ...props };
    delete rest.fill;
    delete rest.priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

const mockPlayer: CampaignPlayerData = {
  playerId: 'player-1',
  playerName: 'Alice',
  characterId: 'char-1',
  characterName: 'Thorin',
  characterData: makeCharacter({
    name: 'Thorin',
    race: 'Dwarf',
    class: {
      name: 'Fighter',
      isCustom: false,
      spellcaster: 'none',
      hitDie: 10,
    },
    level: 5,
    totalLevel: 5,
    hitPoints: { current: 30, max: 44, temporary: 0, calculationMode: 'auto' },
  }),
  lastSynced: new Date().toISOString(),
};

const onView = vi.fn();
const onAdjustCounter = vi.fn();

function renderRow(
  player: CampaignPlayerData = mockPlayer,
  props: Partial<React.ComponentProps<typeof PlayerRosterRow>> = {}
) {
  return render(
    <ul>
      <PlayerRosterRow player={player} onView={onView} {...props} />
    </ul>
  );
}

function withCharacter(patch: Partial<CharacterState>): CampaignPlayerData {
  return {
    ...mockPlayer,
    characterData: { ...mockPlayer.characterData, ...patch },
  };
}

function withInspiration(n: number): CampaignPlayerData {
  return withCharacter({ heroicInspiration: { count: n } });
}

function syncedAt(iso: string): CampaignPlayerData {
  return { ...mockPlayer, lastSynced: iso };
}

describe('PlayerRosterRow', () => {
  beforeEach(() => {
    onView.mockReset();
    onAdjustCounter.mockReset();
  });
  afterEach(cleanup);

  it('is a plain list row', () => {
    renderRow();
    const row = screen.getByTestId('player-row-player-1');
    expect(row.tagName).toBe('LI');
    expect(row).not.toHaveAttribute('role');
    expect(
      screen.getByRole('heading', { level: 3, name: 'Thorin' })
    ).toHaveClass('break-words');
  });

  it('shows race, class, level and the player', () => {
    renderRow();
    expect(screen.getByText('Dwarf Fighter 5 · Alice')).toBeInTheDocument();
  });

  it('falls back to Level {n} and drops an unknown race', () => {
    renderRow(
      withCharacter({
        race: '',
        class: { ...mockPlayer.characterData.class, name: '' },
      })
    );
    expect(screen.getByText('Level 5 · Alice')).toBeInTheDocument();
  });

  it('displays HP as a readout with the status word', () => {
    renderRow();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('/ 44 HP')).toBeInTheDocument();
    expect(screen.getByText('Bloodied')).toBeInTheDocument();
  });

  it('shows AC and passive scores as words', () => {
    renderRow();
    expect(screen.getByText(/^AC/)).toHaveTextContent('AC 16');
    const passives = screen.getByText(/^Passive Perception/);
    expect(passives).toHaveTextContent(
      /^Passive Perception \d+ · Insight \d+ · Investigation \d+$/
    );
    expect(within(passives).getByText(/Insight/)).toHaveClass(
      'hidden',
      'md:inline'
    );
  });

  it('shows inspiration only when held', () => {
    const { rerender } = renderRow(withInspiration(0));
    expect(screen.queryByText(/^Inspiration/)).toBeNull();
    rerender(
      <ul>
        <PlayerRosterRow player={withInspiration(1)} onView={onView} />
      </ul>
    );
    expect(screen.getByText('Inspiration')).toHaveAttribute(
      'data-variant',
      'primary'
    );
    rerender(
      <ul>
        <PlayerRosterRow player={withInspiration(3)} onView={onView} />
      </ul>
    );
    expect(screen.getByText('Inspiration ×3')).toBeInTheDocument();
  });

  it('shows concentration and stacked conditions as chips', () => {
    renderRow(
      withCharacter({
        concentration: { isConcentrating: true, spellName: 'Bless' },
        conditionsAndDiseases: {
          ...mockPlayer.characterData.conditionsAndDiseases,
          activeConditions: [
            {
              id: 'c1',
              name: 'Exhaustion',
              source: 'XPHB',
              description: '',
              stackable: true,
              count: 2,
              appliedAt: new Date().toISOString(),
            },
          ],
        },
      })
    );
    expect(
      screen.getByText('Concentrating on Bless').closest('[data-kind]')
    ).toHaveAttribute('data-kind', 'concentration');
    expect(
      screen.getByText('Exhaustion').closest('[data-kind]')
    ).toHaveTextContent('Exhaustionx2');
    expect(screen.getByText('Exhaustion').closest('li')).not.toBe(
      screen.getByTestId('player-row-player-1')
    );
  });

  it('names the counter buttons and stops at zero', () => {
    renderRow(mockPlayer, {
      customCounterLabel: 'Desperation',
      counterValue: 0,
      onAdjustCounter,
    });
    expect(
      screen.getByRole('button', { name: 'Remove 1 Desperation from Thorin' })
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Add 1 Desperation to Thorin' })
    );
    expect(onAdjustCounter).toHaveBeenCalledWith(1);
    expect(
      screen.getByRole('group', { name: 'Desperation' })
    ).toHaveTextContent('0');
  });

  it('hides the counter without a label', () => {
    renderRow(mockPlayer, { onAdjustCounter });
    expect(screen.queryByRole('button', { name: /^Add 1/ })).toBeNull();
  });

  it.each([
    [0, 'Synced just now', 'text-muted'],
    [90, 'Last synced 1 min ago', 'text-muted'],
    [180, 'Last synced 3 min ago', 'text-ember-text'],
    [7200, 'Last synced 2 h ago', 'text-ember-text'],
  ])('says how fresh a sync %is ago is', (secondsAgo, text, colour) => {
    renderRow(syncedAt(new Date(Date.now() - secondsAgo * 1000).toISOString()));
    expect(screen.getByText(text)).toHaveClass(colour);
  });

  it('reads a future sync time as just now', () => {
    renderRow(syncedAt(new Date(Date.now() + 5 * 60_000).toISOString()));
    expect(screen.getByText('Synced just now')).toBeInTheDocument();
  });

  it('shows no sync text for an unreadable time', () => {
    renderRow(syncedAt('not-a-date'));
    expect(screen.queryByText(/synced/i)).toBeNull();
    expect(screen.getByTestId('player-row-player-1').textContent).not.toMatch(
      /NaN/
    );
  });

  it('opens the sheet from View sheet, described by the name', () => {
    renderRow();
    const button = screen.getByRole('button', { name: 'View sheet' });
    expect(button).toHaveAccessibleDescription('Thorin');
    fireEvent.click(button);
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('opens the character image full size without opening the sheet', () => {
    renderRow(withCharacter({ avatar: 'data:image/png;base64,cG9ydHJhaXQ=' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'View Thorin image full size' })
    );
    expect(
      screen.getByRole('dialog', { name: /thorin full-size image/i })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close image/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onView).not.toHaveBeenCalled();
  });

  it('offers Remove only with onRemove', () => {
    const onRemove = vi.fn();
    const { rerender } = renderRow(mockPlayer, { onRemove });
    const remove = screen.getByRole('button', {
      name: 'Remove Thorin from campaign',
    });
    expect(remove).toHaveAttribute('data-variant', 'danger');
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onView).not.toHaveBeenCalled();
    rerender(
      <ul>
        <PlayerRosterRow player={mockPlayer} onView={onView} />
      </ul>
    );
    expect(screen.queryByRole('button', { name: /from campaign/ })).toBeNull();
  });

  it('renders a row whose synced data has no conditions or concentration', () => {
    renderRow(
      withCharacter({
        conditionsAndDiseases:
          undefined as unknown as CharacterState['conditionsAndDiseases'],
        concentration: undefined as unknown as CharacterState['concentration'],
      })
    );
    expect(screen.getByTestId('player-row-player-1')).toBeInTheDocument();
    expect(screen.queryByText(/Concentrating/)).toBeNull();
  });

  it('names the player by character name, then the sync record', () => {
    expect(playerDisplayName(mockPlayer)).toBe('Thorin');
    expect(
      playerDisplayName({
        ...mockPlayer,
        characterData: { ...mockPlayer.characterData, name: '' },
      })
    ).toBe('Thorin');
    expect(
      playerDisplayName({
        ...mockPlayer,
        characterName: '',
        characterData: { ...mockPlayer.characterData, name: '' },
      })
    ).toBe('Character');
  });
});
