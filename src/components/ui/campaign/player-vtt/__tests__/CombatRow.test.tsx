import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { CombatRow } from '@/components/ui/campaign/player-vtt/CombatRow';
import type { SharedTurnEntry } from '@/types/sharedState';

const noop = () => {};

describe('CombatRow', () => {
  afterEach(() => cleanup());

  it('shows the HP-state word (not exact HP) for a player who opted out of sharing', () => {
    const entry: SharedTurnEntry = {
      entityId: 'pc-1',
      displayName: 'Grog',
      type: 'player',
      playerCharacterId: 'char-grog',
      hpMode: 'label',
      hpState: 'Bloodied',
      hpTier: 'low',
      isDead: false,
    };
    render(
      <CombatRow
        entry={entry}
        characterId="char-viewer"
        isCurrent={false}
        enemyHpMode="off"
        onEndTurn={noop}
      />
    );
    expect(screen.getByText('Bloodied')).toBeInTheDocument();
    expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument();
  });

  it('shows "Defeated" and "Down", never a band word, when a payload still carries one at 0 HP', () => {
    // A DM tab opened before 02a and not reloaded, but holding the upgraded
    // bands, still sends the lowest band's word on dead rows.
    const enemy: SharedTurnEntry = {
      entityId: 'gob-1',
      displayName: 'Goblin',
      type: 'monster',
      disposition: 'enemy',
      hpState: 'Critical',
      isDead: true,
    };
    const player: SharedTurnEntry = {
      entityId: 'pc-9',
      displayName: 'Caleb',
      type: 'player',
      playerCharacterId: 'char-caleb',
      hpMode: 'label',
      hpState: 'Critical',
      isDead: true,
    };
    render(
      <>
        <CombatRow
          entry={enemy}
          characterId="char-viewer"
          isCurrent={false}
          enemyHpMode="label"
          onEndTurn={noop}
        />
        <CombatRow
          entry={player}
          characterId="char-viewer"
          isCurrent={false}
          enemyHpMode="label"
          onEndTurn={noop}
        />
      </>
    );
    expect(screen.getByText('Defeated')).toBeInTheDocument();
    expect(screen.getByText('Down')).toBeInTheDocument();
    expect(screen.queryByText('Critical')).not.toBeInTheDocument();
  });

  it('still shows the HP bar for a player who shares HP', () => {
    const entry: SharedTurnEntry = {
      entityId: 'pc-2',
      displayName: 'Aria',
      type: 'player',
      playerCharacterId: 'char-aria',
      currentHp: 18,
      maxHp: 30,
      isDead: false,
    };
    render(
      <CombatRow
        entry={entry}
        characterId="char-viewer"
        isCurrent={false}
        enemyHpMode="off"
        onEndTurn={noop}
      />
    );
    expect(screen.getByText('18/30')).toBeInTheDocument();
  });

  it('shows "Down" for a dead opted-out player, not exact HP', () => {
    const entry: SharedTurnEntry = {
      entityId: 'pc-3',
      displayName: 'Fjord',
      type: 'player',
      playerCharacterId: 'char-fjord',
      hpMode: 'label',
      isDead: true,
    };
    render(
      <CombatRow
        entry={entry}
        characterId="char-viewer"
        isCurrent={false}
        enemyHpMode="off"
        onEndTurn={noop}
      />
    );
    expect(screen.getByText('Down')).toBeInTheDocument();
    expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument();
  });
});
