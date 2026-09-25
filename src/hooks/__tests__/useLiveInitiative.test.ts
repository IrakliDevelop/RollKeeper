import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useLiveInitiative } from '@/hooks/useLiveInitiative';
import type { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';
import type { CharacterState } from '@/types/character';
import type { SharedInitiativeState } from '@/types/sharedState';

const SELF_ID = 'char-self';
const OTHER_ID = 'char-other';

function makeInitiative(
  overrides: Partial<SharedInitiativeState> = {}
): SharedInitiativeState {
  return {
    encounterId: 'enc-1',
    isActive: true,
    round: 1,
    currentEntityId: null,
    turnOrder: [
      {
        entityId: 'entity-self',
        displayName: 'Hero',
        type: 'player',
        playerCharacterId: SELF_ID,
        currentHp: 44,
        maxHp: 44,
      },
      {
        entityId: 'entity-other',
        displayName: 'Gandalf',
        type: 'player',
        playerCharacterId: OTHER_ID,
        currentHp: 60,
        maxHp: 80,
      },
    ],
    enemyHpMode: 'off',
    enemyConditionsMode: 'off',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeCharacter(
  overrides: Partial<CharacterState> = {}
): CharacterState {
  return {
    id: SELF_ID,
    hitPoints: {
      current: 5,
      max: 44,
      temporary: 0,
      calculationMode: 'manual',
    },
    ...overrides,
  } as CharacterState;
}

function makePartyMember(
  overrides: Partial<PartyMemberHP> = {}
): PartyMemberHP {
  return {
    characterId: OTHER_ID,
    characterName: 'Gandalf',
    playerName: 'Player One',
    className: 'Wizard',
    level: 10,
    armorClass: 13,
    hitPoints: { current: 12, max: 80, temporary: 0 },
    lastSynced: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('useLiveInitiative', () => {
  it('overlays own character HP instantly', () => {
    const initiative = makeInitiative();
    const character = makeCharacter();
    const { result } = renderHook(() =>
      useLiveInitiative(initiative, character, SELF_ID, [])
    );

    const selfEntry = result.current!.turnOrder.find(
      e => e.entityId === 'entity-self'
    );
    expect(selfEntry?.currentHp).toBe(5);
    expect(selfEntry?.maxHp).toBe(44);
  });

  it('overlays party member HP', () => {
    const initiative = makeInitiative();
    const { result } = renderHook(() =>
      useLiveInitiative(initiative, null, SELF_ID, [makePartyMember()])
    );

    const otherEntry = result.current!.turnOrder.find(
      e => e.entityId === 'entity-other'
    );
    expect(otherEntry?.currentHp).toBe(12);
    expect(otherEntry?.maxHp).toBe(80);
  });

  it('skips a party member with null hitPoints — entry HP passes through', () => {
    const initiative = makeInitiative();
    const member = makePartyMember({
      hitPoints: null as unknown as PartyMemberHP['hitPoints'],
    });
    const { result } = renderHook(() =>
      useLiveInitiative(initiative, null, SELF_ID, [member])
    );

    const otherEntry = result.current!.turnOrder.find(
      e => e.entityId === 'entity-other'
    );
    expect(otherEntry?.currentHp).toBe(60);
    expect(otherEntry?.maxHp).toBe(80);
  });

  it('does not apply own-character overlay when the character id does not match characterId', () => {
    const initiative = makeInitiative();
    const character = makeCharacter({ id: 'some-other-id' });
    const { result } = renderHook(() =>
      useLiveInitiative(initiative, character, SELF_ID, [])
    );

    const selfEntry = result.current!.turnOrder.find(
      e => e.entityId === 'entity-self'
    );
    expect(selfEntry?.currentHp).toBe(44);
    expect(selfEntry?.maxHp).toBe(44);
  });

  it("overlays the viewer's own exact HP over their own masked (opted-out) row", () => {
    // The viewer opted out of sharing, so their initiative row arrives
    // masked (no currentHp/maxHp, label mode) — same as any other player
    // would see it. Their own character sheet is still authoritative for
    // their own dock/panel, so the local overlay must restore exact HP.
    const initiative = makeInitiative({
      turnOrder: [
        {
          entityId: 'entity-self',
          displayName: 'Hero',
          type: 'player',
          playerCharacterId: SELF_ID,
          hpMode: 'label',
          hpState: 'Bloodied',
          hpTier: 'low',
          isDead: false,
        },
      ],
    });
    const character = makeCharacter({
      hitPoints: {
        current: 5,
        max: 44,
        temporary: 0,
        calculationMode: 'manual',
      },
    });
    const { result } = renderHook(() =>
      useLiveInitiative(initiative, character, SELF_ID, [])
    );

    const selfEntry = result.current!.turnOrder.find(
      e => e.entityId === 'entity-self'
    );
    expect(selfEntry?.currentHp).toBe(5);
    expect(selfEntry?.maxHp).toBe(44);
  });

  it('leaves another opted-out party member masked when party-hp has no entry for them', () => {
    // party-hp already omits hitPoints for an opted-out member, so
    // useLiveInitiative never puts them in the live map — their masked
    // row must pass through untouched.
    const initiative = makeInitiative({
      turnOrder: [
        {
          entityId: 'entity-other',
          displayName: 'Gandalf',
          type: 'player',
          playerCharacterId: OTHER_ID,
          hpMode: 'label',
          hpState: 'Healthy',
          hpTier: 'high',
          isDead: false,
        },
      ],
    });
    const member = makePartyMember({
      hitPoints: null as unknown as PartyMemberHP['hitPoints'],
    });
    const { result } = renderHook(() =>
      useLiveInitiative(initiative, null, SELF_ID, [member])
    );

    const otherEntry = result.current!.turnOrder.find(
      e => e.entityId === 'entity-other'
    );
    expect('currentHp' in otherEntry!).toBe(false);
    expect('maxHp' in otherEntry!).toBe(false);
    expect(otherEntry?.hpState).toBe('Healthy');
  });

  it('returns null when sharedInitiative is null', () => {
    const { result } = renderHook(() =>
      useLiveInitiative(null, makeCharacter(), SELF_ID, [])
    );

    expect(result.current).toBeNull();
  });
});
