import { describe, it, expect, beforeEach } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import { withIntentContext } from '@/store/characterIntentContext';
import { TAB_ID } from '@/lib/tabIdentity';
import { withExternalApply } from '@/lib/characterRevision';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import type { CharacterState } from '@/types/character';

const freshCharacter = (): CharacterState =>
  ({
    ...DEFAULT_CHARACTER_STATE,
    id: 'test-char',
    revision: 10,
  }) as unknown as CharacterState;

beforeEach(() => {
  window.localStorage.clear();
  useCharacterStore.getState().loadCharacterState(freshCharacter());
  useCharacterStore.setState({ intentWatermarks: {} });
});

describe('canonical mutation middleware', () => {
  it('bumps revision by 1 and stamps lastMutatedAt/lastMutatedBy in one set', () => {
    const before = useCharacterStore.getState().character;
    useCharacterStore.getState().applyDamageToCharacter(3);
    const after = useCharacterStore.getState().character;
    expect(after.revision).toBe((before.revision ?? 0) + 1);
    expect(after.lastMutatedBy).toBe(TAB_ID);
    expect(typeof after.lastMutatedAt).toBe('number');
  });

  it('does not bump on external apply (adopts incoming revision)', () => {
    const incoming = { ...freshCharacter(), revision: 42 };
    useCharacterStore.getState().loadCharacterState(incoming);
    expect(useCharacterStore.getState().character.revision).toBe(42);
  });

  it('no-op actions do not mint revisions', () => {
    const before = useCharacterStore.getState().character.revision;
    // backfillCantripScaling with no matching spells is a same-reference no-op
    useCharacterStore.getState().backfillCantripScaling([]);
    expect(useCharacterStore.getState().character.revision).toBe(before);
  });

  it('advances the intent watermark atomically with the mutation', () => {
    withIntentContext({ tabId: 'sender-1', seq: 1 }, () => {
      useCharacterStore.getState().applyDamageToCharacter(2);
    });
    const state = useCharacterStore.getState();
    expect(state.intentWatermarks['sender-1']?.seq).toBe(1);
    expect(state.character.revision).toBe(11);
  });

  it('a no-op intent still advances the watermark without bumping revision', () => {
    withIntentContext({ tabId: 'sender-2', seq: 1 }, () => {
      useCharacterStore.getState().backfillCantripScaling([]);
    });
    // Action's set returned unchanged state — middleware still merged the
    // watermark patch. If the action never called set at all, the bus's
    // noteIntentApplied fallback covers it (tested below).
    const state = useCharacterStore.getState();
    expect(state.intentWatermarks['sender-2']?.seq).toBe(1);
    expect(state.character.revision).toBe(10);
  });

  it('noteIntentApplied advances the watermark standalone', () => {
    useCharacterStore.getState().noteIntentApplied('sender-3', 4);
    expect(useCharacterStore.getState().intentWatermarks['sender-3']?.seq).toBe(
      4
    );
  });

  it('watermark GC keeps at most 10 tabs, newest lastSeen first', () => {
    for (let i = 0; i < 12; i++) {
      useCharacterStore.getState().noteIntentApplied(`tab-${i}`, 1);
    }
    const keys = Object.keys(useCharacterStore.getState().intentWatermarks);
    expect(keys.length).toBeLessThanOrEqual(10);
    expect(keys).toContain('tab-11');
  });

  it('external applies (adoption) never set hasUnsavedChanges', () => {
    withExternalApply(() =>
      useCharacterStore.getState().loadCharacterState(freshCharacter())
    );
    expect(useCharacterStore.getState().hasUnsavedChanges).toBe(false);
  });
});
